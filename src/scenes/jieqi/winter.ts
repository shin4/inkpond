/** 冬: 立冬, 小雪, 大雪, 冬至, 小寒, 大寒. */
import { fbm, noise, smoothstep } from "../../noise.js";
import { HUAQING, INK, YANZHI, ZHE, ZHU } from "../../scene.js";
import {
  pool,
  ring,
  spawn,
  TAU,
  type TermSpec,
  type TermView,
  WATER,
} from "./term.js";

/** 立冬 · 水始冰: the waves slow until they freeze in place, crack and thaw. */
export const lidong: TermSpec = {
  create({ rand }) {
    let sources = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let phase = 0;
    let freeze = 0;
    let crack = 0;
    let count = 3;
    return {
      cell(x, y, _t, out) {
        let w = 0;
        for (const s of sources) {
          if (s.life <= 0) continue;
          const d = Math.hypot(x - s.x, y - s.y);
          w += Math.sin(d * 0.06 - phase) / (1 + d * 0.004);
        }
        w = Math.max(0, Math.min(1, 0.5 + w / count));
        out.v = 0.02 + 0.88 * w ** 2.5;
        if (freeze > 0.5) {
          out.k = 1;
          out.p = HUAQING;
          out.wet = 0.3;
        }
        if (
          crack > 0 &&
          Math.abs(noise(x * 0.02, y * 0.02) - 0.5) < 0.02 * crack
        ) {
          out.v = 0.95;
          out.p = INK;
        }
      },
      drop(x, y) {
        const s = spawn(sources);
        if (!s) return;
        s.life = 1 + rand();
        s.x = x;
        s.y = y;
      },
      layout(view) {
        v = view;
        sources = pool(5);
        const at = [
          [0.3, 0.4],
          [0.7, 0.6],
          [0.5, 0.15],
        ];
        at.forEach(([fx = 0, fy = 0], i) => {
          const s = sources[i];
          if (!s) return;
          s.life = 1;
          s.x = fx * v.width;
          s.y = fy * v.height;
        });
      },
      stamps() {},
      step(dt, t) {
        const c = (t % 18) / 18;
        freeze = smoothstep(0.15, 0.65, c) * (1 - smoothstep(0.9, 1, c));
        crack = smoothstep(0.62, 0.85, c) * (1 - smoothstep(0.9, 1, c));
        phase += dt * 3.2 * (1 - freeze);
        count = 0;
        for (const s of sources) if (s.life > 0) count++;
        count = Math.max(1, count);
      },
    };
  },
  id: "lidong",
  loose: "",
  ramps: [WATER, ["丶", "冫", "冫", "冱", "冰", "冻", "凌", "凛"]],
  warm: 1,
};

/** 小雪 · 细雪: sparse flakes at three depths; the pointer breathes them aside. */
export const xiaoxue: TermSpec = {
  create({ glyph, rand }) {
    const snow = glyph("雪");
    const dot = glyph("丶");
    let flakes = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    return {
      cell(x, y, t, out) {
        out.v =
          smoothstep(v.height - 30 - 14 * noise(x * 0.01, 0), v.height, y) *
            0.6 +
          0.04 * fbm(x * 0.01, y * 0.01 + t * 0.03);
      },
      layout(view) {
        v = view;
        flakes = pool(70);
        for (const f of flakes) {
          f.x = rand() * v.width;
          f.y = rand() * v.height;
          f.a = rand();
          f.b = rand() * TAU;
        }
      },
      stamps(t, emit) {
        for (const f of flakes) {
          emit(
            f.a > 0.35 ? snow : dot,
            f.x,
            f.y + Math.sin(t + f.b) * 2,
            0.3 + 0.6 * f.a,
            0.45 + f.a * 0.8,
            INK,
          );
        }
      },
      step(dt, t, env) {
        const p = env.pointer;
        for (const f of flakes) {
          f.y += (10 + f.a * 26) * dt;
          f.x += (Math.sin(t * 0.6 + f.b) * 10 * (0.4 + f.a) + f.vx) * dt;
          f.vx *= 0.96;
          if (p) {
            const dx = f.x - p.x;
            const dy = f.y - p.y;
            const d = Math.hypot(dx, dy);
            if (d < 110 && d > 0) {
              f.vx += (dx / d) * 400 * dt;
              f.y += (dy / d) * 40 * dt;
            }
          }
          if (f.y > v.height + 10) {
            f.y = -10;
            f.x = rand() * v.width;
          }
          if (f.x < -20) f.x = v.width + 10;
          if (f.x > v.width + 20) f.x = -10;
        }
      },
    };
  },
  id: "xiaoxue",
  loose: "雪丶",
  ramps: [["丶", "一", "二", "冫", "雪", "霏", "霁", "皑"]],
  warm: 1,
};

