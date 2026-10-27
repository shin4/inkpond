/** 春: 立春, 雨水, 惊蛰, 春分, 清明, 谷雨. */
import { clamp, fbm, hash2, noise, smoothstep } from "../../noise.js";
import { HUAQING, INK, YANZHI, ZHU } from "../../scene.js";
import {
  pool,
  ring,
  spawn,
  TAU,
  type TermSpec,
  type TermView,
  WATER,
} from "./term.js";

/** Distance to the nearest main crack, in noise units; turned off the lattice. */
const crackAt = (x: number, y: number) =>
  Math.abs(noise(x * 0.0095 + y * 0.0055, y * 0.0095 - x * 0.0055) - 0.5);

/** 立春 · 破冰: cracks run out through the ice; sprouts push up along them. */
export const lichun: TermSpec = {
  create({ glyph, rand }) {
    const sprout = glyph("芽");
    const sprouts = new Float32Array(92);
    let n = 0;
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let ox = 0;
    let oy = 0;
    let t0 = 0;
    const reach = (t: number) => (t - t0) * 80;
    return {
      cell(x, y, t, out) {
        const d = Math.hypot(x - ox, y - oy);
        const r = reach(t);
        const ridge = crackAt(x, y);
        const fine = Math.abs(
          noise(x * 0.024 + y * 0.016 + 50, y * 0.024 - x * 0.016) - 0.5,
        );
        const open = smoothstep(r, r - 90, d);
        // Ice in floes, with open water between.
        out.v = 0.08 + 0.3 * smoothstep(0.35, 0.75, fbm(x * 0.012, y * 0.012));
        out.wet = 0.4;
        if (open > 0 && (ridge < 0.045 || fine < 0.02)) {
          out.v = 0.98 * open;
          out.wet = 1;
        } else if (open > 0.5) out.v *= 0.55;
        const edge = ring(d, r, 14);
        if (edge > 0.2 && ridge < 0.1) {
          out.v = Math.max(out.v, edge);
          out.p = HUAQING;
        }
      },
      drop(x, y, t) {
        ox = x;
        oy = y;
        t0 = t;
      },
      layout(view) {
        v = view;
        ox = v.width * 0.42;
        oy = v.height * 0.55;
        t0 = 0;
        n = 0;
        for (let k = 0; k < 4000 && n < 46; k++) {
          const x = rand() * v.width;
          const y = rand() * v.height;
          if (crackAt(x, y) < 0.04) {
            sprouts[n * 2] = x;
            sprouts[n * 2 + 1] = y;
            n++;
          }
        }
      },
      stamps(t, emit) {
        const r = reach(t);
        for (let k = 0; k < n; k++) {
          const x = sprouts[k * 2] ?? 0;
          const y = sprouts[k * 2 + 1] ?? 0;
          const d = Math.hypot(x - ox, y - oy);
          if (d > r - 40) continue;
          const g = clamp((r - 40 - d) / 140, 0, 1);
          emit(sprout, x, y - g * 8, g * 0.9, 0.6 + g * 0.6, HUAQING);
        }
      },
      step(_dt, t) {
        if (reach(t) > Math.hypot(v.width, v.height) + 260) {
          t0 = t;
          ox = v.width * (0.2 + rand() * 0.6);
          oy = v.height * (0.3 + rand() * 0.5);
        }
      },
    };
  },
  id: "lichun",
  loose: "芽",
  ramps: [["丶", "冫", "二", "冰", "冻", "凌", "凇", "凝"]],
  warm: 3,
};

