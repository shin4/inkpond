/** 秋: 立秋, 处暑, 白露, 秋分, 寒露, 霜降. */
import { fbm, hash2, noise, smoothstep } from "../../noise.js";
import { HUAQING, INK, ZHE, ZHU } from "../../scene.js";
import {
  angleTo,
  pool,
  ring,
  spawn,
  TAU,
  type TermSpec,
  type TermView,
} from "./term.js";

/** 立秋 · 一叶知秋: one big leaf falls through the empty frame and rings the water. */
export const liqiu: TermSpec = {
  create({ glyph, rand }) {
    const leafGlyph = glyph("叶");
    let rings = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let shore = 0;
    /** The leaf: x0 in a, phase in b, fall start in vx, landing in vy (<0 aloft). */
    const leaf = { a: 0, b: 0, life: 1, vx: 0, vy: -1, x: 0, y: 0 };
    const fall = (t: number) => {
      leaf.a = v.width * (0.35 + rand() * 0.35);
      leaf.b = rand() * TAU;
      leaf.vx = t;
      leaf.vy = -1;
      leaf.x = leaf.a;
      leaf.y = v.height * 0.12;
    };
    return {
      cell(x, y, t, out) {
        const bx = v.width * 0.55;
        if (x > bx && y < v.height * 0.3) {
          const by = v.height * 0.06 + (x - bx) * 0.18 + Math.sin(x * 0.03) * 6;
          const thick = 3 + (6 * (x - bx)) / (v.width - bx);
          if (Math.abs(y - by) < thick) {
            out.v = 0.85;
            out.wet = 0.2;
            return;
          }
          if (Math.abs(y - by) < 46 && fbm(x * 0.04, y * 0.05) > 0.56) {
            out.v = 0.45;
            out.p = ZHE;
            out.wet = 0.2;
            return;
          }
        }
        if (y < shore) return;
        let val = 0.12 + 0.06 * noise(x * 0.02, y * 0.08 + t * 0.2);
        for (const r of rings) {
          if (r.life <= 0) continue;
          const age = t - r.a;
          val +=
            0.8 *
            Math.exp(-age * 0.7) *
            ring(Math.hypot(x - r.x, (y - r.y) * 3), age * 70, 12);
        }
        out.v = val;
      },
      layout(view) {
        v = view;
        shore = v.height * 0.76;
        rings = pool(3);
        fall(0);
      },
      stamps(t, emit) {
        const a = leaf.vy < 0 ? 0.95 : 0.95 * (1 - (t - leaf.vy) / 5);
        emit(leafGlyph, leaf.x, leaf.y, a, 2.2, ZHE);
      },
      step(dt, t, env) {
        for (const r of rings) r.life -= dt;
        if (leaf.vy >= 0) {
          leaf.x += 6 * dt;
          if (t - leaf.vy > 5) fall(t);
          return;
        }
        const ph = (t - leaf.vx) * 1.4 + leaf.b;
        leaf.y += (26 + Math.cos(ph) * 14) * dt;
        leaf.x = leaf.a + Math.sin(ph) * 64;
        const p = env.pointer;
        if (p && Math.hypot(p.x - leaf.x, p.y - leaf.y) < 130) {
          leaf.a += (leaf.x > p.x ? 1 : -1) * 90 * dt;
        }
        if (leaf.y < shore) return;
        leaf.vy = t;
        const r = spawn(rings);
        if (!r) return;
        r.life = 5;
        r.x = leaf.x;
        r.y = leaf.y;
        r.a = t;
      },
    };
  },
  id: "liqiu",
  loose: "叶",
  ramps: [["丶", "一", "冫", "水", "汀", "凉", "清", "澈"]],
  warm: 2,
};