/** 大雪 · 暴雪: a driving snowfall that drifts up into a growing bank. */
export const daxue: TermSpec = {
  create({ glyph, rand }) {
    const snow = glyph("雪");
    const dot = glyph("丶");
    let flakes = pool(0);
    let bank = new Float32Array(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let wind = 120;
    return {
      cell(x, y, t, out, cx) {
        const h = bank[cx + 1] ?? 0;
        if (y > v.height - h) {
          out.v = 0.45 + 0.35 * fbm(x * 0.03, y * 0.04);
          out.wet = 0.3;
          return;
        }
        out.v = 0.08 * fbm(x * 0.01 - t * wind * 0.002, y * 0.012);
      },
      layout(view) {
        v = view;
        bank = new Float32Array(Math.ceil(v.width / v.cell) + 3);
        flakes = pool(150);
        for (const f of flakes) {
          f.x = rand() * v.width;
          f.y = rand() * v.height;
          f.a = rand();
        }
      },
      stamps(_t, emit) {
        for (const f of flakes) {
          emit(
            f.a > 0.6 ? snow : dot,
            f.x,
            f.y,
            0.3 + 0.6 * f.a,
            0.45 + f.a * 0.65,
            INK,
          );
        }
      },
      step(dt, t, env) {
        const target = env.pointer
          ? (env.pointer.x / v.width - 0.5) * 520
          : 140 * Math.sin(t * 0.2) + 60;
        wind += (target - wind) * Math.min(1, dt * 1.5);
        for (const f of flakes) {
          f.x += wind * (0.5 + f.a) * dt;
          f.y += (110 + f.a * 90) * dt;
          const c = Math.max(
            0,
            Math.min(bank.length - 1, Math.floor(f.x / v.cell) + 1),
          );
          if (f.y > v.height - (bank[c] ?? 0)) {
            if (f.x > 0 && f.x < v.width) bank[c] = (bank[c] ?? 0) + 0.9;
            f.y = -10;
            f.x = rand() * (v.width + 400) - 200;
          }
          if (f.x > v.width + 220) f.x -= v.width + 420;
          if (f.x < -220) f.x += v.width + 420;
        }
        let top = 0;
        for (let k = 1; k < bank.length - 1; k++) {
          const h = bank[k] ?? 0;
          const avg = ((bank[k - 1] ?? 0) + (bank[k + 1] ?? 0)) / 2;
          bank[k] = h + (avg - h) * dt * 0.8;
          top = Math.max(top, bank[k] ?? 0);
        }
        if (top > v.height * 0.42) bank.fill(0);
      },
    };
  },
  id: "daxue",
  loose: "雪丶",
  ramps: [["丶", "冫", "二", "雪", "霏", "皑", "霰", "凛"]],
  warm: 8,
};

/** 冬至 · 一阳生: the longest night; one vermilion point pushes out light, the 九九 ring fills. */
export const dongzhi: TermSpec = {
  create({ glyph }) {
    const sun = glyph("阳");
    const plum = glyph("梅");
    const dot = glyph("丶");
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let px = 0;
    let py = 0;
    let days = 0;
    return {
      cell(x, y, t, out) {
        const d = Math.hypot(x - px, y - py);
        const R = (t * 80) % (Math.max(v.width, v.height) * 1.1);
        let val =
          0.72 * smoothstep(0.42, 0.78, fbm(x * 0.009 + t * 0.02, y * 0.009)) -
          ring(d, R, 60) * 0.45;
        const glow = 1 - d / 90;
        if (glow > 0) {
          val = val * (1 - glow) + 0.6 * glow;
          if (glow > 0.3) out.p = ZHU;
        }
        if (ring(d, R, 8) > 0.4) {
          val = Math.max(val, 0.7);
          out.p = ZHU;
        }
        out.v = val;
      },
      layout(view) {
        v = view;
        px = v.width / 2;
        py = v.height / 2;
      },
      stamps(t, emit) {
        const R = Math.min(v.width, v.height) * 0.4;
        for (let i = 0; i < 81; i++) {
          const a = -Math.PI / 2 + (i / 81) * TAU;
          const on = i < days;
          emit(
            on ? plum : dot,
            v.width / 2 + Math.cos(a) * R,
            v.height / 2 + Math.sin(a) * R,
            on ? 0.95 : 0.45,
            on ? 0.7 : 0.5,
            on ? ZHU : INK,
          );
        }
        emit(sun, px, py, 1, 1.3 + 0.15 * Math.sin(t * 3), ZHU);
      },
      step(dt, t, env) {
        const p = env.pointer;
        px += ((p ? p.x : v.width / 2) - px) * Math.min(1, dt * 2);
        py += ((p ? p.y : v.height / 2) - py) * Math.min(1, dt * 2);
        days = Math.min(81, Math.floor((t * 3) % 96));
      },
    };
  },
  id: "dongzhi",
  loose: "阳梅丶",
  ramps: [["丶", "一", "冫", "冬", "夜", "玄", "冥", "黯"]],
  warm: 6,
};

/** 小寒 · 寒梅: a plum branch grows stroke by stroke and blossoms at its tips. */
export const xiaohan: TermSpec = {
  create({ glyph, rand }) {
    const plum = glyph("梅");
    const MAX_SEGS = 600;
    /** Per segment: x0, y0, x1, y1, start, duration, depth. */
    const segs = new Float32Array(MAX_SEGS * 7);
    /** Per tip: x, y, time it opens. */
    const tips = new Float32Array(MAX_SEGS * 3);
    let nSegs = 0;
    let nTips = 0;
    let bursts = pool(0);
    /** When the growing branch reaches each cell, and how deep it is there. */
    let birth = new Float32Array(0);
    let depthAt = new Uint8Array(0);
    let mapCols = 0;
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let t0 = 0;

    const tip = (x: number, y: number, at: number) => {
      if (nTips >= MAX_SEGS) return;
      tips[nTips * 3] = x;
      tips[nTips * 3 + 1] = y;
      tips[nTips * 3 + 2] = at;
      nTips++;
    };
    const grow = (
      x: number,
      y: number,
      a: number,
      len: number,
      depth: number,
      at: number,
    ) => {
      if (nSegs >= MAX_SEGS) return;
      const x1 = x + Math.cos(a) * len;
      const y1 = y + Math.sin(a) * len;
      const dur = len / 110;
      segs.set([x, y, x1, y1, at, dur, depth], nSegs * 7);
      nSegs++;
      const step = v.cell * 0.5;
      for (let s = 0; s <= len; s += step) {
        const f = s / len;
        const cx = Math.floor((x + (x1 - x) * f) / v.cell) + 1;
        const cy = Math.floor((y + (y1 - y) * f) / v.cell) + 1;
        if (cx < 0 || cy < 0 || cx >= mapCols) continue;
        const i = cy * mapCols + cx;
        if (i >= birth.length) continue;
        const when = at + dur * f;
        if (when < (birth[i] ?? Number.POSITIVE_INFINITY)) {
          birth[i] = when;
          depthAt[i] = depth;
        }
      }
      if (depth >= 5 || len < 16) {
        tip(x1, y1, at + dur);
        return;
      }
      const n = rand() < 0.2 ? 3 : 2;
      for (let k = 0; k < n; k++) {
        grow(
          x1,
          y1,
          a + (k - (n - 1) / 2) * (0.5 + rand() * 0.4) + (rand() - 0.5) * 0.3,
          len * (0.66 + rand() * 0.12),
          depth + 1,
          at + dur,
        );
      }
      if (depth > 1 && rand() < 0.5) tip(x1, y1, at + dur + 0.4);
    };
    const reset = (t: number) => {
      t0 = t;
      nSegs = 0;
      nTips = 0;
      birth.fill(Number.POSITIVE_INFINITY);
      grow(v.width * 0.1, v.height, -Math.PI / 2 + 0.35, v.height * 0.24, 0, 0);
      grow(
        v.width * 0.92,
        v.height,
        -Math.PI / 2 - 0.4,
        v.height * 0.18,
        0,
        1.2,
      );
    };
    return {
      cell(x, y, t, out, cx, cy) {
        const i = (cy + 1) * mapCols + cx + 1;
        const when = birth[i] ?? Number.POSITIVE_INFINITY;
        if (t - t0 >= when) {
          out.v = 0.9 - (depthAt[i] ?? 0) * 0.08;
          out.k = 1;
          out.wet = 0.2;
          return;
        }
        out.v =
          smoothstep(v.height - 22, v.height, y) * 0.45 +
          0.05 * fbm(x * 0.01, y * 0.01 - t * 0.05);
      },
      drop(x, y) {
        for (let k = 0; k < 6; k++) {
          const b = spawn(bursts);
          if (!b) return;
          const a = (k / 6) * TAU + rand();
          b.life = 4;
          b.x = x + Math.cos(a) * 26;
          b.y = y + Math.sin(a) * 26;
        }
      },
      layout(view) {
        v = view;
        mapCols = Math.ceil(v.width / v.cell) + 2;
        const n = mapCols * (Math.ceil(v.height / v.cell) + 2);
        birth = new Float32Array(n);
        depthAt = new Uint8Array(n);
        bursts = pool(18);
        reset(0);
      },
      stamps(t, emit) {
        const T = t - t0;
        for (let k = 0; k < nTips; k++) {
          const age = T - (tips[k * 3 + 2] ?? 0);
          if (age <= 0) continue;
          emit(
            plum,
            tips[k * 3] ?? 0,
            tips[k * 3 + 1] ?? 0,
            0.95,
            smoothstep(0, 0.6, age) * 0.95,
            k % 3 ? YANZHI : ZHU,
          );
        }
        for (const b of bursts) {
          if (b.life > 0)
            emit(
              plum,
              b.x,
              b.y,
              Math.min(1, b.life),
              smoothstep(4, 3.4, b.life) * 0.95,
              YANZHI,
            );
        }
      },
      step(dt, t) {
        for (const b of bursts) b.life -= dt;
        if (t - t0 > 15) reset(t);
      },
    };
  },
  id: "xiaohan",
  loose: "梅",
  ramps: [
    ["丶", "一", "二", "冫", "寒", "凛", "冽", "凝"],
    ["丶", "丨", "木", "枝", "杈", "枒", "柯", "干"],
  ],
  warm: 9,
};

/** 大寒 · 岁除: the frozen grid is lit by fireworks as the year turns. */
export const dahan: TermSpec = {
  create({ glyph, rand }) {
    const fire = glyph("火");
    const star = glyph("星");
    let bursts = pool(0);
    let parts = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let next = 0.5;
    const burst = (x: number, y: number, t: number) => {
      const b = spawn(bursts);
      if (b) {
        b.life = 1.4;
        b.x = x;
        b.y = y;
        b.a = t;
      }
      for (let i = 0; i < 40; i++) {
        const p = spawn(parts);
        if (!p) return;
        const a = (i / 40) * TAU + rand() * 0.1;
        const speed = 90 + rand() * 150;
        p.life = 1;
        p.x = x;
        p.y = y;
        p.vx = Math.cos(a) * speed;
        p.vy = Math.sin(a) * speed;
        p.b = i;
      }
    };
    return {
      cell(x, y, t, out) {
        let val =
          0.06 + 0.32 * smoothstep(0.38, 0.75, fbm(x * 0.012, y * 0.012));
        out.wet = 0.4;
        if (Math.abs(noise(x * 0.015, y * 0.015) - 0.5) < 0.016) val = 0.7;
        for (const b of bursts) {
          if (b.life <= 0) continue;
          const age = t - b.a;
          const f =
            ring(Math.hypot(x - b.x, y - b.y), age * 120, 34) * (1 - age / 1.4);
          if (f > 0.15) {
            val = val * (1 - f) + f * 0.8;
            out.p = ZHU;
          }
        }
        out.v = val;
      },
      drop(x, y, t) {
        burst(x, y, t);
      },
      layout(view) {
        v = view;
        bursts = pool(4);
        parts = pool(240);
        next = 0.5;
      },
      stamps(_t, emit) {
        for (const p of parts) {
          if (p.life <= 0) continue;
          emit(
            p.b % 3 ? fire : star,
            p.x,
            p.y,
            p.life,
            0.5 + p.life * 0.45,
            p.b % 2 ? ZHU : ZHE,
          );
        }
      },
      step(dt, t) {
        if (t > next) {
          burst(
            v.width * (0.15 + rand() * 0.7),
            v.height * (0.15 + rand() * 0.45),
            t,
          );
          next = t + 0.9 + rand() * 1.4;
        }
        for (const b of bursts) b.life -= dt;
        for (const p of parts) {
          if (p.life <= 0) continue;
          p.vx *= 0.97;
          p.vy = p.vy * 0.97 + 70 * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life -= dt * 0.6;
        }
      },
    };
  },
  id: "dahan",
  loose: "火星",
  ramps: [["丶", "冫", "冰", "冻", "凛", "寒", "凝", "冽"]],
  warm: 3,
};