/** 雨水 · 斜雨: 雨 falls on the slant; each drop rings the water below. */
export const yushui: TermSpec = {
  create({ glyph, rand }) {
    const rain = glyph("雨");
    const dot = glyph("丶");
    let drops = pool(0);
    let rings = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let wind = 0.25;
    let acc = 0;
    let shore = 0;
    return {
      cell(x, y, t, out) {
        if (y < shore) {
          out.v = 0.1 * fbm(x * 0.01 + t * 0.1, y * 0.02);
          return;
        }
        let r = 0;
        for (const p of rings) {
          if (p.life <= 0 || Math.abs(x - p.x) > 120) continue;
          const age = t - p.a;
          const d = Math.hypot(x - p.x, (y - p.y) * 2.6);
          r += Math.exp(-age * 1.5) * 0.75 * ring(d, age * 55, 10);
        }
        out.v = 0.16 + 0.12 * noise(x * 0.03, y * 0.09 + t * 0.4) + r;
        if (r > 0.22) out.p = HUAQING;
      },
      layout(view) {
        v = view;
        shore = v.height * 0.66;
        drops = pool(110);
        rings = pool(40);
      },
      stamps(_t, emit) {
        const n = Math.hypot(wind, 1);
        const ux = (wind / n) * 16;
        const uy = 16 / n;
        for (const d of drops) {
          if (d.life <= 0) continue;
          emit(rain, d.x, d.y, 0.85, 0.75, INK);
          emit(dot, d.x - ux, d.y - uy, 0.55, 0.6, HUAQING);
          emit(dot, d.x - ux * 2, d.y - uy * 2, 0.3, 0.6, HUAQING);
        }
      },
      step(dt, t, env) {
        const target = env.pointer
          ? (env.pointer.x / v.width - 0.5) * 1.3
          : 0.25 + Math.sin(t * 0.3) * 0.1;
        wind += (target - wind) * Math.min(1, dt * 2);
        acc += (dt * v.width) / 14;
        for (; acc > 1; acc--) {
          const d = spawn(drops);
          if (!d || d.life > 0) break;
          d.life = 1;
          d.x = rand() * (v.width + 300) - 150;
          d.y = -20 - rand() * 60;
          d.vy = 360 + rand() * 220;
          d.a = shore + rand() * (v.height - shore);
        }
        for (const d of drops) {
          if (d.life <= 0) continue;
          d.y += d.vy * dt;
          d.x += d.vy * wind * dt;
          if (d.y < d.a) continue;
          d.life = 0;
          const r = spawn(rings);
          if (!r) continue;
          r.life = 2.2;
          r.x = d.x;
          r.y = d.a;
          r.a = t;
        }
        for (const r of rings) r.life -= dt;
      },
    };
  },
  id: "yushui",
  loose: "雨丶",
  ramps: [WATER],
  warm: 3,
};

