/**
 * 北冥: the open sea seen from above, and a whale beneath it. Slow swells
 * cross the surface in 一 and ～; under them a whale's back drifts by as a
 * shadow, rising toward the surface and sinking away again over about a
 * minute. Deep, it blurs into the water; near the top it darkens, light from
 * the surface plays across its back, and it leaves 鲸迹 behind: flat calm
 * patches where the swell is smoothed away. The pointer sends it deeper and
 * dropped ink draws it nearer. A few motes drift in the water.
 */
import { clamp, fbm, noise, rng, smoothstep } from "../noise.js";
import {
  COARSE,
  type CoarseField,
  coarseField,
  glyphTable,
  HUAQING,
  INK,
  type InkPondScene,
} from "../scene.js";

export const BEIMING_FONT_FAMILY = "Inkpond Glyphs Beiming";
export const BEIMING_FONT_URL = new URL(
  "../assets/inkpond-beiming.woff2",
  import.meta.url,
).href;

const SEA = 0;
const WHALE = 1;
/** The swell, lightest first; ripples from the pointer reach the dark end. */
export const BEIMING_LEVELS = [
  "一",
  "一",
  "一～",
  "～",
  "～二",
  "冫水",
  "波浪",
  "沧海",
] as const;
const WHALE_LEVELS = [
  "丶",
  "冫",
  "氵沉",
  "深没",
  "幽潜",
  "冥渊",
  "溟鲲",
  "鲸鲲",
] as const;
const MOTE = "丶";

/** Ground per unit of swell or whale, at the default strength. */
const SEA_INK = 2.6;
const WHALE_INK = 2.8;
/** Spine points, head first. */
const SPINE = 14;
/** Seconds for one rise and fall. */
const DEPTH_PERIOD = 56;
/** Seconds for one beat of the flukes. */
const BEAT_PERIOD = 7;
const SLICKS = 18;
const SLICK_EVERY_S = 1.8;
const SLICK_LIFE_S = 32;

interface Point {
  x: number;
  y: number;
}

interface Slick extends Point {
  t: number;
  /** How strongly it calms the swell, 0–1. */
  k: number;
}

interface Mote extends Point {
  z: number;
  phase: number;
}

