/** 夏: 立夏, 小满, 芒种, 夏至, 小暑, 大暑. */
import { fbm, hash2, noise, smoothstep } from "../../noise.js";
import { HUAQING, INK, ZHE, ZHU } from "../../scene.js";
import {
  pool,
  ring,
  spawn,
  TAU,
  type TermSpec,
  type TermView,
} from "./term.js";

/** 立夏 · 蛙鸣: croaks ring out and interfere into a moiré on the pond. */
export const lixia: TermSpec = {
  create({ glyph, rand }) {
    const frog = glyph("蛙");
    const croak = glyph("呱");
    let frogs = pool(0);
    let rings = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    const call = (x: number, y: number, t: number) => {
      const r = spawn(rings);
      if (!r) return;
      r.life = 6;
      r.x = x;
      r.y = y;
      r.a = t;
    };
    return {
      cell(x, y, t, out) {
        let sum = 0;
        for (const r of rings) {
          if (r.life <= 0) continue;
          const age = t - r.a;
          const d = Math.hypot(x - r.x, y - r.y);
          const R = age * 90;
          if (d > R + 60) continue;
          sum +=
            Math.cos((d - R) * 0.16) *
            ring(d, R - 30, 50) *
            Math.exp(-age * 0.55);
        }
        out.v =
          0.06 +
          0.06 * noise(x * 0.02, y * 0.02 + t * 0.2) +
          Math.max(0, sum) * 0.85;
        if (sum > 0.25) out.p = HUAQING;
      },
      drop(x, y, t) {
        call(x, y, t);
      },
      layout(view) {
        v = view;
        frogs = pool(5);
        rings = pool(22);
        for (const f of frogs) {
          f.x = v.width * (0.12 + rand() * 0.76);
          f.y = v.height * (0.18 + rand() * 0.64);
          f.a = rand() * 2;
          f.b = -9;
        }
      },
      stamps(t, emit) {
        for (const f of frogs) {
          const age = t - f.b;
          emit(frog, f.x, f.y, 0.95, age < 0.25 ? 1.5 : 1.3, INK);
          if (age < 0.5)
            emit(croak, f.x + 20, f.y - 20 - age * 30, 1 - age * 2, 0.8, ZHU);
        }
      },
      step(dt, t, env) {
        const p = env.pointer;
        for (const f of frogs) {
          if (p && Math.hypot(p.x - f.x, p.y - f.y) < 130)
            f.a = Math.min(f.a, f.b + 0.5);
          if (t > f.a) {
            call(f.x, f.y, t);
            f.b = t;
            f.a = t + 1.6 + rand() * 2.4;
          }
        }
        for (const r of rings) r.life -= dt;
      },
    };
  },
  id: "lixia",
  loose: "蛙呱",
  ramps: [["丶", "一", "口", "叫", "呱", "鸣", "噪", "嚣"]],
  warm: 4,
};

/** 小满 · 麦浪: gusts roll through a field of wheat; the pointer parts it. */
export const xiaoman: TermSpec = {
  create({ glyph, rand }) {
    const awn = glyph("芒");
    let chaff = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let px = -1e4;
    let py = -1e4;
    return {
      cell(x, y, t, out) {
        const hz = v.height * 0.3 + Math.sin(x * 0.004) * 10;
        if (y < hz) {
          out.v = 0.05 * fbm(x * 0.01 - t * 0.05, y * 0.03);
          return;
        }
        const f = (y - hz) / (v.height - hz);
        const wave = Math.sin(
          x * 0.022 - t * 1.7 + fbm(x * 0.004, y * 0.012) * 2.5 + y * 0.012,
        );
        // Only the crests stand out; the troughs between them lie open.
        let val = 0.12 + 0.1 * f + 0.6 * Math.max(0, wave) * (0.5 + f * 0.5);
        const d = Math.hypot(x - px, y - py);
        if (d < 140) val -= (1 - d / 140) * 0.45;
        out.v = val;
        out.wet = 0.5;
        if (wave > 0.45) out.p = ZHE;
      },
      layout(view) {
        v = view;
        chaff = pool(24);
        for (const c of chaff) {
          c.x = rand() * v.width;
          c.y = v.height * (0.3 + rand() * 0.6);
          c.b = rand() * TAU;
        }
      },
      stamps(_t, emit) {
        for (const c of chaff) emit(awn, c.x, c.y, 0.6, 0.6, ZHE);
      },
      step(dt, t, env) {
        px = env.pointer?.x ?? -1e4;
        py = env.pointer?.y ?? -1e4;
        for (const c of chaff) {
          c.x += (40 + Math.sin(t + c.b) * 20) * dt;
          c.y += Math.sin(t * 1.3 + c.b) * 12 * dt;
          if (c.x > v.width + 20) {
            c.x = -20;
            c.y = v.height * (0.3 + rand() * 0.6);
          }
        }
      },
    };
  },
  id: "xiaoman",
  loose: "芒",
  ramps: [["丶", "禾", "未", "米", "麦", "秀", "穗", "穰"]],
  warm: 1,
};