/** 惊蛰 · 惊雷: lightning splits the frame and shakes the 虫 out of the ground. */
export const jingzhe: TermSpec = {
  create({ glyph, rand }) {
    const spark = glyph("电");
    const bug = glyph("虫");
    /** The bolt: 65 points by midpoint displacement, top to ground. */
    const bolt = new Float32Array(130);
    let boltAt = -9;
    let bugs = pool(0);
    let craters = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let ground = 0;
    let next = 0.8;
    let flash = 0;

    const strike = (x: number, t: number) => {
      bolt[0] = x + (rand() - 0.5) * v.width * 0.3;
      bolt[1] = 0;
      bolt[128] = x;
      bolt[129] = ground;
      for (let s = 32, off = v.width * 0.12; s >= 1; s /= 2, off *= 0.55) {
        for (let i = s; i < 64; i += s * 2) {
          bolt[i * 2] =
            ((bolt[(i - s) * 2] ?? 0) + (bolt[(i + s) * 2] ?? 0)) / 2 +
            (rand() - 0.5) * off;
          bolt[i * 2 + 1] =
            ((bolt[(i - s) * 2 + 1] ?? 0) + (bolt[(i + s) * 2 + 1] ?? 0)) / 2;
        }
      }
      boltAt = t;
      flash = 1;
      const c = spawn(craters);
      if (c) {
        c.life = 4;
        c.x = x;
        c.a = t;
      }
      for (let k = 0; k < 24; k++) {
        const b = spawn(bugs);
        if (!b) break;
        b.life = 1;
        b.x = x;
        b.y = ground;
        b.vx = (rand() - 0.5) * 420;
        b.vy = -160 - rand() * 360;
      }
      next = t + 2.6 + rand() * 2;
    };

    return {
      cell(x, y, t, out) {
        const g = ground + 14 * (noise(x * 0.02, 3) - 0.5);
        const earth = y > g;
        let val = earth
          ? 0.12 + 0.55 * smoothstep(0.4, 0.75, fbm(x * 0.02, y * 0.04))
          : 0.06 * fbm(x * 0.01, y * 0.02 + t * 0.05);
        out.wet = earth ? 0.3 : 1;
        for (const c of craters) {
          if (c.life <= 0) continue;
          const age = t - c.a;
          const d = Math.hypot(x - c.x, (y - ground) * 1.4);
          const shock = ring(d, age * 150, 26) * Math.exp(-age * 1.2);
          if (shock > 0.25) out.p = ZHU;
          val += shock * 0.7;
          if (earth) {
            const hole = smoothstep(0, 70 * (1 - Math.exp(-age * 4)), d);
            val *= Math.min(
              1,
              0.35 + 0.65 * hole + 0.65 * smoothstep(2, 3.5, age),
            );
          }
        }
        if (flash > 0) val = val * (1 - flash) + (1 - val) * flash * 0.7;
        out.v = val;
      },
      drop(x, _y, t) {
        strike(x, t);
      },
      layout(view) {
        v = view;
        ground = v.height * 0.6;
        bugs = pool(120);
        craters = pool(4);
        boltAt = -9;
        next = 0.8;
      },
      stamps(t, emit) {
        const age = t - boltAt;
        if (age < 0.4) {
          const a = 1 - age / 0.4;
          let left = 0;
          for (let i = 1; i < 65; i++) {
            const px = bolt[(i - 1) * 2] ?? 0;
            const py = bolt[(i - 1) * 2 + 1] ?? 0;
            const qx = bolt[i * 2] ?? 0;
            const qy = bolt[i * 2 + 1] ?? 0;
            const len = Math.hypot(qx - px, qy - py);
            for (; left < len; left += 14) {
              const f = left / len;
              emit(
                spark,
                px + (qx - px) * f,
                py + (qy - py) * f,
                a,
                0.9,
                i % 3 ? ZHU : INK,
              );
            }
            left -= len;
          }
        }
        for (const b of bugs)
          if (b.life > 0) emit(bug, b.x, b.y, b.life, 0.7, INK);
      },
      step(dt, t) {
        if (t > next) strike(v.width * (0.15 + rand() * 0.7), t);
        flash = Math.max(0, flash - dt * 4);
        for (const c of craters) c.life -= dt;
        for (const b of bugs) {
          if (b.life <= 0) continue;
          b.vy += 520 * dt;
          b.x += b.vx * dt;
          b.y += b.vy * dt;
          if (b.y > ground + 20 && b.vy > 0) {
            b.vy *= -0.3;
            b.vx *= 0.6;
          }
          b.life -= dt * 0.45;
        }
      },
    };
  },
  id: "jingzhe",
  loose: "电虫",
  ramps: [["丶", "土", "虫", "地", "虺", "蛰", "蠢", "震"]],
  warm: 1.5,
};