const angleTo = (from: number, to: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const createBeiming = (
  levels: readonly string[] = BEIMING_LEVELS,
): InkPondScene => {
  const table = glyphTable([levels, WHALE_LEVELS], MOTE);
  const mote = table.index(MOTE);
  let cols = 0;
  let rows = 0;
  let cell = 16;
  let width = 0;
  let height = 0;
  let warp: CoarseField = coarseField(0, 0);
  let patch: CoarseField = coarseField(0, 0);

  // The whale: length, greatest half-width, spine and its half-widths.
  let length = 0;
  let girth = 0;
  let seg = 0;
  let spine: Point[] = [];
  let halfWidth = new Float32Array(0);
  let heading = 0;
  /** 0 at the surface, 1 as deep as it goes. */
  let depth = 0.5;
  /** Extra depth from the pointer, 0–1, eased off slowly. */
  let dive = 0;
  let beat = 0;
  let slicks: Slick[] = [];
  let nextSlick = 0;
  let lastSlick = Number.NEGATIVE_INFINITY;
  let motes: Mote[] = [];
  /** Set by whaleAt: whether the cell lies on the whale's soft edge. */
  let rim = false;

  const layoutWhale = () => {
    length = clamp(
      Math.min(Math.max(width * 0.5, height * 0.62), width * 0.9),
      240,
      860,
    );
    girth = length * 0.11;
    seg = length / (SPINE - 1);
    heading = -0.12;
    halfWidth = new Float32Array(SPINE);
    spine = [];
    for (let i = 0; i < SPINE; i++) {
      const s = i / (SPINE - 1);
      // A broad head, widest a quarter of the way back, a slender stock.
      halfWidth[i] =
        s < 0.26
          ? girth *
            (0.42 + 0.58 * Math.sqrt(Math.sin((s / 0.26) * (Math.PI / 2))))
          : girth *
            (0.1 + 0.9 * Math.cos(((s - 0.26) / 0.74) * (Math.PI / 2)) ** 1.7);
      spine.push({
        x: width * 0.32 - Math.cos(heading) * seg * i,
        y: height * 0.6 - Math.sin(heading) * seg * i,
      });
    }
    slicks = Array.from({ length: SLICKS }, () => ({ k: 0, t: 0, x: 0, y: 0 }));
    nextSlick = 0;
    lastSlick = Number.NEGATIVE_INFINITY;
    dive = 0;
    const rand = rng(cols * 29 + rows * 13);
    motes = Array.from(
      { length: clamp(Math.round((width * height) / 52_000), 12, 48) },
      () => ({
        phase: rand() * 6.28,
        x: rand() * width,
        y: rand() * height,
        z: 0.4 + rand() * 0.6,
      }),
    );
  };

  /** Distance to a tapered capsule from (ax, ay) along unit (dx, dy). */
  const taper = (
    px: number,
    py: number,
    ax: number,
    ay: number,
    dx: number,
    dy: number,
    len: number,
    r0: number,
    r1: number,
  ) => {
    const t = clamp(((px - ax) * dx + (py - ay) * dy) / len, 0, 1);
    const ex = px - ax - dx * t * len;
    const ey = py - ay - dy * t * len;
    return Math.sqrt(ex * ex + ey * ey) - (r0 + (r1 - r0) * t);
  };

  // The whale's pose for one compose: blur, flukes and fins.
  let blur = 0;
  let span = 0;
  let tailX = 0;
  let tailY = 0;
  let tailDX = 1;
  let tailDY = 0;
  /** Per pectoral fin: root x, y and unit direction x, y. */
  const fin = new Float64Array(8);
  const pose = (time: number) => {
    blur = (0.6 + 2.2 * depth) * cell;
    span = length * 0.17 * (0.86 + 0.14 * Math.cos(beat));
    const tail = spine[SPINE - 1] as Point;
    const stock = spine[SPINE - 2] as Point;
    const tl = Math.hypot(tail.x - stock.x, tail.y - stock.y) || 1;
    tailX = tail.x;
    tailY = tail.y;
    tailDX = (tail.x - stock.x) / tl;
    tailDY = (tail.y - stock.y) / tl;
    // Long pectoral fins, sweeping slowly back and forth.
    const f0 = spine[3] as Point;
    const f1 = spine[4] as Point;
    const fl = Math.hypot(f1.x - f0.x, f1.y - f0.y) || 1;
    const bx = (f1.x - f0.x) / fl;
    const by = (f1.y - f0.y) / fl;
    for (let side = -1, k = 0; side <= 1; side += 2, k += 4) {
      const a = 0.72 + 0.12 * Math.sin(time * 0.32 + side);
      const ca = Math.cos(a);
      const sa = Math.sin(a) * side;
      const root = (halfWidth[3] ?? 0) * 0.75 * side;
      fin[k] = f0.x + (f1.x - f0.x) * 0.25 - by * root;
      fin[k + 1] = f0.y + (f1.y - f0.y) * 0.25 + bx * root;
      fin[k + 2] = bx * ca - by * sa;
      fin[k + 3] = by * ca + bx * sa;
    }
  };

  /** How much whale shows at (x, y), CSS px; sets `rim`. */
  const whaleAt = (x: number, y: number, time: number) => {
    let body = 1e9;
    let bodyHalf = 1;
    for (let i = 0; i < SPINE - 1; i++) {
      const a = spine[i] as Point;
      const b = spine[i + 1] as Point;
      const vx = b.x - a.x;
      const vy = b.y - a.y;
      const k = clamp(
        ((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy || 1),
        0,
        1,
      );
      const h =
        (halfWidth[i] ?? 0) +
        ((halfWidth[i + 1] ?? 0) - (halfWidth[i] ?? 0)) * k;
      const ex = x - a.x - vx * k;
      const ey = y - a.y - vy * k;
      const d = Math.sqrt(ex * ex + ey * ey) - h;
      if (d < body) {
        body = d;
        bodyHalf = h;
      }
    }
    // Fins and flukes never reach further than this from the body.
    if (body > length * 0.3 + blur) {
      rim = false;
      return 0;
    }

    // Flukes: a swept crescent with a notch, foreshortened as they beat.
    const u = (x - tailX) * tailDX + (y - tailY) * tailDY;
    const w = -(x - tailX) * tailDY + (y - tailY) * tailDX;
    const chord = length * 0.075;
    const aw = Math.abs(w) / span;
    const lead = -chord * 0.2 + chord * 0.85 * aw ** 1.8;
    const trail =
      lead +
      chord *
        Math.sqrt(Math.max(0, 1 - aw * aw)) *
        (1 - 0.45 * Math.exp(-((w / (span * 0.1)) ** 2)));
    const flukes = Math.max(Math.abs(w) - span, lead - u, u - trail);

    let fins = 1e9;
    for (let k = 0; k < 8; k += 4) {
      fins = Math.min(
        fins,
        taper(
          x,
          y,
          fin[k] ?? 0,
          fin[k + 1] ?? 0,
          fin[k + 2] ?? 0,
          fin[k + 3] ?? 0,
          length * 0.27,
          length * 0.042,
          length * 0.012,
        ),
      );
    }

    const d = Math.min(body, flukes, fins);
    if (d > blur) {
      rim = false;
      return 0;
    }
    rim = d > -blur * 0.55 - depth * girth * 0.5;
    // Darkest along the spine; fins and flukes a little lighter.
    const core =
      body <= d
        ? 0.5 + 0.5 * Math.sqrt(clamp(-body / (bodyHalf * 0.9), 0, 1))
        : flukes <= d
          ? 0.8 * (0.85 + 0.15 * Math.cos(beat))
          : 0.8;
    const mottle = 0.78 + 0.4 * (noise(x / 46, y / 46) - 0.5);
    // Light from the surface plays across its back when it is shallow.
    const c = noise(x / 68 + time * 0.12, y / 68 - time * 0.08);
    const lit =
      1 - 0.32 * smoothstep(0.78, 1, 1 - Math.abs(2 * c - 1)) * (1 - depth);
    return (
      (1 - smoothstep(-blur, blur, d)) * (1 - 0.5 * depth) * core * mottle * lit
    );
  };

  /** How far the swell is smoothed at (x, y) by the whale's footprints. */
  const calmAt = (x: number, y: number, time: number) => {
    let calm = 0;
    for (const s of slicks) {
      if (s.k <= 0) continue;
      const age = time - s.t;
      if (age > SLICK_LIFE_S) continue;
      const r = girth * (1.5 + age * 0.06);
      const d2 = ((x - s.x) ** 2 + (y - s.y) ** 2) / (r * r);
      if (d2 < 4) {
        calm = Math.max(
          calm,
          Math.exp(-d2 * d2) *
            s.k *
            smoothstep(SLICK_LIFE_S, SLICK_LIFE_S * 0.56, age),
        );
      }
    }
    return calm;
  };

  return {
    fontFamily: BEIMING_FONT_FAMILY,
    fontUrl: BEIMING_FONT_URL,
    glyphs: table.glyphs,
    moving: true,
    panSpeed: 0,
    ramps: table.ramps,
    compose(grid, _offset, time) {
      // The swell's slow warp and where it breaks up, on the coarse grid.
      for (let cy = 0; cy < warp.h; cy++) {
        for (let cx = 0; cx < warp.w; cx++) {
          const x = cx * COARSE * cell;
          const y = cy * COARSE * cell;
          const j = cy * warp.w + cx;
          warp.data[j] = 3.2 * fbm(x / 300, y / 300 + time * 0.015);
          patch.data[j] = smoothstep(
            0.45,
            0.75,
            fbm(x / 230 + time * 0.008 + 9, y / 230),
          );
        }
      }
      let x0 = Number.POSITIVE_INFINITY;
      let y0 = Number.POSITIVE_INFINITY;
      let x1 = Number.NEGATIVE_INFINITY;
      let y1 = Number.NEGATIVE_INFINITY;
      for (const p of spine) {
        x0 = Math.min(x0, p.x);
        y0 = Math.min(y0, p.y);
        x1 = Math.max(x1, p.x);
        y1 = Math.max(y1, p.y);
      }
      const reach = length * 0.36;
      pose(time);
      const slicked = slicks.some((s) => s.k > 0 && time - s.t < SLICK_LIFE_S);
      grid.wet.fill(1);
      for (let y = 0; y < rows; y++) {
        const py = (y - 0.5) * cell;
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const px = (x - 0.5) * cell;
          // Swells run roughly across the screen, warped and broken up.
          const a = Math.sin(
            (py * 0.96 + px * 0.28) / (cell * 2.4) +
              warp.at(x, y) -
              time * 0.42,
          );
          let sea =
            smoothstep(0.9, 1, a) * (0.25 + 0.75 * patch.at(x, y)) * 0.42;
          if (sea > 0 && slicked) sea *= 1 - calmAt(px, py, time);
          const near =
            px > x0 - reach &&
            px < x1 + reach &&
            py > y0 - reach &&
            py < y1 + reach;
          const whale = near ? whaleAt(px, py, time) * (1 - 0.3 * sea) : 0;
          if (whale > 0.02 && whale >= sea) {
            grid.kind[i] = WHALE;
            grid.ground[i] = whale * WHALE_INK;
            grid.pigment[i] = rim ? HUAQING : INK;
          } else {
            grid.kind[i] = SEA;
            grid.ground[i] = sea * SEA_INK;
            grid.pigment[i] = INK;
          }
        }
      }
    },
    layout(view) {
      cols = view.cols;
      rows = view.rows;
      cell = view.cell;
      width = view.width;
      height = view.height;
      warp = coarseField(cols, rows);
      patch = coarseField(cols, rows);
      layoutWhale();
    },
    stamps(_env, emit) {
      for (const m of motes) {
        emit(mote, m.x, m.y, 0.22 * m.z, 0.6 + m.z * 0.4, INK);
      }
    },
    step(dt, env) {
      dt = Math.min(dt, 0.1);
      const time = env.time;
      const head = spine[0];
      if (!head) return;

      // Wander, keep near the middle, and come toward fresh ink.
      let turn = (noise(time * 0.02, 7.3) - 0.5) * 0.14;
      const R = Math.min(env.width, env.height) * 0.5;
      const dx = env.width / 2 - head.x;
      const dy = env.height / 2 - head.y;
      turn +=
        angleTo(heading, Math.atan2(dy, dx)) *
        0.2 *
        smoothstep(R * 0.25, R * 1.1, Math.hypot(dx, dy));
      for (const d of env.drops) {
        if (d.age < 10) {
          turn +=
            angleTo(heading, Math.atan2(d.y - head.y, d.x - head.x)) * 0.25;
          break;
        }
      }
      heading += clamp(turn, -0.5, 0.5) * dt;
      const speed = length * 0.06;
      head.x += Math.cos(heading) * speed * dt;
      head.y += Math.sin(heading) * speed * dt;
      for (let i = 1; i < SPINE; i++) {
        const p = spine[i] as Point;
        const q = spine[i - 1] as Point;
        const d = Math.hypot(p.x - q.x, p.y - q.y) || 1;
        p.x = q.x + ((p.x - q.x) / d) * seg;
        p.y = q.y + ((p.y - q.y) / d) * seg;
      }

      // The pointer over its back sends it down; it comes up again slowly.
      const p = env.pointer;
      let touched = false;
      if (p) {
        for (const s of spine) {
          if (Math.hypot(p.x - s.x, p.y - s.y) < girth * 2.5) {
            touched = true;
            break;
          }
        }
      }
      dive = touched
        ? Math.min(1, dive + dt * 1.5)
        : Math.max(0, dive - dt * 0.06);
      depth = clamp(
        0.5 +
          0.45 * Math.sin((time * 2 * Math.PI) / DEPTH_PERIOD - 0.9) +
          dive * 0.6,
        0,
        1,
      );
      beat = (time * 2 * Math.PI) / BEAT_PERIOD;

      // 鲸迹: flat water left behind the flukes when it swims shallow.
      if (depth < 0.5 && time - lastSlick > SLICK_EVERY_S) {
        const tail = spine[SPINE - 1] as Point;
        const s = slicks[nextSlick] as Slick;
        s.x = tail.x;
        s.y = tail.y;
        s.t = time;
        s.k = 1 - depth * 2;
        nextSlick = (nextSlick + 1) % SLICKS;
        lastSlick = time;
      }

      for (const m of motes) {
        m.x += (6 + 4 * m.z) * dt;
        m.y += Math.sin(time * 0.3 + m.phase) * 2 * dt;
        if (m.x > env.width + cell) {
          m.x = -cell;
          m.y = (m.y + env.height * 0.618) % env.height;
        }
      }
    },
  };
};