/** 处暑 · 暑退: the heat front is pushed off the frame; cool water takes its place. */
export const chushu: TermSpec = {
  create({ glyph, rand }) {
    const fire = glyph("火");
    const hawk = glyph("鹰");
    let sparks = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let front = 0;
    let px = -1e4;
    let py = -1e4;
    return {
      cell(x, y, t, out) {
        const fx = front + (fbm(y * 0.01, t * 0.3) - 0.5) * 180;
        const hot = x > fx && Math.hypot(x - px, y - py) > 110;
        if (hot) {
          out.v =
            x - fx < 26
              ? 0.95
              : 0.08 +
                0.75 *
                  smoothstep(0.45, 0.78, fbm(x * 0.015 + t * 0.1, y * 0.015));
          out.p = ZHU;
        } else {
          out.v = 0.04 + 0.16 * fbm(x * 0.015 - t * 0.05, y * 0.015);
          out.p = HUAQING;
        }
      },
      layout(view) {
        v = view;
        sparks = pool(40);
      },
      stamps(t, emit) {
        for (const s of sparks)
          if (s.life > 0)
            emit(fire, s.x, s.y, s.life, 0.7, s.life > 0.5 ? ZHU : ZHE);
        emit(
          hawk,
          v.width * 0.5 + Math.cos(t * 0.4) * v.width * 0.28,
          v.height * 0.22 + Math.sin(t * 0.8) * 30,
          0.95,
          1.3,
          INK,
        );
      },
      step(dt, t, env) {
        px = env.pointer?.x ?? -1e4;
        py = env.pointer?.y ?? -1e4;
        front = ((t * 50) % (v.width + 300)) - 150;
        if (rand() < dt * 14) {
          const s = spawn(sparks);
          if (s && s.life <= 0) {
            s.life = 1;
            s.x = front + (rand() - 0.5) * 40;
            s.y = rand() * v.height;
          }
        }
        for (const s of sparks) {
          if (s.life <= 0) continue;
          s.y -= 30 * dt;
          s.x -= 20 * dt;
          s.life -= dt * 0.7;
        }
      },
    };
  },
  id: "chushu",
  loose: "火鹰",
  ramps: [["丶", "一", "冫", "凉", "肃", "暑", "炎", "焱"]],
  warm: 3,
};