/** 春分 · 昼夜平分: day and night split the frame along a living seam. */
export const chunfen: TermSpec = {
  create({ glyph, rand }) {
    const swallow = glyph("燕");
    const dot = glyph("丶");
    let birds = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let seam = 0;
    const line = (y: number, t: number) =>
      seam +
      Math.sin(y * 0.012 + t * 0.8) * 26 +
      Math.sin(y * 0.031 - t * 1.3) * 10;
    let now = 0;
    return {
      cell(x, y, t, out) {
        const l = line(y, t);
        out.v =
          x > l
            ? 0.2 +
              0.55 *
                smoothstep(0.35, 0.72, fbm(x * 0.012 + t * 0.05, y * 0.015))
            : 0.08 + 0.08 * fbm(x * 0.02 - t * 0.05, y * 0.02);
        const e = ring(x, l, 9);
        if (e > 0.3) {
          out.v = Math.max(out.v, e);
          out.p = ZHU;
        }
      },
      layout(view) {
        v = view;
        seam = v.width / 2;
        birds = pool(7);
        birds.forEach((b, i) => {
          b.life = 1;
          b.x = rand() * v.width;
          b.a = v.height * (0.15 + rand() * 0.7);
          b.vx = (50 + rand() * 60) * (i % 2 ? 1 : -1);
          b.b = rand() * TAU;
        });
      },
      stamps(t, emit) {
        for (const b of birds) {
          const night = b.x > line(b.y, t);
          const dir = b.vx > 0 ? 1 : -1;
          emit(swallow, b.x, b.y, 0.95, 1.15, night ? ZHU : INK);
          emit(dot, b.x - dir * 16, b.y + 2, 0.4, 0.7, night ? ZHU : INK);
        }
      },
      step(dt, t, env) {
        now = t;
        const target = env.pointer
          ? env.pointer.x
          : v.width / 2 + Math.sin(now * 0.3) * v.width * 0.08;
        seam += (target - seam) * Math.min(1, dt * 2.5);
        for (const b of birds) {
          b.x += b.vx * dt;
          if (b.x > v.width + 30) b.x = -30;
          if (b.x < -30) b.x = v.width + 30;
          b.y = b.a + Math.sin(b.x * 0.02 + b.b) * 26;
        }
      },
    };
  },
  id: "chunfen",
  loose: "燕丶",
  ramps: [["一", "二", "分", "平", "昼", "夜", "暝", "黯"]],
  warm: 1,
};

/** 清明 · 柳丝: willow strands sway and part around the pointer; a kite rides above. */
export const qingming: TermSpec = {
  create({ glyph, rand }) {
    const willow = glyph("柳");
    const thread = glyph("丝");
    const kite = glyph("鸢");
    const dot = glyph("丶");
    let strands = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let px = -1e4;
    let py = -1e4;
    return {
      cell(x, y, t, out, cx, cy) {
        out.v = 0.1 * fbm(x * 0.015 - t * 0.05, y * 0.01);
        if (hash2(cx, cy + Math.floor(t * 5) * 131) > 0.988) {
          out.v = 0.4;
          out.p = HUAQING;
        }
      },
      layout(view) {
        v = view;
        const n = Math.max(5, Math.floor(v.width / 56));
        strands = pool(n);
        strands.forEach((s, i) => {
          s.x = ((i + 0.3 + rand() * 0.4) * v.width) / n;
          s.a = v.height * (0.3 + rand() * 0.35);
          s.b = rand() * TAU;
        });
      },
      stamps(t, emit) {
        const step = Math.max(14, v.cell);
        for (const s of strands) {
          for (let y = 0, k = 0; y < s.a; y += step, k++) {
            const f = y / s.a;
            let x =
              s.x +
              Math.sin(t * 1.1 + s.b + f * 1.6) * f ** 1.6 * 28 +
              Math.sin(t * 0.4) * f * 10;
            const d = Math.hypot(x - px, y - py);
            if (d < 100) x += (x >= px ? 1 : -1) * (100 - d) * 0.5 * f;
            const top = k % 4 === 0;
            emit(
              top ? willow : thread,
              x,
              y + 6,
              0.85 - f * 0.35,
              0.75,
              top ? INK : HUAQING,
            );
          }
        }
        const kx = v.width * 0.74 + Math.sin(t * 0.4) * 40;
        const ky = v.height * 0.2 + Math.sin(t * 0.7) * 18;
        for (let j = 1; j < 24; j++) {
          const f = j / 24;
          emit(
            dot,
            kx + (v.width * 0.4 - kx) * f,
            ky + (v.height - ky) * f + Math.sin(f * Math.PI) * 30,
            0.35,
            0.5,
            INK,
          );
        }
        emit(kite, kx, ky, 0.95, 1.5, ZHU);
      },
      step(_dt, _t, env) {
        px = env.pointer?.x ?? -1e4;
        py = env.pointer?.y ?? -1e4;
      },
    };
  },
  id: "qingming",
  loose: "柳丝鸢丶",
  ramps: [["丶", "冫", "氵", "雨", "清", "明", "霁", "霭"]],
  warm: 1,
};

