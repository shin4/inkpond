/**
 * 节气: one scene per solar term, chosen by date. Left to itself it shows
 * the term the day falls in and, when the clock crosses into the next term
 * while the page is open, bleeds over to it through an ink dissolve; given
 * a term it shows that one, and given a date, that date's.
 *
 * All twenty-four share one glyph table and one font subset, so switching
 * never rebuilds the atlas or waits for a font.
 */
import { clamp, hash2, noise, rng } from "../../noise.js";
import {
  glyphTable,
  INK,
  type InkPondScene,
  type SceneEnv,
  type SceneView,
  ZHU,
} from "../../scene.js";
import { bailu, chushu, hanlu, liqiu, qiufen, shuangjiang } from "./autumn.js";
import { JIEQI, type JieqiTerm, jieqiIndexAt } from "./calendar.js";
import { chunfen, guyu, jingzhe, lichun, qingming, yushui } from "./spring.js";
import { dashu, lixia, mangzhong, xiaoman, xiaoshu, xiazhi } from "./summer.js";
import type { Term, TermCell, TermSpec } from "./term.js";
import { dahan, daxue, dongzhi, lidong, xiaohan, xiaoxue } from "./winter.js";

export { JIEQI, type JieqiTerm, jieqiAt, sunLongitude } from "./calendar.js";

export const JIEQI_FONT_FAMILY = "Inkpond Glyphs Jieqi";
export const JIEQI_FONT_URL = new URL(
  "../../assets/inkpond-jieqi.woff2",
  import.meta.url,
).href;

export interface JieqiOptions {
  /** Show this term only. */
  term?: JieqiTerm;
  /** Show the term of this date (and stay on it); default: today, live. */
  date?: Date | number;
}

/** Every term, in JIEQI order. */
export const TERM_SPECS: readonly TermSpec[] = [
  lichun,
  yushui,
  jingzhe,
  chunfen,
  qingming,
  guyu,
  lixia,
  xiaoman,
  mangzhong,
  xiazhi,
  xiaoshu,
  dashu,
  liqiu,
  chushu,
  bailu,
  qiufen,
  hanlu,
  shuangjiang,
  lidong,
  xiaoxue,
  daxue,
  dongzhi,
  xiaohan,
  dahan,
];

/** How much darker than 1 a term's densest cell lands, at the default strength. */
const INK_SCALE = 2.1;
/**
 * Below this a cell is paper. Terms paint whole-frame fields; cutting their
 * faint wash keeps the 留白 of the other scenes and the glyph count (the
 * whole per-frame cost) near theirs.
 */
const PAPER = 0.15;
/** Seconds the dissolve to a new term takes. */
const MIX_S = 1.6;
/** How often, in seconds of animation, a live scene checks the clock. */
const CHECK_S = 60;
/** The pre-roll steps at this rate. */
const WARM_DT = 1 / 20;

interface Live {
  index: number;
  term: Term;
  /** Seconds on the term's own clock. */
  clock: number;
  /** First kind of its ramps in the shared table. */
  kinds: number;
}

const stillEnv = (view: SceneView): SceneEnv => ({
  cell: view.cell,
  drops: [],
  height: view.height,
  maskAt: () => 1,
  pan: 0,
  pointer: null,
  time: 0,
  width: view.width,
});

