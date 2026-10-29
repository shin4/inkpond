/**
 * 大肥鲸: a round, very fat whale paddling about a sea of 一 and ～, and a
 * bowl of 白米饭 in a corner. The rice is 留白, the bare paper itself, with a
 * few 米 along the top of the heap. Every so often the whale gets hungry
 * (饿), swims over and buries its face in the bowl: rice flies into its 口,
 * the heap goes down and the whale swells. Full (饱), it burps 嗝, spouts
 * rice from its blowhole and goes flat again while the bowl slowly refills.
 * Dropped ink scatters rice on the water for it to chase, and the pointer
 * tickles it: it squashes, wobbles and laughs 哈.
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
  type SceneEnv,
  YANZHI,
} from "../scene.js";

export const DAFEIJING_FONT_FAMILY = "Inkpond Glyphs Dafeijing";
export const DAFEIJING_FONT_URL = new URL(
  "../assets/inkpond-dafeijing.woff2",
  import.meta.url,
).href;

const SEA = 0;
const WHALE = 1;
const BOWL = 2;
/** The swell, lightest first; ripples from the pointer reach the dark end. */
export const DAFEIJING_LEVELS = [
  "一",
  "一",
  "一～",
  "～",
  "～二",
  "冫水",
  "水波",
  "波浪",
] as const;
const WHALE_LEVELS = [
  "丶",
  "冫",
  "月",
  "肉",
  "肥",
  "胖",
  "圆鼓",
  "鲸",
] as const;
const BOWL_LEVELS = ["丶", "一", "二", "工", "皿", "皿", "碗", "碗"] as const;
const LOOSE = "〇丶一口米粒嗝饱香哈饿～";

/** Ground per unit of swell, whale or bowl, at the default strength. */
const SEA_INK = 2.2;
const WHALE_INK = 2.6;
const BOWL_INK = 2.4;
/** How far it swells when full, and how fat it is when it starts. */
const FAT_MAX = 1.55;
const FAT_START = 1.15;
/** Seconds of cruising before it gets hungry again. */
const HUNGER_S = 28;
const PILES = 6;
const PILE_GRAINS = 7;
const PILE_LIFE_S = 20;
const FLIERS = 12;
const FLIGHT_S = 0.45;
const SPOUTS = 24;
const BUBBLES = 6;
const BUBBLE_S = 1.6;
const RIM_GRAINS = 13;
/** Where the bowl may stand, as fractions of the view, best first. */
const BOWL_SPOTS = [
  [0.8, 0.78],
  [0.2, 0.78],
  [0.8, 0.32],
  [0.2, 0.32],
] as const;

type Mood = "cruise" | "seek" | "eat" | "burp";

interface Pile {
  x: number;
  y: number;
  t: number;
  /** Grains still on the water, one bit each. */
  left: number;
}

interface Flier {
  x: number;
  y: number;
  t: number;
  live: boolean;
}

interface Spout {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  live: boolean;
}

interface Bubble {
  glyph: number;
  x: number;
  y: number;
  t: number;
  scale: number;
  live: boolean;
}