/** 芒种 · 插秧: a planting line sweeps the paddy and leaves rows of seedlings. */
export const mangzhong: TermSpec = {
  create({ glyph, rand }) {
    const awn = glyph("芒");
    let needles = pool(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let front = 0;
    return {
      cell(x, y, t, out, cx, cy) {
        out.v = 0.06 + 0.1 * noise(x * 0.03, y * 0.03 + t * 0.25);
        if (y < v.height * 0.12) return;
        if (cx % 3 === 1 && cy % 2 === 1 && x < front - hash2(cx, cy) * 50) {
          out.v = 0.68 + 0.18 * Math.sin(t * 2.2 + cx * 0.4 + cy * 0.2);
          out.p = HUAQING;
          out.wet = 0.6;
        }
        if (Math.abs(x - front) < v.cell * 0.6) {
          out.v = 0.92;
          out.p = ZHU;
        }
      },
      drop(x) {
        front = x;
      },
      layout(view) {
        v = view;
        front = v.width * 0.2;
        needles = pool(30);
      },
      stamps(_t, emit) {
        for (const n of needles)
          if (n.life > 0) emit(awn, n.x, n.y, n.life * 0.8, 0.8, ZHE);
      },
      step(dt) {
        front += dt * 70;
        if (front > v.width + 160) front = -60;
        if (rand() < dt * 6) {
          const n = spawn(needles);
          if (n && n.life <= 0) {
            n.life = 1;
            n.x = rand() * v.width;
            n.y = -10;
          }
        }
        for (const n of needles) {
          if (n.life <= 0) continue;
          n.x += 160 * dt;
          n.y += 220 * dt;
          n.life -= dt * 0.5;
        }
      },
    };
  },
  id: "mangzhong",
  loose: "芒",
  ramps: [["丶", "一", "氵", "田", "禾", "秧", "稻", "穑"]],
  warm: 5,
};

/** 夏至 · 烈日: a vermilion sun with turning rays; heat shimmers on the ground. */
export const xiazhi: TermSpec = {
  create() {
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let sx = 0;
    let sy = 0;
    return {
      cell(x, y, t, out) {
        const hz = v.height * 0.8;
        if (y > hz) {
          const xs = x + Math.sin(y * 0.09 + t * 5) * 6;
          out.v =
            y < hz + v.cell
              ? 0.55
              : 0.16 + 0.22 * fbm(xs * 0.03, y * 0.08 - t * 0.6);
          out.p = y < hz + v.cell ? INK : ZHE;
          out.wet = 0.4;
          return;
        }
        const dx = x - sx;
        const dy = y - sy;
        const d = Math.hypot(dx, dy);
        const R = Math.min(v.width, v.height) * 0.2;
        if (d < R) {
          out.v = 0.72 + 0.22 * fbm(x * 0.03 + t * 0.3, y * 0.03);
          out.p = ZHU;
          out.wet = 0.3;
          return;
        }
        const fall = Math.exp(-(d - R) / (R * 0.9));
        const ray =
          Math.abs(Math.cos(Math.atan2(dy, dx) * 12 + t * 0.25)) ** 6 * fall;
        const pulse = ring(d - R, (t * 70) % (R * 2.2), 16) * fall;
        const val = ray * 0.55 + pulse * 0.6 + ring(d, R, 6) * 0.9;
        out.v = val;
        out.p = val > 0.22 ? ZHU : ZHE;
      },
      layout(view) {
        v = view;
        sx = v.width * 0.5;
        sy = v.height * 0.4;
      },
      stamps() {},
      step(dt, _t, env) {
        const p = env.pointer;
        const tx = p ? p.x : v.width * 0.5;
        const ty = p ? Math.min(p.y, v.height * 0.6) : v.height * 0.4;
        sx += (tx - sx) * Math.min(1, dt * 0.8);
        sy += (ty - sy) * Math.min(1, dt * 0.8);
      },
    };
  },
  id: "xiazhi",
  loose: "",
  ramps: [["丶", "一", "日", "旦", "昊", "炎", "焱", "曜"]],
  warm: 1,
};

/** 小暑 · 温风: heat rises in warped plumes; cicadas call from the edge. */
export const xiaoshu: TermSpec = {
  create({ glyph }) {
    const cicada = glyph("蝉");
    const call = glyph("鸣");
    const perches = [0.25, 0.55, 0.8];
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let px = -1e4;
    let py = -1e4;
    return {
      cell(x, y, t, out) {
        const X = x + Math.sin(y * 0.015 + t * 1.2) * 18;
        const q = fbm(X * 0.012, (y + t * 45) * 0.012);
        let plume = smoothstep(0.42, 0.75, q) * (0.3 + 0.7 * (y / v.height));
        const d = Math.hypot(x - px, y - py);
        if (d < 160) plume *= d / 160;
        out.v = 0.04 + plume * 0.95;
        out.p = plume > 0.5 ? ZHU : ZHE;
      },
      layout(view) {
        v = view;
      },
      stamps(t, emit) {
        perches.forEach((f, i) => {
          const x = 30 + (i % 2) * 16;
          const y = v.height * f;
          emit(cicada, x, y, 0.95, 1.2, INK);
          for (let k = 0; k < 3; k++) {
            const ph = (t * 70 + k * 55 + i * 30) % 165;
            emit(
              call,
              x + 26 + ph,
              y,
              (1 - ph / 165) * 0.8,
              0.7 + ph / 330,
              INK,
            );
          }
        });
      },
      step(_dt, _t, env) {
        px = env.pointer?.x ?? -1e4;
        py = env.pointer?.y ?? -1e4;
      },
    };
  },
  id: "xiaoshu",
  loose: "蝉鸣",
  ramps: [["丶", "火", "灬", "热", "烘", "焖", "燠", "爇"]],
  warm: 1,
};

/** 大暑 · 萤火: fireflies wander over night grass, trailing light. */
export const dashu: TermSpec = {
  create({ glyph, rand }) {
    const fly = glyph("萤");
    const dot = glyph("丶");
    const TRAIL = 7;
    let flies = pool(0);
    let trails = new Float32Array(0);
    let v: TermView = { cell: 16, height: 0, width: 0 };
    let tick = 0;
    let head = 0;
    return {
      cell(x, y, t, out) {
        const top = v.height * 0.55 + 40 * noise(x * 0.015, 1);
        if (y <= top) {
          out.v = 0.03;
          return;
        }
        const blade =
          Math.abs(Math.sin(x * 0.11 + noise(x * 0.05, 4) * 6)) ** 2;
        out.v =
          smoothstep(top, v.height, y) * (0.45 + 0.4 * blade) +
          0.12 * fbm(x * 0.04 + t * 0.1, y * 0.03);
        out.wet = 0.4;
      },
      layout(view) {
        v = view;
        flies = pool(30);
        trails = new Float32Array(30 * TRAIL * 2);
        for (const [i, f] of flies.entries()) {
          f.x = rand() * v.width;
          f.y = v.height * (0.2 + rand() * 0.7);
          f.b = rand() * TAU;
          f.a = i * 3.1;
          for (let k = 0; k < TRAIL; k++) {
            trails[(i * TRAIL + k) * 2] = f.x;
            trails[(i * TRAIL + k) * 2 + 1] = f.y;
          }
        }
      },
      stamps(t, emit) {
        flies.forEach((f, i) => {
          const glow = 0.5 + 0.5 * Math.sin(t * 2.6 + f.b);
          for (let k = 1; k < TRAIL; k++) {
            const j = (head + k) % TRAIL;
            emit(
              dot,
              trails[(i * TRAIL + j) * 2] ?? 0,
              trails[(i * TRAIL + j) * 2 + 1] ?? 0,
              glow * 0.45 * (k / TRAIL),
              0.6,
              ZHE,
            );
          }
          emit(fly, f.x, f.y, 0.3 + 0.7 * glow, 0.65 + glow * 0.3, ZHE);
        });
      },
      step(dt, t, env) {
        const p = env.pointer;
        for (const f of flies) {
          const ang = noise(f.x * 0.004 + f.a, t * 0.15) * TAU * 2;
          let ax = Math.cos(ang) * 60;
          let ay = Math.sin(ang) * 60;
          if (p) {
            ax += (p.x - f.x) * 0.9;
            ay += (p.y - f.y) * 0.9;
          }
          f.vx = (f.vx + ax * dt) * 0.97;
          f.vy = (f.vy + ay * dt) * 0.97;
          const sp = Math.hypot(f.vx, f.vy);
          if (sp > 70) {
            f.vx *= 70 / sp;
            f.vy *= 70 / sp;
          }
          f.x += f.vx * dt;
          f.y += f.vy * dt;
          if (f.x < -10) f.x = v.width + 10;
          if (f.x > v.width + 10) f.x = -10;
          if (f.y < v.height * 0.08) f.vy += 200 * dt;
          if (f.y > v.height - 10) f.vy -= 200 * dt;
        }
        tick += dt;
        if (tick < 0.09) return;
        tick = 0;
        head = (head + 1) % TRAIL;
        flies.forEach((f, i) => {
          trails[(i * TRAIL + head) * 2] = f.x;
          trails[(i * TRAIL + head) * 2 + 1] = f.y;
        });
      },
    };
  },
  id: "dashu",
  loose: "萤丶",
  ramps: [["丶", "艹", "草", "茅", "莽", "萋", "葳", "蕤"]],
  warm: 2,
};