export const createJieqi = (options: JieqiOptions = {}): InkPondScene => {
  // One table: every term's ramps in order, then the dissolve's edge.
  const firstKind: number[] = [];
  const ramps: (readonly string[])[] = [];
  for (const spec of TERM_SPECS) {
    firstKind.push(ramps.length);
    ramps.push(...spec.ramps);
  }
  const EDGE = ramps.length;
  ramps.push(["墨"]);
  const table = glyphTable(
    ramps,
    TERM_SPECS.map((spec) => spec.loose).join(""),
  );

  const fixed = options.term
    ? Math.max(
        0,
        JIEQI.findIndex((term) => term.id === options.term),
      )
    : null;
  const follow = fixed === null && options.date === undefined;
  const pick = () =>
    fixed ??
    jieqiIndexAt(options.date === undefined ? Date.now() : options.date);

  let view: SceneView | null = null;
  const cellOut: TermCell = { k: 0, p: INK, v: 0, wet: 1 };

  const start = (index: number): Live => {
    const spec = TERM_SPECS[index] ?? TERM_SPECS[0];
    if (!spec) throw new Error("inkpond: no solar terms");
    const live: Live = {
      clock: 0,
      index,
      kinds: firstKind[index] ?? 0,
      term: spec.create({
        glyph: table.index,
        rand: rng(index * 7919 + 977),
      }),
    };
    if (view) place(live, spec);
    return live;
  };
  /** Lay a term out and pre-roll it, so even a still frame is mid-scene. */
  const place = (live: Live, spec: TermSpec) => {
    if (!view) return;
    live.term.layout({
      cell: view.cell,
      height: view.height,
      width: view.width,
    });
    live.clock = 0;
    const env = stillEnv(view);
    for (let t = 0; t < spec.warm; t += WARM_DT) {
      live.clock += WARM_DT;
      live.term.step(WARM_DT, live.clock, env);
    }
  };

  let cur = start(pick());
  let prev: Live | null = null;
  let mixAt = 0;
  let nextCheck = CHECK_S;

  const readCell = (
    live: Live,
    x: number,
    y: number,
    cx: number,
    cy: number,
  ) => {
    cellOut.v = 0;
    cellOut.p = INK;
    cellOut.k = 0;
    cellOut.wet = 1;
    live.term.cell(x, y, live.clock, cellOut, cx, cy);
    return cellOut;
  };

  return {
    fontFamily: JIEQI_FONT_FAMILY,
    fontUrl: JIEQI_FONT_URL,
    glyphs: table.glyphs,
    moving: true,
    panSpeed: 0,
    ramps: table.ramps,
    compose(grid, _offset, time) {
      if (!view) return;
      const { cols, rows, cell } = view;
      const mix = prev ? clamp((time - mixAt) / MIX_S, 0, 1) : 1;
      if (mix >= 1) prev = null;
      for (let y = 0, i = 0; y < rows; y++) {
        const py = (y - 1) * cell + cell / 2;
        for (let x = 0; x < cols; x++, i++) {
          const px = (x - 1) * cell + cell / 2;
          let live = cur;
          if (prev) {
            // 墨晕: the new term spreads through the old in ragged blots.
            const m = noise(x * 0.13, y * 0.13) * 0.78 + hash2(x, y) * 0.22;
            if (m > mix) live = prev;
            else if (m > mix - 0.05) {
              grid.ground[i] = 0.9 * INK_SCALE;
              grid.kind[i] = EDGE;
              grid.pigment[i] = ZHU;
              grid.wet[i] = 1;
              continue;
            }
          }
          const c = readCell(live, px, py, x - 1, y - 1);
          grid.ground[i] = Math.max(0, (c.v - PAPER) / (1 - PAPER)) * INK_SCALE;
          grid.kind[i] = live.kinds + c.k;
          grid.pigment[i] = c.p;
          grid.wet[i] = c.wet;
        }
      }
    },
    layout(next) {
      view = next;
      const spec = TERM_SPECS[cur.index];
      if (spec) place(cur, spec);
      prev = null;
    },
    stamps(env, emit) {
      const fade = prev ? clamp((env.time - mixAt) / MIX_S, 0, 1) : 1;
      if (prev) {
        const out = 1 - fade;
        prev.term.stamps(prev.clock, (g, x, y, a, s, p) =>
          emit(g, x, y, a * out, s, p),
        );
      }
      if (fade >= 1) cur.term.stamps(cur.clock, emit);
      else
        cur.term.stamps(cur.clock, (g, x, y, a, s, p) =>
          emit(g, x, y, a * fade, s, p),
        );
    },
    step(dt, env) {
      const now = env.time;
      if (follow && now >= nextCheck) {
        nextCheck = now + CHECK_S;
        const index = pick();
        if (index !== cur.index) {
          prev = cur;
          cur = start(index);
          mixAt = now;
        }
      }
      if (prev) advance(prev, dt, env);
      advance(cur, dt, env);
    },
  };
};

const advance = (live: Live, dt: number, env: SceneEnv) => {
  live.clock += dt;
  // A drop arrives with an age of exactly the step that followed it.
  for (const d of env.drops) {
    if (d.age <= dt + 1e-6) live.term.drop?.(d.x, d.y, live.clock);
  }
  live.term.step(dt, live.clock, env);
};
