/**
 * 荷塘: a pond seen from above. Lotus leaves are ink pools with a notch and
 * radiating veins, a few flowers open in 胭脂, duckweed drifts in 花青, and
 * koi swim between them: they wander, keep clear of the page's content,
 * scatter from the pointer and come to where ink is dropped. A koi passing
 * under a leaf sinks out of sight.
 */
import { DEFAULT_LEVELS } from "../glyphs.js";
import { clamp, fbm, hash2, noise, rng, smoothstep } from "../noise.js";
import {
  COARSE,
  type CoarseField,
  coarseField,
  glyphTable,
  HUAQING,
  INK,
  type InkPondScene,
  type Pigment,
  type SceneEnv,
  YANZHI,
  ZHE,
  ZHU,
} from "../scene.js";

export const LOTUS_FONT_FAMILY = "Inkpond Glyphs Lotus";
export const LOTUS_FONT_URL = new URL(
  "../assets/inkpond-lotus.woff2",
  import.meta.url,
).href;

const WATER = 0;
const LEAF = 1;
const FLOWER = 2;
const WEED = 3;
const RAMPS = [
  DEFAULT_LEVELS,
  ["一", "十", "叶", "芊苇", "茎荇", "荷莲", "蓬蔓", "蕖藕"],
  ["丶", "八", "朵", "花", "芳", "菡", "萏", "蕊"],
  ["丶", "点", "萍", "藻"],
] as const;
/** Koi: head, scales, fins, tail; and the faint wake behind them. */
const LOOSE = "鲤鳞鳍尾～";

/** Segments of a koi's spine, head first: head, three body, tail root. */
const SPINE = 5;
/**
 * Leaves and flowers are the pond's darkest ink, well past the ramp's middle
 * at the default strength, so they read as pools rather than text.
 */
const LEAF_INK = 1.8;
/** Koi length in cells is about SPINE × 0.7 × this. */
const KOI_SIZE = 1.35;
const KOI_COLORS: readonly Pigment[] = [ZHU, INK, ZHU, ZHE, ZHU, INK];

interface Koi {
  id: number;
  x: number;
  y: number;
  heading: number;
  speed: number;
  /** Tail beat phase. */
  phase: number;
  size: number;
  pigment: Pigment;
  /** Spine points, head first, each one segment behind the last. */
  spine: { x: number; y: number }[];
  /** Recent tail positions, oldest first: the wake. */
  wake: { x: number; y: number; t: number }[];
  /** Startle left over from the pointer, 0–1. */
  fright: number;
}