/** 白露 · 露珠: dew swells on the grass, then runs down leaving a trail. */
export const bailu: TermSpec = {
  create({ glyph, rand }) {
    const bead = glyph("珠");
    const dot = glyph("丶");
    const TRAIL = 10;
    let drops = pool(0);
    let trails = new Float32Array(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    /** A new bead: radius in b, growth rate in a, vy 0 while it clings. */
    const bead0 = (d: (typeof drops)[number], i: number, y: number) => {
      d.x = rand() * v.width;
      d.y = y;
      d.b = 14 + rand() * 16;
      d.a = 0.6 + rand() * 0.8;
      d.vy = 0;
      d.life = 0;
      trails.fill(-1e4, i * TRAIL * 2, (i + 1) * TRAIL * 2);
    };
    return {
      cell(x, y, _t, out) {
        const w = (x * 0.9 - y * 0.42) * 0.045;
        out.v =
          smoothstep(
            0.94,
            1,
            Math.abs(Math.sin(w + noise(x * 0.01, y * 0.01) * 3)),
          ) * 0.42;
        out.wet = 0.6;
        for (const d of drops) {
          if (d.vy !== 0) continue;
          const dist = Math.hypot(x - d.x, y - d.y);
          if (dist > d.b) continue;
          if (
            Math.hypot(x - (d.x - d.b * 0.35), y - (d.y - d.b * 0.35)) <
            d.b * 0.3
          ) {
            out.v = 0;
            return;
          }
          out.v = 0.35 + 0.6 * smoothstep(d.b * 0.45, d.b, dist);
          out.p = HUAQING;
          out.wet = 1;
          return;
        }
      },
      layout(view) {
        v = view;
        drops = pool(14);
        trails = new Float32Array(14 * TRAIL * 2);
        drops.forEach((d, i) => {
          bead0(d, i, rand() * v.height);
        });
      },
      stamps(_t, emit) {
        drops.forEach((d, i) => {
          if (d.vy === 0) return;
          for (let k = 0; k < TRAIL; k++) {
            const x = trails[(i * TRAIL + k) * 2] ?? -1e4;
            if (x < -1e3) continue;
            emit(
              dot,
              x,
              trails[(i * TRAIL + k) * 2 + 1] ?? 0,
              0.5 * ((k + 1) / TRAIL),
              0.7,
              HUAQING,
            );
          }
          emit(bead, d.x, d.y, 0.95, Math.min(2.4, d.b / 20), HUAQING);
        });
      },
      step(dt, _t, env) {
        const p = env.pointer;
        drops.forEach((d, i) => {
          if (d.vy === 0) {
            d.b += d.a * dt * 2.2;
            if (d.b > 56 || (p && Math.hypot(p.x - d.x, p.y - d.y) < d.b + 12))
              d.vy = 1;
            return;
          }
          d.vy += 160 * dt;
          d.y += d.vy * dt;
          d.x += d.vy * 0.25 * dt;
          d.life += dt;
          if (d.life > 0.06) {
            d.life = 0;
            trails.copyWithin(
              i * TRAIL * 2,
              i * TRAIL * 2 + 2,
              (i + 1) * TRAIL * 2,
            );
            trails[(i + 1) * TRAIL * 2 - 2] = d.x;
            trails[(i + 1) * TRAIL * 2 - 1] = d.y - d.b * 0.6;
          }
          if (d.y - d.b > v.height) bead0(d, i, rand() * v.height * 0.8);
        });
      },
    };
  },
  id: "bailu",
  loose: "珠丶",
  ramps: [["丶", "冫", "氵", "白", "泊", "珠", "露", "滴"]],
  warm: 3,
};

/** 秋分 · 平分秋色: a full moon split by a slowly turning diameter. */
export const qiufen: TermSpec = {
  create() {
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let ang = 0;
    return {
      cell(x, y, t, out, cx, cy) {
        const dx = x - v.width / 2;
        const dy = y - v.height / 2;
        const d = Math.hypot(dx, dy);
        const R = Math.min(v.width, v.height) * 0.36;
        const across = -dx * Math.sin(ang) + dy * Math.cos(ang);
        if (d < R) {
          out.wet = 0.4;
          if (Math.abs(across) < v.cell * 0.45) {
            out.v = 1;
            out.p = ZHU;
            return;
          }
          if (across > 0) out.v = 0.66 + 0.25 * fbm(x * 0.03, y * 0.03);
          else {
            out.v = 0.22 + 0.22 * fbm(x * 0.03 + 9, y * 0.03);
            out.p = ZHE;
          }
          out.v = Math.max(out.v, ring(d, R, 6) * 0.9);
          return;
        }
        if (Math.abs(across) < v.cell * 0.3 && d < R * 1.45) {
          out.v = 0.4 * (1 - (d - R) / (R * 0.45));
          out.p = ZHU;
          return;
        }
        const star =
          hash2(cx, cy) > 0.99 ? 0.3 + 0.25 * Math.sin(t * 2 + cx) : 0;
        out.v = ring(d, R, 6) * 0.9 + star;
      },
      layout(view) {
        v = view;
      },
      stamps() {},
      step(dt, t, env) {
        const p = env.pointer;
        const target = p
          ? Math.atan2(p.y - v.height / 2, p.x - v.width / 2)
          : (t * TAU) / 24;
        ang += angleTo(ang, target) * Math.min(1, dt * (p ? 4 : 10));
      },
    };
  },
  id: "qiufen",
  loose: "",
  ramps: [["丶", "一", "夕", "月", "肃", "秋", "爽", "穆"]],
  warm: 1,
};

/** 寒露 · 雁阵: a skein of geese morphs between the 人 and 一 formations. */
export const hanlu: TermSpec = {
  create({ glyph }) {
    const goose = glyph("雁");
    let geese = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let lx = 0;
    let ly = 0;
    let lift = 0;
    const slot = (i: number, m: number, out: { x: number; y: number }) => {
      const k = Math.ceil(i / 2);
      const side = i % 2 ? 1 : -1;
      const vx = lx - k * 24;
      const vy = ly + side * k * 15;
      out.x = vx + (lx - i * 22 - vx) * m;
      out.y = vy + (ly - vy) * m;
    };
    const at = { x: 0, y: 0 };
    return {
      cell(x, y, t, out) {
        const cloud =
          smoothstep(0.6, 0.8, fbm(x * 0.008 - t * 0.03, y * 0.02)) *
          0.3 *
          (1 - y / v.height);
        const mum =
          smoothstep(
            0.5,
            0.78,
            fbm(x * 0.03, y * 0.05 + Math.sin(t * 0.8 + x * 0.01) * 0.15),
          ) * smoothstep(v.height * 0.7, v.height, y);
        if (mum > 0.1) {
          out.v = 0.3 + mum * 0.7;
          out.p = ZHE;
          out.wet = 0.4;
        } else out.v = cloud + 0.04;
      },
      layout(view) {
        v = view;
        lx = v.width * 0.3;
        ly = v.height * 0.35;
        geese = pool(13);
        geese.forEach((g, i) => {
          slot(i, 0.5, at);
          g.x = at.x;
          g.y = at.y;
        });
      },
      stamps(t, emit) {
        geese.forEach((g, i) => {
          emit(goose, g.x, g.y + Math.sin(t * 5 + i) * 1.5, 0.92, 1, INK);
        });
      },
      step(dt, t, env) {
        lx += 55 * dt;
        if (lx > v.width + 320) lx = -60;
        const p = env.pointer;
        const push =
          p && Math.abs(p.x - (lx - 120)) < 200 ? (p.y > ly ? -1 : 1) : 0;
        lift += (push * v.height * 0.18 - lift) * Math.min(1, dt * 1.5);
        ly = v.height * 0.33 + Math.sin(t * 0.25) * v.height * 0.06 + lift;
        const m = 0.5 + 0.5 * Math.sin(t * 0.35);
        geese.forEach((g, i) => {
          slot(i, m, at);
          g.x += (at.x - g.x) * Math.min(1, dt * 3);
          g.y += (at.y - g.y) * Math.min(1, dt * 3);
        });
      },
    };
  },
  id: "hanlu",
  loose: "雁",
  ramps: [["丶", "一", "二", "云", "寒", "露", "菊", "霜"]],
  warm: 1,
};

/** 霜降 · 霜花: six-armed frost grows in from the edges; maple leaves fall in 朱. */
export const shuangjiang: TermSpec = {
  create({ glyph, rand }) {
    const maple = glyph("枫");
    const SPOTS = [
      [0.02, 0.05],
      [0.98, 0.1],
      [0.05, 0.95],
      [0.95, 0.92],
      [0.5, 1.02],
      [0.55, -0.02],
    ] as const;
    let seeds = pool(0);
    let leaves = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let px = -1e4;
    let py = -1e4;
    let now = 0;
    return {
      cell(x, y, _t, out) {
        let val = 0;
        let pig = INK;
        for (const s of seeds) {
          const age = now - s.a;
          const G =
            smoothstep(0, 16, age) * (1 - smoothstep(23, 26, age)) * s.b;
          if (G <= 0) continue;
          const dx = x - s.x;
          const dy = y - s.y;
          const d = Math.hypot(dx, dy);
          if (d > G) continue;
          const a = Math.atan2(dy, dx) + s.vx;
          const arm = Math.abs(Math.cos(3 * a)) ** 14;
          // Side branches leave each arm at 60°, shorter the further out.
          const sub = Math.abs(Math.cos(3 * a + 1.05)) ** 16 * 0.5 * (d / G);
          const len =
            G *
            (0.1 + 0.9 * Math.max(arm, sub)) *
            (0.85 + 0.3 * noise(d * 0.05, a * 3));
          if (d >= len) continue;
          const w = 0.25 + 0.5 * (d / len) + 0.25 * ring(d, len, 9);
          if (w > val) {
            val = w;
            pig = d / len > 0.75 ? HUAQING : INK;
          }
        }
        const warm = Math.hypot(x - px, y - py);
        if (warm < 110) val *= warm / 110;
        out.v = val;
        out.p = pig;
        out.wet = 0.5;
      },
      layout(view) {
        v = view;
        seeds = pool(SPOTS.length);
        seeds.forEach((s, i) => {
          s.x = (SPOTS[i]?.[0] ?? 0) * v.width;
          s.y = (SPOTS[i]?.[1] ?? 0) * v.height;
          s.a = -i * 1.5;
          s.vx = rand() * TAU;
          s.b = Math.min(v.width, v.height) * (0.3 + rand() * 0.14);
        });
        leaves = pool(12);
        for (const l of leaves) {
          l.x = rand() * v.width;
          l.y = rand() * v.height;
          l.vy = 30 + rand() * 30;
          l.b = rand() * TAU;
        }
      },
      stamps(_t, emit) {
        for (const l of leaves) emit(maple, l.x, l.y, 0.92, 1.15, ZHU);
      },
      step(dt, t, env) {
        now = t;
        px = env.pointer?.x ?? -1e4;
        py = env.pointer?.y ?? -1e4;
        for (const s of seeds) {
          if (t - s.a > 26) {
            s.a = t;
            s.vx = rand() * TAU;
          }
        }
        for (const l of leaves) {
          l.y += l.vy * dt;
          l.x += Math.sin(t * 1.2 + l.b) * 30 * dt;
          if (l.y > v.height + 20) {
            l.y = -20;
            l.x = rand() * v.width;
          }
        }
      },
    };
  },
  id: "shuangjiang",
  loose: "枫",
  ramps: [["丶", "冫", "冰", "凇", "霜", "凛", "凝", "霰"]],
  warm: 10,
};