/** 谷雨 · 牡丹: peonies open as polar petal fields; petals drift off in the rain. */
export const guyu: TermSpec = {
  create({ glyph, rand }) {
    const petal = glyph("瓣");
    let blooms = pool(0);
    let petals = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    /** x, y, R in b's place, birth in a, petal count in vx, turn in vy. */
    const open = (
      p: (typeof blooms)[number],
      x: number,
      y: number,
      t: number,
    ) => {
      p.x = x;
      p.y = y;
      p.b = Math.min(v.width, v.height) * (0.16 + rand() * 0.1);
      p.a = t;
      p.vx = 5 + Math.floor(rand() * 2);
      p.vy = rand() * TAU;
      p.life = 1;
    };
    return {
      cell(x, y, t, out) {
        let val = 0.06 * fbm(x * 0.02, y * 0.01 - t * 0.3);
        let pig = INK;
        for (const b of blooms) {
          const age = t - b.a;
          const g = smoothstep(0, 4, age) * (1 - smoothstep(13, 16, age));
          if (g <= 0) continue;
          const dx = x - b.x;
          const dy = y - b.y;
          const d = Math.hypot(dx, dy);
          if (d > b.b * 1.05) continue;
          if (d < b.b * 0.13 * g) {
            val = 0.95;
            pig = ZHU;
            break;
          }
          const th = Math.atan2(dy, dx);
          const spin = b.vy + age * 0.06;
          const r1 =
            b.b *
            g *
            (0.55 + 0.45 * Math.abs(Math.cos((b.vx * th) / 2 + spin)));
          const r2 =
            b.b *
            g *
            0.62 *
            (0.6 +
              0.4 * Math.abs(Math.cos((b.vx * th) / 2 - spin * 1.5 + 0.6)));
          let w = 0;
          if (d < r1) w = 0.3 + 0.6 * smoothstep(r1 * 0.7, r1, d);
          if (d < r2) w = Math.max(w, 0.35 + 0.6 * smoothstep(r2 * 0.6, r2, d));
          if (w > val) {
            val = w;
            pig = YANZHI;
          }
        }
        out.v = val;
        out.p = pig;
      },
      drop(x, y, t) {
        let oldest = blooms[0];
        for (const b of blooms) if (oldest && b.a < oldest.a) oldest = b;
        if (oldest) open(oldest, x, y, t);
      },
      layout(view) {
        v = view;
        blooms = pool(3);
        petals = pool(40);
        blooms.forEach((b, i) => {
          open(
            b,
            v.width * (0.2 + 0.3 * i + rand() * 0.1),
            v.height * (0.35 + rand() * 0.3),
            -rand() * 5,
          );
        });
      },
      stamps(_t, emit) {
        for (const p of petals)
          if (p.life > 0) emit(petal, p.x, p.y, p.life * 0.9, 0.8, YANZHI);
      },
      step(dt, t) {
        for (const b of blooms) {
          if (t - b.a > 16)
            open(
              b,
              v.width * (0.15 + rand() * 0.7),
              v.height * (0.25 + rand() * 0.5),
              t,
            );
          if (t - b.a > 3 && rand() < dt * 2.5) {
            const p = spawn(petals);
            if (p && p.life <= 0) {
              p.life = 1;
              p.x = b.x + (rand() - 0.5) * b.b;
              p.y = b.y;
              p.vy = 20 + rand() * 20;
              p.b = rand() * TAU;
            }
          }
        }
        for (const p of petals) {
          if (p.life <= 0) continue;
          p.y += p.vy * dt;
          p.x += Math.sin(t + p.b) * 20 * dt;
          p.life -= dt * 0.12;
          if (p.y > v.height + 20) p.life = 0;
        }
      },
    };
  },
  id: "guyu",
  loose: "瓣",
  ramps: [["丶", "卜", "艹", "花", "芳", "葩", "蕊", "繁"]],
  warm: 4,
};