const angleTo = (from: number, to: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export const createLotus = (
  levels: readonly string[] = DEFAULT_LEVELS,
): InkPondScene => {
  const table = glyphTable([levels, ...RAMPS.slice(1)], LOOSE);
  const g = {
    fin: table.index("鳍"),
    head: table.index("鲤"),
    scale: table.index("鳞"),
    tail: table.index("尾"),
    wake: table.index("～"),
  };
  let cols = 0;
  let rows = 0;
  let cell = 16;
  let base = new Float32Array(0);
  let kinds = new Uint8Array(0);
  let pigments = new Uint8Array(0);
  let sheen: CoarseField = coarseField(0, 0);
  let koi: Koi[] = [];
  let placed = false;

  const leafAt = (x: number, y: number) => {
    const cx = Math.floor(x / cell) + 1;
    const cy = Math.floor(y / cell) + 1;
    if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return false;
    return kinds[cy * cols + cx] === LEAF;
  };

  /** Leaves toward the rim, where the page's content seldom sits. */
  const layoutPond = () => {
    const n = cols * rows;
    base = new Float32Array(n);
    kinds = new Uint8Array(n);
    pigments = new Uint8Array(n);
    const rand = rng(cols * 131 + rows * 7);
    const leaves: { x: number; y: number; r: number }[] = [];
    const want = clamp(Math.round(n / 420), 4, 9);
    for (let tries = 0; leaves.length < want && tries < want * 40; tries++) {
      const x = rand() * cols;
      const y = rand() * rows;
      const ox = (x / cols - 0.5) * 2;
      const oy = (y / rows - 0.5) * 2;
      const rim = Math.max(Math.abs(ox), Math.abs(oy));
      if (rim < 0.55 && rand() > 0.15) continue;
      const r = 2.4 + rand() * 2.6 + rim * 1.4;
      if (leaves.some((l) => Math.hypot(l.x - x, l.y - y) < (l.r + r) * 0.8)) {
        continue;
      }
      leaves.push({ r, x, y });
    }

    for (const leaf of leaves) {
      const notch = rand() * Math.PI * 2;
      const veins = 7 + Math.floor(rand() * 4);
      const twist = rand() * 10;
      const light = rand() * Math.PI * 2;
      const x0 = Math.max(0, Math.floor(leaf.x - leaf.r - 1));
      const x1 = Math.min(cols - 1, Math.ceil(leaf.x + leaf.r + 1));
      const y0 = Math.max(0, Math.floor(leaf.y - leaf.r - 1));
      const y1 = Math.min(rows - 1, Math.ceil(leaf.y + leaf.r + 1));
      for (let y = y0; y <= y1; y++) {
        for (let x = x0; x <= x1; x++) {
          const dx = x - leaf.x;
          const dy = (y - leaf.y) * 1.1;
          const d = Math.hypot(dx, dy) / leaf.r;
          if (d > 1.05) continue;
          const a = Math.atan2(dy, dx);
          // The notch every lotus leaf has, from its centre to the rim.
          if (d > 0.18 && Math.abs(angleTo(a, notch)) < 0.16) continue;
          // Veins are left as paper: pale spokes from the centre.
          const vein =
            d > 0.2 && d < 0.88
              ? smoothstep(0.9, 0.99, Math.cos((a + twist) * veins))
              : 0;
          const rimInk = Math.exp(-(((d - 0.88) / 0.1) ** 2));
          const wash = fbm(x * 0.3 + twist, y * 0.3);
          // One side of the leaf in shadow, the other catching light.
          const shade = 0.7 + 0.35 * Math.cos(a - light) * d;
          // 飞白: the brush skips here and there.
          const skip = hash2(x * 3 + leaf.x, y * 5 + leaf.y) < 0.14 ? 0.35 : 1;
          const v =
            ((0.42 + 0.38 * wash) * shade * (1 - 0.8 * vein) * skip +
              0.25 * rimInk) *
              (1 - smoothstep(0.9, 1.05, d)) +
            (d < 0.15 ? 0.4 : 0);
          const i = y * cols + x;
          if (v * LEAF_INK <= (base[i] ?? 0)) continue;
          base[i] = Math.min(2, v * LEAF_INK);
          kinds[i] = LEAF;
          // 墨荷 with a little 花青 washed into it.
          pigments[i] = wash > 0.55 ? HUAQING : INK;
        }
      }
    }

    // A flower beside some of the leaves, petals in 胭脂 around a dark heart.
    for (const leaf of leaves) {
      if (rand() > 0.45) continue;
      const a = rand() * Math.PI * 2;
      const fx = leaf.x + Math.cos(a) * leaf.r * 1.05;
      const fy = leaf.y + Math.sin(a) * leaf.r * 1.05;
      const fr = 1.4 + rand() * 0.8;
      const turn = rand() * Math.PI;
      for (let y = Math.floor(fy - 2); y <= Math.ceil(fy + 2); y++) {
        for (let x = Math.floor(fx - 2); x <= Math.ceil(fx + 2); x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const d = Math.hypot(x - fx, y - fy) / fr;
          if (d > 1.1) continue;
          const petal =
            0.5 + 0.5 * Math.cos((Math.atan2(y - fy, x - fx) + turn) * 5);
          const v = d < 0.35 ? 0.95 : (0.45 + 0.4 * petal) * (1.1 - d);
          const i = y * cols + x;
          base[i] = v * LEAF_INK;
          kinds[i] = FLOWER;
          pigments[i] = d < 0.35 ? ZHE : YANZHI;
        }
      }
    }

    // 浮萍 in loose drifts on the open water.
    for (let y = 0; y < rows; y++) {
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        if (kinds[i] !== WATER) continue;
        const f = fbm(x * 0.21 + 50, y * 0.27);
        if (f < 0.7) continue;
        base[i] = 0.2 + (f - 0.7) * 1.6;
        kinds[i] = WEED;
        pigments[i] = HUAQING;
      }
    }
  };

  const spawnKoi = (width: number, height: number) => {
    const rand = rng(cols * 17 + rows * 3 + 5);
    const count = clamp(Math.round((width * height) / 260_000), 3, 6);
    koi = [];
    for (let id = 0; id < count; id++) {
      // Start toward the sides, clear of a centred page.
      const side = id % 2 ? 1 : -1;
      const x = width * (0.5 + side * (0.3 + rand() * 0.15));
      const y = height * (0.12 + ((id + rand() * 0.6) / count) * 0.76);
      const fish: Koi = {
        fright: 0,
        heading: rand() * Math.PI * 2,
        id,
        phase: rand() * 10,
        pigment: KOI_COLORS[id % KOI_COLORS.length] ?? ZHU,
        size: (0.9 + rand() * 0.35) * KOI_SIZE,
        speed: 26,
        spine: [],
        wake: [],
        x,
        y,
      };
      place(fish, x, y);
      koi.push(fish);
    }
    placed = false;
  };

  /** Put a koi at (x, y), body laid straight out behind its head. */
  const place = (fish: Koi, x: number, y: number) => {
    const gap = cell * 0.7 * fish.size;
    fish.x = x;
    fish.y = y;
    fish.spine = Array.from({ length: SPINE }, (_, j) => ({
      x: x - Math.cos(fish.heading) * gap * j,
      y: y - Math.sin(fish.heading) * gap * j,
    }));
  };

  /**
   * Layout cannot see the page's content; on the first swim, any koi that
   * started under it moves to open water.
   */
  const release = (env: SceneEnv) => {
    placed = true;
    const rand = rng(koi.length * 97 + cols);
    for (const fish of koi) {
      for (let k = 0; k < 40 && openness(env, fish.x, fish.y) < 0.8; k++) {
        place(fish, rand() * env.width, rand() * env.height);
      }
    }
  };

  /** How open the water ahead is: clear of content and inside the pond. */
  const openness = (env: SceneEnv, x: number, y: number) => {
    const margin = cell * 2;
    if (x < margin || y < margin) return 0;
    if (x > env.width - margin || y > env.height - margin) return 0;
    return env.maskAt(x, y);
  };

  const swim = (fish: Koi, dt: number, env: SceneEnv) => {
    let turn = (noise(env.time * 0.22, fish.id * 7.3) - 0.5) * 2.2;
    let target = 22 + 10 * noise(env.time * 0.1, fish.id * 3.1 + 9);

    // Food first: ink dropped in the last few seconds draws them in.
    let food: { x: number; y: number } | null = null;
    let nearest = Number.POSITIVE_INFINITY;
    for (const d of env.drops) {
      const dist = Math.hypot(d.x - fish.x, d.y - fish.y);
      if (d.age < 9 && dist < nearest) {
        nearest = dist;
        food = d;
      }
    }
    if (food) {
      const dist = Math.hypot(food.x - fish.x, food.y - fish.y);
      if (dist > cell * 2.5) {
        turn +=
          angleTo(fish.heading, Math.atan2(food.y - fish.y, food.x - fish.x)) *
          2.4;
        target = 46;
      } else target = 14;
    }

    // Look ahead; if the way is blocked, bend toward the more open side.
    const look = cell * 4;
    const ahead = (a: number) =>
      openness(env, fish.x + Math.cos(a) * look, fish.y + Math.sin(a) * look);
    if (ahead(fish.heading) < 0.65) {
      const left = ahead(fish.heading - 0.7);
      const right = ahead(fish.heading + 0.7);
      turn += (right >= left ? 1 : -1) * 2.8;
    }

    // The pointer startles them away.
    const p = env.pointer;
    if (p) {
      const dist = Math.hypot(p.x - fish.x, p.y - fish.y);
      if (dist < cell * 7) {
        fish.fright = 1;
        turn +=
          angleTo(fish.heading, Math.atan2(fish.y - p.y, fish.x - p.x)) * 4;
      }
    }
    fish.fright = Math.max(0, fish.fright - dt * 0.8);
    target += fish.fright * 70;

    fish.heading += clamp(turn, -4.5, 4.5) * dt;
    fish.speed += (target - fish.speed) * Math.min(1, dt * 1.5);
    fish.x += Math.cos(fish.heading) * fish.speed * dt;
    fish.y += Math.sin(fish.heading) * fish.speed * dt;
    fish.x = clamp(fish.x, -cell * 2, env.width + cell * 2);
    fish.y = clamp(fish.y, -cell * 2, env.height + cell * 2);
    fish.phase += dt * (2.2 + fish.speed * 0.06);

    // Follow-the-leader spine: each segment trails the one before it.
    const gap = cell * 0.7 * fish.size;
    const head = fish.spine[0];
    if (head) {
      head.x = fish.x;
      head.y = fish.y;
    }
    for (let j = 1; j < fish.spine.length; j++) {
      const a = fish.spine[j - 1];
      const b = fish.spine[j];
      if (!a || !b) continue;
      const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      b.x = a.x + ((b.x - a.x) / d) * gap;
      b.y = a.y + ((b.y - a.y) / d) * gap;
    }
    const tail = fish.spine[fish.spine.length - 1];
    const last = fish.wake[fish.wake.length - 1];
    if (tail && (!last || env.time - last.t > 0.18)) {
      fish.wake.push({ t: env.time, x: tail.x, y: tail.y });
      if (fish.wake.length > 9) fish.wake.shift();
    }
  };

  return {
    fontFamily: LOTUS_FONT_FAMILY,
    fontUrl: LOTUS_FONT_URL,
    glyphs: table.glyphs,
    moving: true,
    panSpeed: 0,
    ramps: table.ramps,
    compose(grid, _offset, time) {
      // Light glancing off the open water drifts slowly.
      const drift = time * 0.02;
      for (let cy = 0; cy < sheen.h; cy++) {
        for (let cx = 0; cx < sheen.w; cx++) {
          sheen.data[cy * sheen.w + cx] =
            smoothstep(
              0.6,
              0.85,
              fbm(cx * COARSE * 0.06 - drift, cy * COARSE * 0.2 + drift * 0.4),
            ) * 0.22;
        }
      }
      for (let y = 0; y < rows; y++) {
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const k = kinds[i] ?? WATER;
          grid.kind[i] = k;
          grid.pigment[i] = pigments[i] ?? INK;
          grid.wet[i] = k === LEAF || k === FLOWER ? 0.5 : 1;
          grid.ground[i] = k === WATER ? sheen.at(x, y) : (base[i] ?? 0);
        }
      }
    },
    layout(view) {
      cols = view.cols;
      rows = view.rows;
      cell = view.cell;
      sheen = coarseField(cols, rows);
      layoutPond();
      spawnKoi(view.width, view.height);
    },
    stamps(env, emit) {
      for (const fish of koi) {
        const sunk = (x: number, y: number) => (leafAt(x, y) ? 0.3 : 1);
        // The wake fades behind the tail.
        fish.wake.forEach((w, k) => {
          const age = env.time - w.t;
          const a = (1 - age / 1.8) * 0.35 * (k / fish.wake.length);
          if (a > 0) emit(g.wake, w.x, w.y, a * sunk(w.x, w.y), 0.8, INK);
        });
        const s = fish.size;
        for (let j = fish.spine.length - 1; j >= 0; j--) {
          const p = fish.spine[j];
          const q = fish.spine[Math.max(0, j - 1)];
          if (!p || !q) continue;
          const along = j / (fish.spine.length - 1);
          // The body sways more toward the tail.
          const sway =
            Math.sin(fish.phase - j * 0.7) * cell * 0.32 * along * along;
          const dir = j === 0 ? fish.heading : Math.atan2(q.y - p.y, q.x - p.x);
          const nx = -Math.sin(dir);
          const ny = Math.cos(dir);
          const x = p.x + nx * sway;
          const y = p.y + ny * sway;
          const under = sunk(x, y);
          const c = fish.pigment;
          if (j === fish.spine.length - 1) {
            // The tail fans out from its root.
            emit(g.tail, x, y, 0.75 * under, 0.85 * s, c);
            for (const side of [-1, 1]) {
              emit(
                g.tail,
                x -
                  Math.cos(dir) * cell * 0.45 * s +
                  nx * side * cell * 0.4 * s,
                y -
                  Math.sin(dir) * cell * 0.45 * s +
                  ny * side * cell * 0.4 * s,
                0.5 * under,
                0.7 * s,
                c,
              );
            }
          } else if (j === 0) {
            emit(g.head, x, y, 0.95 * under, 1.2 * s, c);
          } else {
            emit(
              g.scale,
              x,
              y,
              (0.95 - along * 0.25) * under,
              (1.15 - along * 0.35) * s,
              c,
            );
            if (j === 1) {
              const beat = Math.sin(fish.phase * 1.3) * 0.15;
              for (const side of [-1, 1]) {
                emit(
                  g.fin,
                  x + nx * side * cell * (0.7 + beat) * s,
                  y + ny * side * cell * (0.7 + beat) * s,
                  0.45 * under,
                  0.6 * s,
                  c,
                );
              }
            }
          }
        }
      }
    },
    step(dt, env) {
      if (!placed) release(env);
      for (const fish of koi) swim(fish, Math.min(dt, 0.1), env);
    },
  };
};