const angleTo = (from: number, to: number) => {
  let d = to - from;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
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

export const createDafeijing = (
  levels: readonly string[] = DAFEIJING_LEVELS,
): InkPondScene => {
  const table = glyphTable([levels, WHALE_LEVELS, BOWL_LEVELS], LOOSE);
  const g = {
    belly: table.index("饱"),
    burp: table.index("嗝"),
    dash: table.index("一"),
    dot: table.index("丶"),
    eye: table.index("〇"),
    grain: table.index("粒"),
    hungry: table.index("饿"),
    laugh: table.index("哈"),
    mouth: table.index("口"),
    rice: table.index("米"),
    smell: table.index("香"),
    steam: table.index("～"),
  };
  let cols = 0;
  let rows = 0;
  let cell = 16;
  let width = 0;
  let height = 0;
  let warp: CoarseField = coarseField(0, 0);
  let patch: CoarseField = coarseField(0, 0);

  // The whale: base radius, where it is and how it moves.
  let R = 100;
  let wx = 0;
  let wy = 0;
  let vx = 0;
  let vy = 0;
  let course = 0;
  /** 1 facing right, -1 facing left. */
  let facing = 1;
  let fat = FAT_START;
  let hunger = 0;
  let mood: Mood = "cruise";
  let moodT = 0;
  /** Squash and stretch: + is wider and flatter. */
  let squash = 0;
  let squashV = 0;
  let laughUntil = Number.NEGATIVE_INFINITY;
  let lastLaugh = Number.NEGATIVE_INFINITY;
  let lastBite = Number.NEGATIVE_INFINITY;
  /** What it is after: the bowl (-1) or a pile on the water. */
  let goal = -1;
  /** The side it eats from the bowl on: 1 from the left, -1 the right. */
  let approach = 1;
  let burped = false;

  // The bowl: centre of the rim, half-width, depth, and how full it is.
  let bx = 0;
  let by = 0;
  let B = 90;
  let D = 64;
  let rice = 1;
  let spot = 0;
  let lastSpotCheck = Number.NEGATIVE_INFINITY;

  let piles: Pile[] = [];
  /** Each pile's grains as offsets, x then y, shared by every pile. */
  let scatter = new Float32Array(0);
  let fliers: Flier[] = [];
  let spouts: Spout[] = [];
  let bubbles: Bubble[] = [];
  let nextBubble = 0;
  let rimJitter = new Float32Array(0);

  // The pose the grid was last composed with; the face is drawn to match.
  let px0 = 0;
  let py0 = 0;
  let prx = 1;
  let pry = 1;
  let pf = 1;
  let pwag = 0;
  let pflap = 0;
  /** Set by whaleAt: whether the cell is on its cheek, or inside it at all. */
  let cheek = false;
  let inside = false;
  /** Set by bowlAt: the blue band, or the rice heap. */
  let band = false;
  let heap = false;

  /** Its half-width and half-height now, into rx and ry. */
  let rx = 1;
  let ry = 1;
  const radii = () => {
    rx = R * 1.12 * fat ** 0.8 * (1 + squash);
    ry = R * 0.9 * fat * (1 - squash * 0.8);
  };

  const placeBowl = (k: number) => {
    spot = k;
    const [fx, fy] = BOWL_SPOTS[k] ?? BOWL_SPOTS[0];
    bx = clamp(
      width * fx,
      B + cell * 2,
      Math.max(B + cell * 2, width - B - cell * 2),
    );
    by = clamp(
      height * fy,
      B * 0.7 + cell * 2,
      Math.max(B * 0.7 + cell * 2, height - D * 1.15 - cell * 2),
    );
  };

  const layoutAll = () => {
    R = clamp(Math.min(width, height) * 0.14, 56, 160);
    B = R * 0.9;
    D = B * 0.72;
    rice = 1;
    placeBowl(0);
    lastSpotCheck = Number.NEGATIVE_INFINITY;
    wx = width * 0.3;
    wy = height * 0.45;
    vx = 0;
    vy = 0;
    course = 0;
    facing = 1;
    fat = FAT_START;
    hunger = 0.75;
    mood = "cruise";
    moodT = 0;
    squash = 0;
    squashV = 0;
    goal = -1;
    const rand = rng(cols * 31 + rows * 17);
    scatter = new Float32Array(PILE_GRAINS * 2);
    for (let k = 0; k < PILE_GRAINS; k++) {
      const a = (k / PILE_GRAINS) * Math.PI * 2 + rand() * 0.6;
      const r = cell * (0.8 + rand() * 1.8);
      scatter[k * 2] = Math.cos(a) * r;
      scatter[k * 2 + 1] = Math.sin(a) * r * 0.7;
    }
    rimJitter = new Float32Array(RIM_GRAINS);
    for (let k = 0; k < RIM_GRAINS; k++) rimJitter[k] = rand() - 0.5;
    piles = Array.from({ length: PILES }, () => ({
      left: 0,
      t: 0,
      x: 0,
      y: 0,
    }));
    fliers = Array.from({ length: FLIERS }, () => ({
      live: false,
      t: 0,
      x: 0,
      y: 0,
    }));
    spouts = Array.from({ length: SPOUTS }, () => ({
      live: false,
      t: 0,
      vx: 0,
      vy: 0,
      x: 0,
      y: 0,
    }));
    bubbles = Array.from({ length: BUBBLES }, () => ({
      glyph: 0,
      live: false,
      scale: 1,
      t: 0,
      x: 0,
      y: 0,
    }));
    nextBubble = 0;
  };

  const say = (glyph: number, time: number, scale = 1.6) => {
    const b = bubbles[nextBubble] as Bubble;
    nextBubble = (nextBubble + 1) % BUBBLES;
    radii();
    b.glyph = glyph;
    b.live = true;
    b.scale = scale;
    b.t = time;
    b.x = wx + facing * rx * 0.35 + (noise(time, 4.4) - 0.5) * cell * 2;
    b.y = wy - ry - cell * 0.8;
  };

  const setMood = (next: Mood, time: number) => {
    mood = next;
    moodT = time;
  };

  /** How high the rice is heaped above the rim. */
  const heapHeight = () => B * 0.62 * rice + cell * 0.5;

  /** How much whale shows at (x, y), CSS px; sets `cheek` and `inside`. */
  const whaleAt = (x: number, y: number) => {
    cheek = false;
    const ex = (x - px0) / prx;
    const ey = (y - py0) / pry;
    const e = Math.sqrt(ex * ex + ey * ey);
    if (e <= 1) {
      inside = true;
      // Pockets of bare paper for the eye and the mouth.
      const eyeR = cell * 0.75 * eyeScale();
      if (Math.hypot(x - eyeX(), y - eyeY()) < eyeR) return 0;
      if (Math.hypot(x - mouthX(), y - mouthY()) < cell * 0.8) return 0;
      if (e > 0.88) return 0.95;
      const along = ex * pf;
      // 白肚皮: a pale belly with a few grooves under the chin.
      if (ey > 0.2 - 0.12 * along) {
        const groove = (Math.floor((y - py0) / cell + 1000) & 1) === 0;
        return groove && along > -0.3 && e < 0.8 ? 0.3 : 0;
      }
      if (Math.hypot(x - cheekX(), y - cheekY()) < R * 0.2) {
        cheek = true;
        return 0.42;
      }
      // A light back, so the outline and the face carry the drawing.
      return 0.28 + 0.24 * (noise(x / 40, y / 40) - 0.5) - 0.1 * ey;
    }
    inside = false;
    if (e > 2.2) return 0;
    // A tail far too small for it, wagging; one stubby fin, paddling.
    const rootX = px0 - pf * prx * 0.9;
    const rootY = py0 - pry * 0.05;
    const a = 0.55 + pwag;
    const sx = -pf * Math.cos(a);
    const sy = -Math.sin(a);
    const stalk = R * 0.5;
    let d = taper(x, y, rootX, rootY, sx, sy, stalk, R * 0.15, R * 0.07);
    const tipX = rootX + sx * stalk;
    const tipY = rootY + sy * stalk;
    for (let side = -1; side <= 1; side += 2) {
      const b = a + side * 0.8;
      d = Math.min(
        d,
        taper(
          x,
          y,
          tipX,
          tipY,
          -pf * Math.cos(b),
          -Math.sin(b),
          R * 0.36,
          R * 0.08,
          R * 0.03,
        ),
      );
    }
    const f = 0.9 + pflap;
    d = Math.min(
      d,
      taper(
        x,
        y,
        px0 + pf * prx * 0.05,
        py0 + pry * 0.6,
        -pf * Math.cos(f),
        Math.sin(f),
        R * 0.42,
        R * 0.1,
        R * 0.04,
      ),
    );
    return d < 0 ? 0.8 : 0;
  };

  const eyeScale = () => clamp(R / (cell * 4.5), 1, 2.4);
  const eyeX = () => px0 + pf * prx * 0.55;
  const eyeY = () => py0 - pry * 0.2;
  const mouthX = () => px0 + pf * prx * 0.86;
  const mouthY = () => py0 + pry * 0.16;
  const cheekX = () => px0 + pf * prx * 0.42;
  const cheekY = () => py0 + pry * 0.08;

  /** How much bowl shows at (x, y); sets `band` and `heap`. */
  const bowlAt = (x: number, y: number) => {
    band = false;
    heap = false;
    const dx = x - bx;
    if (Math.abs(dx) > B + cell) return 0;
    if (y < by) {
      const h = heapHeight();
      const ex = dx / (B * 0.9);
      const ey = (y - by) / h;
      if (ex * ex + ey * ey <= 1) heap = true;
      if (y > by - cell * 0.5 && Math.abs(dx) < B) return 0.9;
      return 0;
    }
    if (y < by + cell * 0.5 && Math.abs(dx) < B) return 0.9;
    const ex = dx / B;
    const ey = (y - by) / D;
    const e = ex * ex + ey * ey;
    if (e <= 1) {
      if (e > 0.82) return 0.9;
      const k = (y - by) / D;
      if (k > 0.22 && k < 0.38) {
        band = true;
        return 0.6;
      }
      return 0.32;
    }
    if (y > by + D * 0.9 && y < by + D * 1.12 && Math.abs(dx) < B * 0.32) {
      return 0.8;
    }
    return 0;
  };

  /** How open the water is at (x, y): on screen and clear of content. */
  const openness = (env: SceneEnv, x: number, y: number) => {
    if (x < cell * 2 || y < cell * 2) return 0;
    if (x > env.width - cell * 2 || y > env.height - cell * 2) return 0;
    return env.maskAt(x, y);
  };

  /** How open the water is around the bowl, were it to stand at spot k. */
  const bowlScore = (env: SceneEnv, k: number) => {
    placeBowl(k);
    let s = 0;
    for (let i = -1; i <= 1; i++) {
      for (let j = -1; j <= 1; j++) {
        s += openness(env, bx + i * B * 0.8, by + j * D * 0.6);
      }
    }
    return s / 9;
  };

  /** Move the bowl if content has come to cover where it stands. */
  const checkBowl = (env: SceneEnv) => {
    const current = spot;
    const now = bowlScore(env, current);
    let best = current;
    let bestScore = now;
    if (now < 0.9) {
      for (let k = 0; k < BOWL_SPOTS.length; k++) {
        const s = bowlScore(env, k);
        if (s > bestScore + 0.25) {
          best = k;
          bestScore = s;
        }
      }
    }
    placeBowl(best);
  };

  /** Where its mouth wants to be for what it is after, into gx and gy. */
  let gx = 0;
  let gy = 0;
  const goalPoint = () => {
    const p = piles[goal];
    // At the bowl, its mouth goes to the near side of the heap.
    gx = goal < 0 || !p ? bx - approach * B * 0.72 : p.x;
    gy = goal < 0 || !p ? by - heapHeight() * 0.45 : p.y;
  };

  /** Which side of the bowl has room for a whale. */
  const chooseApproach = (env: SceneEnv) => {
    const reach = B + R * 1.4;
    const left = openness(env, bx - reach, by - D * 0.3);
    const right = openness(env, bx + reach, by - D * 0.3);
    approach =
      Math.abs(left - right) > 0.1
        ? left > right
          ? 1
          : -1
        : bx > env.width / 2
          ? 1
          : -1;
  };

  /** How open the water is a distance `look` from the whale along `a`. */
  const ahead = (env: SceneEnv, a: number, look: number) => {
    const x = wx + Math.cos(a) * look;
    const y = wy + Math.sin(a) * look;
    // The bowl counts as in the way while it is not hungry.
    if (Math.hypot(x - bx, y - by) < B * 1.4) return 0;
    return openness(env, x, y);
  };

  const launch = (x: number, y: number, time: number) => {
    for (const f of fliers) {
      if (f.live) continue;
      f.live = true;
      f.t = time;
      f.x = x;
      f.y = y;
      return;
    }
  };

  const spout = (time: number) => {
    radii();
    const rand = rng(Math.floor(time * 1000));
    for (const s of spouts) {
      s.live = true;
      s.t = time + rand() * 0.5;
      s.x = wx + facing * rx * 0.15;
      s.y = wy - ry;
      s.vx = (rand() - 0.5) * R * 1.6;
      s.vy = -R * (2.2 + rand() * 1.4);
    }
  };

  /** Notice fresh ink: each new drop scatters a pile of rice. */
  const scatterRice = (env: SceneEnv) => {
    for (const d of env.drops) {
      if (d.age > 0.6) continue;
      const born = env.time - d.age;
      let known = false;
      let oldest = 0;
      for (let k = 0; k < PILES; k++) {
        const p = piles[k] as Pile;
        if (
          p.left &&
          Math.abs(p.t - born) < 0.4 &&
          Math.hypot(p.x - d.x, p.y - d.y) < cell * 2
        ) {
          known = true;
          break;
        }
        if (
          (piles[oldest] as Pile).left &&
          (!p.left || p.t < (piles[oldest] as Pile).t)
        ) {
          oldest = k;
        }
      }
      if (known) continue;
      const p = piles[oldest] as Pile;
      p.x = d.x;
      p.y = d.y;
      p.t = born;
      p.left = (1 << PILE_GRAINS) - 1;
    }
    for (const p of piles) {
      if (p.left && env.time - p.t > PILE_LIFE_S) p.left = 0;
    }
  };

  const nearestPile = (time: number) => {
    let best = -1;
    let dist = Number.POSITIVE_INFINITY;
    for (let k = 0; k < PILES; k++) {
      const p = piles[k] as Pile;
      if (!p.left || time - p.t > PILE_LIFE_S - 2) continue;
      const d = Math.hypot(p.x - wx, p.y - wy);
      if (d < dist) {
        dist = d;
        best = k;
      }
    }
    return best;
  };

  return {
    fontFamily: DAFEIJING_FONT_FAMILY,
    fontUrl: DAFEIJING_FONT_URL,
    glyphs: table.glyphs,
    moving: true,
    panSpeed: 0,
    ramps: table.ramps,
    compose(grid, _offset, time) {
      for (let cy = 0; cy < warp.h; cy++) {
        for (let cx = 0; cx < warp.w; cx++) {
          const x = cx * COARSE * cell;
          const y = cy * COARSE * cell;
          const j = cy * warp.w + cx;
          warp.data[j] = 3 * fbm(x / 320, y / 320 + time * 0.012);
          patch.data[j] = smoothstep(
            0.5,
            0.78,
            fbm(x / 240 + time * 0.008 + 5, y / 240),
          );
        }
      }
      // Snapshot the pose, breathing a little.
      radii();
      const breath = 1 + 0.025 * Math.sin(time * 1.7);
      px0 = wx;
      py0 = wy + Math.sin(time * 1.3) * R * 0.04;
      prx = rx * breath;
      pry = ry * breath;
      pf = facing;
      pwag = 0.3 * Math.sin(time * (mood === "eat" ? 7 : 3.4));
      pflap = 0.35 * Math.sin(time * 2.6);
      const reach = Math.max(prx, pry) + R * 1.1;
      const bowlTop = by - heapHeight() - cell;
      const bowlBottom = by + D * 1.15;
      grid.wet.fill(1);
      for (let y = 0; y < rows; y++) {
        const py = (y - 0.5) * cell;
        const nearWhaleRow = Math.abs(py - py0) < reach;
        const nearBowlRow = py > bowlTop && py < bowlBottom;
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const px = (x - 0.5) * cell;
          inside = false;
          const whale =
            nearWhaleRow && Math.abs(px - px0) < reach ? whaleAt(px, py) : 0;
          if (inside || whale > 0) {
            grid.kind[i] = WHALE;
            grid.ground[i] = whale * WHALE_INK;
            grid.pigment[i] = cheek ? YANZHI : INK;
            continue;
          }
          heap = false;
          const bowl = nearBowlRow ? bowlAt(px, py) : 0;
          if (bowl > 0) {
            grid.kind[i] = BOWL;
            grid.ground[i] = bowl * BOWL_INK;
            grid.pigment[i] = band ? HUAQING : INK;
            grid.wet[i] = 0.3;
            continue;
          }
          if (heap) {
            // 白米饭: the rice is the paper left bare.
            grid.kind[i] = SEA;
            grid.ground[i] = 0;
            grid.pigment[i] = INK;
            grid.wet[i] = 0;
            continue;
          }
          // Gentle swells, sparser than 北冥's, so the whale reads first.
          const a = Math.sin(
            (py * 0.98 + px * 0.2) / (cell * 2.6) + warp.at(x, y) - time * 0.38,
          );
          grid.kind[i] = SEA;
          grid.ground[i] =
            smoothstep(0.92, 1, a) *
            (0.2 + 0.8 * patch.at(x, y)) *
            0.38 *
            SEA_INK;
          grid.pigment[i] = INK;
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
      layoutAll();
    },
    stamps(env, emit) {
      const time = env.time;
      // Steam off the rice, now and then a 香.
      if (rice > 0.15) {
        const top = by - heapHeight();
        for (let k = 0; k < 3; k++) {
          const phase = time * 0.22 + k / 3;
          const u = phase % 1;
          const smell = Math.floor(phase) % 4 === k;
          emit(
            smell ? g.smell : g.steam,
            bx + (k - 1) * B * 0.32 + Math.sin(phase * 5) * cell * 0.6,
            top - u * B * 0.9,
            Math.sin(Math.PI * u) * (smell ? 0.45 : 0.3) * rice,
            smell ? 1.3 : 1,
            INK,
          );
        }
        // A few grains along the top of the heap.
        const h = heapHeight();
        for (let k = 0; k < RIM_GRAINS; k++) {
          const a = Math.PI + (Math.PI * (k + 0.5)) / RIM_GRAINS;
          const j = rimJitter[k] ?? 0;
          emit(
            g.rice,
            bx + Math.cos(a) * B * 0.9 * (0.94 + j * 0.06),
            by + Math.sin(a) * h * (0.92 + j * 0.1),
            0.45 + j * 0.3,
            0.8,
            INK,
          );
        }
      }

      for (const p of piles) {
        if (!p.left) continue;
        const fade = smoothstep(PILE_LIFE_S, PILE_LIFE_S - 3, time - p.t);
        for (let k = 0; k < PILE_GRAINS; k++) {
          if (!(p.left & (1 << k))) continue;
          emit(
            k % 3 ? g.rice : g.grain,
            p.x + (scatter[k * 2] ?? 0),
            p.y + (scatter[k * 2 + 1] ?? 0),
            0.75 * fade,
            0.85,
            INK,
          );
        }
      }

      // Grains on their way into the mouth, arcing up a little.
      const mx = mouthX();
      const my = mouthY();
      for (const f of fliers) {
        if (!f.live) continue;
        const u = clamp((time - f.t) / FLIGHT_S, 0, 1);
        emit(
          g.rice,
          f.x + (mx - f.x) * u,
          f.y + (my - f.y) * u - Math.sin(Math.PI * u) * cell * 2,
          0.8,
          0.9 - u * 0.3,
          INK,
        );
      }

      for (const s of spouts) {
        if (!s.live || time < s.t) continue;
        const age = time - s.t;
        emit(
          s.vx > 0 ? g.rice : g.grain,
          s.x,
          s.y,
          0.8 * smoothstep(2.2, 1.2, age),
          0.9,
          INK,
        );
      }

      // The face, on the pose the grid was composed with.
      const es = eyeScale();
      const eating = mood === "eat";
      const laughing = time < laughUntil;
      const blink = time % 4.3 < 0.15;
      if (eating || laughing || blink) {
        emit(g.dash, eyeX(), eyeY(), 0.95, es * 0.9, INK);
      } else {
        emit(g.eye, eyeX(), eyeY(), 0.95, es, INK);
        // The pupil looks at what it wants: the pointer, rice or ahead.
        let lx = pf;
        let ly = 0;
        const p = env.pointer;
        if (p) {
          lx = p.x - eyeX();
          ly = p.y - eyeY();
        } else if (mood === "seek") {
          goalPoint();
          lx = gx - eyeX();
          ly = gy - eyeY();
        }
        const l = Math.hypot(lx, ly) || 1;
        emit(
          g.dot,
          eyeX() + (lx / l) * cell * 0.22 * es,
          eyeY() + (ly / l) * cell * 0.22 * es,
          1,
          es * 0.75,
          INK,
        );
      }
      const burping =
        mood === "burp" && time - moodT > 0.8 && time - moodT < 1.6;
      const open =
        laughing || burping || (eating && Math.floor(time / 0.18) % 2 === 0);
      emit(
        open ? g.mouth : g.dash,
        mx,
        my,
        0.95,
        open ? es * 0.8 : es * 0.6,
        INK,
      );

      for (const b of bubbles) {
        if (!b.live) continue;
        const age = time - b.t;
        if (age > BUBBLE_S) {
          b.live = false;
          continue;
        }
        const u = age / BUBBLE_S;
        emit(
          b.glyph,
          b.x + Math.sin(age * 4) * cell * 0.3,
          b.y - u * cell * 2.5,
          0.9 * smoothstep(1, 0.6, u) * smoothstep(0, 0.1, u),
          b.scale * (0.8 + 0.3 * u),
          INK,
        );
      }
    },
    step(dt, env) {
      dt = Math.min(dt, 0.1);
      const time = env.time;
      if (!env.width || !env.height) return;
      if (time - lastSpotCheck > 3) {
        lastSpotCheck = time;
        checkBowl(env);
      }
      scatterRice(env);
      radii();

      // Tickled: the pointer on its body squashes it and makes it laugh.
      const p = env.pointer;
      if (p) {
        const ex = (p.x - wx) / rx;
        const ey = (p.y - wy) / ry;
        if (ex * ex + ey * ey < 1.1) {
          if (time - lastLaugh > 0.45) {
            lastLaugh = time;
            squashV += 2.4;
            say(g.laugh, time, 1.4);
          }
          laughUntil = time + 1;
          vx += ((wx - p.x) / rx) * R * 0.6 * dt;
          vy += ((wy - p.y) / ry) * R * 0.6 * dt;
        }
      }
      squashV += (-70 * squash - 3.2 * squashV) * dt;
      squash = clamp(squash + squashV * dt, -0.22, 0.22);

      // What it wants.
      if (mood === "cruise") {
        hunger += dt / HUNGER_S;
        fat = Math.max(1, fat - dt * 0.004);
        const pile = nearestPile(time);
        if (pile >= 0) {
          goal = pile;
          setMood("seek", time);
        } else if (hunger >= 1 && rice > 0.3) {
          goal = -1;
          chooseApproach(env);
          setMood("seek", time);
          say(g.hungry, time);
        }
      } else if (mood === "seek" && goal < 0) {
        const pile = nearestPile(time);
        if (pile >= 0) goal = pile;
      }
      if (mood === "seek" && goal >= 0 && !(piles[goal] as Pile).left) {
        const pile = nearestPile(time);
        goal = pile;
        if (pile < 0)
          setMood(hunger >= 1 && rice > 0.3 ? "seek" : "cruise", time);
      }

      let dvx = 0;
      let dvy = 0;
      /** How far it still has to go to its food. */
      let gap = Number.POSITIVE_INFINITY;
      if (mood === "cruise") {
        let turn = (noise(time * 0.05, 3.1) - 0.5) * 1.2;
        const cx = env.width / 2 - wx;
        const cy = env.height / 2 - wy;
        const m = Math.min(env.width, env.height);
        turn +=
          angleTo(course, Math.atan2(cy, cx)) *
          0.8 *
          smoothstep(m * 0.35, m * 0.65, Math.hypot(cx, cy));
        const look = Math.max(rx, ry) + cell * 3;
        if (ahead(env, course, look) < 0.7) {
          // Blocked: turn toward the most open way, looking wider if need be.
          let best = 0;
          let open = -1;
          for (let k = 1; k <= 4; k++) {
            for (let side = -1; side <= 1; side += 2) {
              const o = ahead(env, course + side * k * 0.75, look);
              if (o > open + 0.05) {
                open = o;
                best = side;
              }
            }
            if (open >= 0.7) break;
          }
          turn += (best || 1) * 1.8;
        }
        course += clamp(turn, -1.8, 1.8) * dt;
        const speed = R * 0.3;
        dvx = Math.cos(course) * speed;
        dvy = Math.sin(course) * speed * 0.6;
      } else if (mood === "seek") {
        goalPoint();
        const side = goal < 0 ? approach : gx >= wx ? 1 : -1;
        facing = side;
        const tx = gx - side * rx * 0.86 - wx;
        const ty = gy - ry * 0.16 - wy;
        const d = Math.hypot(tx, ty);
        gap = d;
        const speed = R * 0.55 * smoothstep(0, R * 0.6, d) + R * 0.05;
        dvx = (tx / (d || 1)) * speed;
        dvy = (ty / (d || 1)) * speed;
        if (d < Math.max(cell * 1.5, R * 0.25)) {
          setMood("eat", time);
          lastBite = time;
        }
      } else if (mood === "eat") {
        goalPoint();
        dvx = (gx - facing * rx * 0.86 - wx) * 2;
        dvy = (gy - ry * 0.16 - wy) * 2;
        if (time - lastBite > 0.32) {
          lastBite = time;
          if (goal < 0) {
            rice = Math.max(0, rice - 0.028);
            launch(
              bx + (noise(time, 1.7) - 0.5) * B * 0.8,
              by - heapHeight() * 0.6,
              time,
            );
          } else {
            const pile = piles[goal] as Pile;
            for (let k = 0; k < PILE_GRAINS; k++) {
              if (pile.left & (1 << k)) {
                pile.left &= ~(1 << k);
                launch(
                  pile.x + (scatter[k * 2] ?? 0),
                  pile.y + (scatter[k * 2 + 1] ?? 0),
                  time,
                );
                break;
              }
            }
          }
        }
        const done =
          goal < 0
            ? fat >= FAT_MAX || rice < 0.08 || time - moodT > 10
            : !(piles[goal] as Pile).left;
        if (done) {
          if (goal < 0) hunger = 0;
          if (fat >= FAT_MAX - 0.06) {
            setMood("burp", time);
            burped = false;
            say(g.belly, time);
          } else {
            const pile = nearestPile(time);
            goal = pile;
            setMood(pile >= 0 ? "seek" : "cruise", time);
          }
        }
      } else {
        // 饱, then 嗝: a spout of rice and it goes flat again.
        const age = time - moodT;
        vx *= 1 - Math.min(1, dt * 3);
        vy *= 1 - Math.min(1, dt * 3);
        if (!burped && age > 0.8) {
          burped = true;
          squashV -= 3.2;
          say(g.burp, time, 2.6);
          spout(time);
        }
        if (burped) fat += (1 - fat) * Math.min(1, dt * 1.1);
        if (age > 3.6) {
          hunger = 0;
          setMood("cruise", time);
        }
      }
      if (mood === "cruise" || mood === "seek") {
        // Shy of the page: content near its edge pushes it away.
        let ax = 0;
        let ay = 0;
        for (let k = 0; k < 8; k++) {
          const a = (k * Math.PI) / 4;
          const c = Math.cos(a);
          const s = Math.sin(a);
          const push = 1 - env.maskAt(wx + c * rx * 1.05, wy + s * ry * 1.05);
          ax -= c * push;
          ay -= s * push;
        }
        if (mood === "seek") {
          // Hungry: slide around the content instead of stalling at it.
          // Close to the food, the food wins.
          const near = smoothstep(R * 0.5, R * 1.5, gap);
          ax *= near;
          ay *= near;
          const push = Math.hypot(ax, ay);
          const sign = -ay * dvx + ax * dvy >= 0 ? 1 : -1;
          dvx += (ax * 0.15 - ay * sign * 0.6) * R;
          dvy += (ay * 0.15 + ax * sign * 0.6) * R;
          if (push > 1) {
            dvx /= push;
            dvy /= push;
          }
        } else {
          dvx += ax * R * 0.35;
          dvy += ay * R * 0.35;
          // Not hungry: it keeps off the rice.
          const ox = wx - bx;
          const oy = wy - (by - heapHeight() * 0.5);
          const od = Math.hypot(ox, oy) || 1;
          const keep = 1 - smoothstep((rx + B) * 0.9, (rx + B) * 1.4, od);
          dvx += (ox / od) * keep * R * 0.6;
          dvy += (oy / od) * keep * R * 0.6;
        }
      }
      if (mood !== "burp") {
        const k = Math.min(1, dt * (mood === "cruise" ? 1.2 : 2.5));
        vx += (dvx - vx) * k;
        vy += (dvy - vy) * k;
      }
      wx = clamp(wx + vx * dt, rx * 0.2, env.width - rx * 0.2);
      wy = clamp(wy + vy * dt, ry * 0.4, env.height - ry * 0.4);
      if (mood === "cruise") {
        if (vx * facing < -R * 0.06) facing = -facing;
      }

      // Grains in flight fatten it as they land.
      for (const f of fliers) {
        if (f.live && time - f.t >= FLIGHT_S) {
          f.live = false;
          fat = Math.min(FAT_MAX, fat + (goal < 0 ? 0.035 : 0.025));
        }
      }
      for (const s of spouts) {
        if (!s.live || time < s.t) continue;
        s.vy += R * 4 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (time - s.t > 2.2) s.live = false;
      }
      if (rice < 1 && mood !== "eat") rice = Math.min(1, rice + dt * 0.02);
    },
  };
};
