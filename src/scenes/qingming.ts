/**
 * 清明上河: a handscroll that unrolls slowly to the left. It opens on its
 * title in one column with a 朱 seal beneath; ranges of mountains rise over
 * a long walled city with a three-tiered gate tower and a pagoda, their
 * feet sinking into a band of haze; tiled roofs and 赭石 walls line both banks of a wide river, wine
 * flags and lanterns hang from the shops and willows trail their strands;
 * the 虹桥 leaps the river from one bank to the other the way it does in
 * the painting, an arch thronged with people. Boats with crews work the
 * river, people throng the streets and the bridge, birds cross the sky, and
 * ink dropped on the bank scatters whoever is near.
 *
 * The picture has two layers. The grid carries what is broad and still —
 * land, water, mountains, houses — and loose glyphs carry what wants a
 * smooth line or moves: the bridge's arch, flags, strands,
 * boats, people and birds. The world is a strip wider than any screen that
 * wraps seamlessly; its first screen is composed to be seen first.
 */
import { DEFAULT_LEVELS } from "../glyphs.js";
import { clamp, fbm, fbmTiled, rng, smoothstep } from "../noise.js";
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
  ZHE,
  ZHU,
} from "../scene.js";

export const QINGMING_FONT_FAMILY = "Inkpond Glyphs Qingming";
export const QINGMING_FONT_URL = new URL(
  "../assets/inkpond-qingming.woff2",
  import.meta.url,
).href;

const WATER = 0;
const LAND = 1;
const ROOF = 2;
const WALL = 3;
const TREE = 4;
const HILL = 5;
const CITY = 6;
const RAMPS = [
  DEFAULT_LEVELS,
  ["一", "丶", "土", "田", "里", "陌", "街", "道"],
  ["一", "冖", "宀", "穴", "宇", "宫", "庐", "檐"],
  ["丨", "口", "门", "户", "市", "店", "铺", "楼"],
  ["丿", "彡", "木", "丝", "柳", "杨", "林", "榆"],
  ["一", "二", "山", "丘", "岭", "峦", "峰", "嶂"],
  ["一", "土", "垣", "城", "郭", "墙", "堞", "阙"],
] as const;
/** Boats, people, the bridge, flags, birds and the sun. */
const LOOSE = "舟船篷帆桨丨～人仆客童驴马车轿梁拱栏一乙之酒灯丿乀〇伞棚丶";

/** Buildings, trees and mountains are the scroll's dark ink. */
const INK_WEIGHT = 1.8;
/** CSS px the scroll travels each second. */
const PAN_SPEED = 7;

interface Boat {
  id: number;
  /** World px along the strip. */
  x: number;
  /** -1 near the north bank, 0 mid-river, 1 near the south bank. */
  lane: number;
  dir: 1 | -1;
  speed: number;
  big: boolean;
}

type Path = "north" | "south" | "bridge";
interface Walker {
  id: number;
  /** World px along a street; unused on the bridge. */
  x: number;
  /** How far across the bridge, 0 at the south foot to 1 at the north. */
  t: number;
  path: Path;
  dir: 1 | -1;
  speed: number;
  /** Extra speed from a scare, decaying. */
  rush: number;
  glyph: number;
  pigment: Pigment;
  phase: number;
}

/** A loose glyph fixed in the world; `sway` px of wind at `phase`. */
interface Fixture {
  x: number;
  y: number;
  glyph: number;
  scale: number;
  alpha: number;
  pigment: Pigment;
  sway: number;
  phase: number;
}

interface Bird {
  x: number;
  y: number;
  phase: number;
}

export const createQingming = (
  levels: readonly string[] = DEFAULT_LEVELS,
): InkPondScene => {
  const table = glyphTable([levels, ...RAMPS.slice(1)], LOOSE);
  const g = (glyph: string) => table.index(glyph);
  const G = {
    beam: g("拱"),
    birdDown: g("一"),
    birdUp: g("乙"),
    deck: g("梁"),
    flag: g("酒"),
    eave: g("檐"),
    eaveL: g("丿"),
    eaveR: g("乀"),
    sun: g("〇"),
    dot: g("丶"),
    stall: g("棚"),
    umbrella: g("伞"),
    lantern: g("灯"),
    mast: g("丨"),
    oar: g("桨"),
    person: g("人"),
    rail: g("栏"),
    roof: g("篷"),
    sail: g("帆"),
    wake: g("～"),
  };
  const hulls = [g("船"), g("舟")];
  const crowd = [
    ...Array<string>(6).fill("人"),
    "仆",
    "客",
    "童",
    "驴",
    "马",
    "车",
    "轿",
  ].map(g);

  let cols = 0;
  let rows = 0;
  let cell = 16;
  /** World width in cells: wider than the screen, and wraps. */
  let W = 0;
  /** Noise cells across the world, whole so the strip tiles. */
  let P = 12;
  let base = new Float32Array(0);
  let kinds = new Uint8Array(0);
  let pigments = new Uint8Array(0);
  let haze: CoarseField = coarseField(0, 0);
  /**
   * The 虹桥 as a quadratic curve in world cells, as in the painting: the
   * south foot on the near bank below, the north foot on the far bank
   * above, the arch bowed out between them like a rainbow.
   */
  let bridge = { cx: 0, cy: 0, length: 1, nx: 0, ny: 0, sx: 0, sy: 0 };
  /** The moored boat lowering its mast beside the bridge, world cells. */
  let flagship = { col: 0, row: 0 };
  let fixtures: Fixture[] = [];
  let boats: Boat[] = [];
  let walkers: Walker[] = [];
  let birds: Bird[] = [];

  const wrap = (x: number, period: number) => ((x % period) + period) % period;
  /** Signed distance in cells from world column `at`, wrapped to ±W/2. */
  const distance = (x: number, at: number) => {
    const d = wrap(x - at, W);
    return d > W / 2 ? d - W : d;
  };
  const bank = (x: number, seed: number) =>
    fbmTiled((x / W) * P, seed, P) - 0.5;
  /**
   * The river is wide and mostly blank paper across the middle, where a
   * page's content usually sits; the life of the scroll is on its banks.
   */
  const riverTop = (x: number) => rows * (0.33 + 0.03 * bank(x, 1.7));
  const riverBottom = (x: number) => rows * (0.73 + 0.03 * bank(x, 5.3));
  /** The bridge `t` of the way from the south foot to the north. */
  const bridgeAt = (t: number) => {
    const u = 1 - t;
    const { cx, cy, nx, ny, sx, sy } = bridge;
    return {
      col: u * u * sx + 2 * u * t * cx + t * t * nx,
      row: u * u * sy + 2 * u * t * cy + t * t * ny,
    };
  };
  /** The unit normal at `t`, pointing out of the arch (up and away). */
  const bridgeNormal = (t: number) => {
    const { cx, cy, nx, ny, sx, sy } = bridge;
    const tx = 2 * (1 - t) * (cx - sx) + 2 * t * (nx - cx);
    const ty = 2 * (1 - t) * (cy - sy) + 2 * t * (ny - cy);
    const len = Math.hypot(tx, ty) || 1;
    return { col: ty / len, row: -tx / len };
  };
  const rowToPx = (row: number) => (row - 1) * cell + cell / 2;
  const colToPx = (col: number) => (col - 1) * cell + cell / 2;

  const set = (x: number, y: number, v: number, kind: number, p: Pigment) => {
    if (y < 0 || y >= rows) return;
    const i = y * W + wrap(Math.round(x), W);
    const ink = kind === LAND ? v : v * INK_WEIGHT;
    if (ink < (base[i] ?? 0) && kinds[i] !== LAND && kinds[i] !== WATER) {
      return;
    }
    base[i] = ink;
    kinds[i] = kind;
    pigments[i] = p;
  };
  const fix = (
    col: number,
    row: number,
    glyph: number,
    scale: number,
    alpha: number,
    pigment: Pigment,
    sway = 0,
  ) => {
    fixtures.push({
      alpha,
      glyph,
      phase: col * 0.37 + row * 0.11,
      pigment,
      scale,
      sway,
      x: colToPx(col),
      y: rowToPx(row),
    });
  };

  /** A house; returns the row of its roof ridge. */
  const house = (
    x0: number,
    width: number,
    groundRow: number,
    weight: number,
    rand: () => number,
    walls = 2 + Math.floor(rand() * 2),
  ) => {
    const roof = 2;
    const top = groundRow - walls - roof;
    // Roof: a narrow ridge over wide eaves that overhang the walls.
    for (let r = 0; r < roof; r++) {
      const inset = r === 0 ? 1 : -1;
      for (let x = x0 + inset; x < x0 + width - inset; x++) {
        const v = (r === 0 ? 0.95 : 0.78) + 0.12 * fbm(x * 0.7, top + r);
        set(x, top + r, v * weight, ROOF, INK);
      }
    }
    // Walls in 赭石, a darker door and a window or two left pale.
    const door = x0 + Math.floor(width / 2);
    for (let r = 0; r < walls; r++) {
      for (let x = x0; x < x0 + width; x++) {
        const y = top + roof + r;
        const opening =
          (x === door && r === walls - 1) || (r === 0 && (x - x0) % 3 === 1);
        const v = x === door && r === walls - 1 ? 0.7 : opening ? 0.18 : 0.42;
        set(x, y, v * weight, WALL, x === door ? INK : ZHE);
      }
    }
    // 飞檐: the eaves of the nearer houses turn up at their corners.
    if (weight >= 0.9) {
      fix(x0 - 1.45, top + 0.75, G.eaveL, 0.95, 0.85, INK);
      fix(x0 + width + 0.45, top + 0.75, G.eaveR, 0.95, 0.85, INK);
    }
    return top;
  };

  /** A shop's 酒旗 on a pole beside its eaves, flying in the wind. */
  const wineFlag = (col: number, ridge: number) => {
    for (let k = 0; k < 3; k++)
      fix(col, ridge - k * 0.7, G.mast, 0.8, 0.7, INK);
    fix(col + 0.8, ridge - 1.2, G.flag, 1.15, 0.95, ZHU, 2.5);
  };

  const willow = (x: number, groundRow: number, rand: () => number) => {
    const h = 3 + Math.floor(rand() * 2);
    for (let r = 1; r <= h; r++) set(x, groundRow - r, 0.5, TREE, INK);
    const cy = groundRow - h;
    for (let y = cy - 2; y <= cy + 2; y++) {
      for (let dx = -3; dx <= 3; dx++) {
        const d = Math.hypot(dx / 3, (y - cy) / 2.4);
        if (d > 1) continue;
        const strand = 0.5 + 0.5 * Math.cos((x + dx) * 2.1 + y * 0.2);
        set(
          x + dx,
          y,
          (0.3 + 0.35 * strand) * (1.1 - d),
          TREE,
          strand > 0.6 ? HUAQING : INK,
        );
      }
    }
    // Strands trailing from the crown, swaying more toward their tips.
    for (let k = -2; k <= 2; k++) {
      const len = 2 + Math.floor(rand() * 3);
      for (let j = 0; j < len; j++) {
        fix(
          x + k * 1.2 + (rand() - 0.5) * 0.4,
          cy + 2 + j * 0.55,
          G.mast,
          0.5,
          0.45 - j * 0.07,
          k % 2 ? HUAQING : INK,
          0.8 + j * 0.9,
        );
      }
    }
  };

  /** A many-eaved pagoda standing over the rooftops; returns its width. */
  const pagoda = (x: number, groundRow: number) => {
    const tiers = Math.max(3, Math.min(7, Math.floor((groundRow - 3) / 2)));
    for (let t = 0; t < tiers; t++) {
      const w = Math.max(2, 7 - t);
      const eaves = groundRow - 2 * t - 2;
      const left = x - Math.floor(w / 2);
      for (let c = left - 1; c <= left + w; c++) {
        set(c, eaves, 0.95, ROOF, INK);
      }
      for (let c = left; c < left + w; c++) {
        set(c, eaves + 1, c === x ? 0.6 : 0.42, WALL, c === x ? INK : ZHE);
      }
      fix(left - 1.45, eaves + 0.2, G.eaveL, 0.9, 0.85, INK);
      fix(left + w + 0.45, eaves + 0.2, G.eaveR, 0.9, 0.85, INK);
    }
    const crown = groundRow - 2 * tiers - 1;
    for (let k = 0; k < 3; k++) fix(x, crown - k * 0.75, G.mast, 0.9, 0.8, INK);
    return 9;
  };

  const layoutWorld = () => {
    W = Math.max(240, Math.ceil(cols * 1.7));
    P = Math.max(8, Math.round(W / 20));
    const n = W * rows;
    base = new Float32Array(n);
    kinds = new Uint8Array(n);
    pigments = new Uint8Array(n);
    fixtures = [];
    const rand = rng(W * 31 + rows);
    // The first screen gets the pagoda on the left, the city gate up to
    // the right and the bridge leaping the river between them: from the
    // near bank below, bowed up and over, down onto the far bank above.
    // The feet are far apart against the river's width, so the line
    // between them lies shallow and the bow rises up over the water rather
    // than out to one side: a long leg climbing from the near bank, the
    // crown about level with the far bank, a short drop onto it.
    const sx = Math.round(cols * 0.4);
    const sy = riverBottom(sx) + 0.6;
    const ny0 = riverTop(sx) - 0.6;
    const nx = sx + Math.round(clamp((sy - ny0) * 1.6, 18, 46));
    const ny = riverTop(nx) - 0.6;
    const chord = Math.hypot(nx - sx, ny - sy);
    // Bow out, up and to the left, by about 0.42 of the chord at the crown
    // (a quadratic's crown sits halfway to its control point).
    const out = { col: (ny - sy) / chord, row: -(nx - sx) / chord };
    const bow = chord * 0.36 * 2;
    bridge = {
      cx: (sx + nx) / 2 + out.col * bow,
      cy: (sy + ny) / 2 + out.row * bow,
      length: 1,
      nx,
      ny,
      sx,
      sy,
    };
    flagship = {
      col: (sx + nx) / 2 + 8,
      row: (riverTop(nx + 8) + riverBottom(nx + 8)) / 2 + 2,
    };
    const gate = Math.round(cols * 0.58);
    const tower = Math.round(cols * 0.24);

    for (let x = 0; x < W; x++) {
      const u = (x / W) * P;
      // Two ranges of 远山: tall pale 花青 peaks behind, ink nearer; their
      // feet sink into the band of haze above the city.
      const far =
        rows * (0.11 - 0.09 * smoothstep(0.3, 0.75, fbmTiled(u * 0.5, 3.1, P)));
      const near =
        rows * (0.17 - 0.08 * smoothstep(0.35, 0.8, fbmTiled(u * 0.9, 8.3, P)));
      const top = riverTop(x);
      const bottom = riverBottom(x);
      for (let y = 0; y < rows; y++) {
        const i = y * W + x;
        if (y >= top && y <= bottom) {
          kinds[i] = WATER;
          continue;
        }
        if (y < rows * 0.3) {
          const cun = 0.35 + 0.65 * fbmTiled(u * 4, y * 0.35, P * 4);
          // A dark crest line, the body washing paler toward its foot.
          const ridge = (r: number, w: number) =>
            y < r - 0.5
              ? 0
              : smoothstep(r - 0.5, r + 1, y) *
                Math.exp(-(y - r) / w) *
                (y - r < 1.2 ? 1.35 : 1);
          const vFar = ridge(far, rows * 0.1) * 0.36 * cun;
          const vNear = ridge(near, rows * 0.08) * 0.52 * cun;
          const v = Math.max(vFar, vNear);
          if (v > 0.04) {
            base[i] = v * INK_WEIGHT;
            kinds[i] = HILL;
            pigments[i] = vFar > vNear ? HUAQING : INK;
            continue;
          }
          // Open sky: dry paper, not water.
          if (y < far) {
            kinds[i] = LAND;
            continue;
          }
        }
        // The banks: a crisp line at the water, then pale tilled ground.
        const edge =
          Math.abs(y - top) < 1.2 || (y > bottom && y - bottom < 1.2);
        const grain = fbmTiled(u * 6, y * 0.6, P * 6);
        base[i] = edge ? 0.5 : 0.04 + 0.12 * smoothstep(0.55, 0.8, grain);
        kinds[i] = LAND;
        pigments[i] = grain > 0.62 ? ZHE : INK;
      }
    }

    // The city wall, with crenels, and a two-tiered gate tower.
    const cityFrom = gate - Math.round(cols * 0.2);
    const cityTo = gate + Math.round(cols * 0.26);
    const cityFoot = Math.floor(rows * 0.3) - 6;
    for (let x = cityFrom; x < cityTo; x++) {
      for (let y = cityFoot - 3; y < cityFoot; y++) {
        const crenel = y === cityFoot - 3 && x % 2 === 0;
        if (!crenel) set(x, y, y === cityFoot - 3 ? 0.75 : 0.55, CITY, INK);
      }
    }
    let tier = house(gate - 7, 15, cityFoot - 1, 1.05, rand, 2);
    if (tier > 4) tier = house(gate - 5, 11, tier, 1, rand, 1);
    if (tier > 4) house(gate - 3, 7, tier, 0.95, rand, 1);
    fix(gate + 8.5, cityFoot - 7, G.mast, 0.9, 0.7, INK);
    fix(gate + 9.3, cityFoot - 8, G.flag, 1.1, 0.9, ZHU, 2);

    // Houses and willows along both banks, clear of the bridge's feet.
    const street = (side: "north" | "south") => {
      let x = rand() * 4;
      while (x < W - 6) {
        const width = 4 + Math.floor(rand() * 5);
        // The far bank's bridgehead, and the market at the near one.
        const clear =
          side === "north"
            ? distance(x, bridge.cx) > -width - 4 && distance(x, bridge.nx) < 5
            : distance(x, bridge.sx) > -width - 14 &&
              distance(x, bridge.sx) < 6;
        if (clear) {
          x += 2;
          continue;
        }
        const span = Array.from({ length: width }, (_, k) => x + k);
        if (side === "north" && x <= tower && x + width > tower - 4) {
          const front = Math.floor(Math.min(...span.map(riverTop))) - 1;
          x = tower + pagoda(tower, front - 1) - 3;
          continue;
        }
        if (side === "north") {
          const front = Math.floor(Math.min(...span.map(riverTop))) - 1;
          if (rand() < 0.28) willow(Math.round(x + 2), front, rand);
          else {
            // A fainter row further back, except where the city wall stands.
            const behindWall = x + width > cityFrom - 2 && x < cityTo + 2;
            if (!behindWall && rand() < 0.35) {
              house(Math.round(x + 2), width - 1, front - 6, 0.6, rand);
            }
            const ridge = house(Math.round(x), width, front - 1, 1, rand);
            if (rand() < 0.3) wineFlag(Math.round(x) + width, ridge);
          }
        } else {
          const front = Math.ceil(Math.max(...span.map(riverBottom))) + 1;
          if (rand() < 0.32) willow(Math.round(x + 2), front + 7, rand);
          else {
            const ridge = house(Math.round(x), width, front + 8, 1, rand);
            if (rand() < 0.35) wineFlag(Math.round(x) + width, ridge);
            // Lanterns under the eaves of the busier shops.
            if (rand() < 0.4) {
              fix(x + 1, ridge + 2.2, G.lantern, 0.7, 0.85, ZHU, 1);
              fix(x + width - 2, ridge + 2.2, G.lantern, 0.7, 0.85, ZHU, 1);
            }
          }
        }
        x += width + 1 + Math.floor(rand() * 4);
      }
    };
    street("north");
    street("south");

    // 虹桥: a band of loose glyphs along the curve, as the painting shows
    // the bridge's side — railing on the outside, the deck, and two courses
    // of the timber arch beneath, with short approaches at either foot.
    const samples = 240;
    const lengths = [0];
    let prev = bridgeAt(0);
    for (let k = 1; k <= samples; k++) {
      const p = bridgeAt(k / samples);
      lengths.push(
        (lengths[k - 1] ?? 0) + Math.hypot(p.col - prev.col, p.row - prev.row),
      );
      prev = p;
    }
    bridge.length = lengths[samples] ?? 1;
    let k = 0;
    for (let d = 0, n = 0; d <= bridge.length; d += 0.32, n++) {
      while (k < samples && (lengths[k + 1] ?? 0) < d) k++;
      const t = k / samples;
      const p = bridgeAt(t);
      const o = bridgeNormal(t);
      const at = (off: number) =>
        [p.col + o.col * off, p.row + o.row * off] as const;
      const [rc, rr] = at(1);
      if (n % 2 === 0) fix(rc, rr, G.rail, 0.85, 0.7, INK);
      fix(p.col, p.row, G.deck, 1.4, 0.95, INK);
      const [b1c, b1r] = at(-0.85);
      fix(b1c, b1r, G.beam, 1.25, 0.85, ZHE);
      const [b2c, b2r] = at(-1.7);
      fix(b2c, b2r, G.beam, 1.05, 0.6, ZHE);
      if (n % 6 === 0) {
        const [sc, sr] = at(-2.4);
        fix(sc, sr, G.mast, 0.8, 0.45, ZHE);
      }
    }
    for (const [col, row, dir] of [
      [sx, sy, -1],
      [nx, ny, 1],
    ] as const) {
      for (let r = 1; r < 3; r++) fix(col, row + r * 0.75, G.mast, 1, 0.7, ZHE);
      for (let j = 1; j <= 5; j++) {
        fix(col + dir * j * 0.45, row, G.deck, 1.15, 0.85 - j * 0.1, INK);
      }
    }

    // The market at the near bridgehead: stalls and umbrellas, carts and
    // horses, and a standing crowd that sways as it talks.
    const mrand = rng(sx * 13 + rows);
    const ground = riverBottom(sx) + 1.2;
    for (let j = 0; j < 30; j++) {
      const col = sx - 12 + mrand() * 15;
      const row = ground + mrand() * 4.5;
      const r = mrand();
      const glyph =
        r < 0.12
          ? G.umbrella
          : r < 0.22
            ? G.stall
            : (crowd[Math.floor(mrand() * crowd.length)] ?? G.person);
      const big = glyph === G.umbrella || glyph === G.stall;
      fix(
        col,
        row,
        glyph,
        big ? 1.3 : 0.8,
        0.9,
        r < 0.3 ? ZHE : r > 0.9 ? ZHU : INK,
        big ? 0 : 0.6,
      );
    }

    // 近大远小: a few great eaves along the bottom edge, the nearest roofs.
    for (let col = 6; col < W - 8; col += 26 + Math.floor(rand() * 18)) {
      const w = 3 + Math.floor(rand() * 3);
      for (let j = 0; j < w; j++) {
        fix(col + j * 2.1, rows - 2.4, G.eave, 2.4, 0.55, INK);
      }
      fix(col - 1.6, rows - 3.1, G.eaveL, 2, 0.6, INK);
      fix(col + w * 2.1 - 0.4, rows - 3.1, G.eaveR, 2, 0.6, INK);
    }

    fixtures.sort((a, b) => a.x - b.x);
  };

  const spawn = (width: number) => {
    const rand = rng(W * 7 + rows * 13);
    boats = Array.from(
      { length: Math.max(6, Math.round(W / 26)) },
      (_, id) => ({
        big: rand() < 0.6,
        dir: rand() < 0.5 ? 1 : -1,
        id,
        // -1 near the north bank, 0 mid-river, 1 near the south bank.
        lane: Math.floor(rand() * 3) - 1,
        speed: 3 + rand() * 6,
        // One big boat in the first screen's near lane, under the bridge's side.
        x: id === 0 ? cols * 0.4 * cell : rand() * W * cell,
      }),
    );
    const first = boats[0];
    if (first) {
      first.big = true;
      first.lane = 1;
    }
    const people = (path: Path, count: number) =>
      Array.from({ length: count }, (_, k): Walker => {
        const r = rand();
        return {
          dir: rand() < 0.5 ? 1 : -1,
          glyph: crowd[Math.floor(rand() * crowd.length)] ?? 0,
          id: k,
          path,
          phase: rand() * 10,
          pigment: r < 0.1 ? ZHU : r < 0.2 ? ZHE : INK,
          rush: 0,
          speed: path === "bridge" ? 4 + rand() * 4 : 6 + rand() * 8,
          t: 0.04 + rand() * 0.92,
          x: rand() * W * cell,
        };
      });
    walkers = [
      ...people("north", Math.round(W / 5)),
      ...people("south", Math.round(W / 6)),
      ...people("bridge", 30),
    ];
    birds = Array.from({ length: 6 }, (_, k) => ({
      phase: rand() * 6,
      x: width * (0.55 + k * 0.05) + rand() * 30,
      y: rowToPx(rows * 0.04) + (k % 3) * 10 + rand() * 8,
    }));
  };

  /** World px → canvas px, or null when off screen. */
  const onScreen = (worldX: number, env: SceneEnv, margin = cell * 6) => {
    const span = W * cell;
    let x = wrap(worldX - env.pan, span);
    if (x > span - margin) x -= span;
    return x < -margin || x > env.width + margin ? null : x;
  };

  /** Where a walker stands: world px across, row down. */
  const walkerAt = (w: Walker) => {
    if (w.path === "bridge") {
      const p = bridgeAt(w.t);
      const o = bridgeNormal(w.t);
      return { row: p.row + o.row * 1.2, x: colToPx(p.col + o.col * 1.2) };
    }
    const col = w.x / cell + 0.5;
    return {
      row: w.path === "north" ? riverTop(col) - 0.8 : riverBottom(col) + 1.8,
      x: w.x,
    };
  };

  return {
    fontFamily: QINGMING_FONT_FAMILY,
    fontUrl: QINGMING_FONT_URL,
    glyphs: table.glyphs,
    moving: true,
    panSpeed: PAN_SPEED,
    ramps: table.ramps,
    compose(grid, offset, time) {
      // A band of 云烟 drifts between the city and the near bank, parting
      // the scroll into distances the way the painting does.
      const drift = time * 0.015;
      const period = Math.max(4, Math.round(P * 0.8));
      for (let cy = 0; cy < haze.h; cy++) {
        const ry = (cy * COARSE) / Math.max(1, rows);
        const band = 0.15 + 0.85 * Math.exp(-(((ry - 0.25) / 0.05) ** 2));
        for (let cx = 0; cx < haze.w; cx++) {
          const x = wrap(cx * COARSE + offset, W);
          haze.data[cy * haze.w + cx] =
            smoothstep(
              0.5,
              0.8,
              fbmTiled((x / W) * period, cy * 0.35 + drift, period),
            ) * band;
        }
      }
      const flow = time * 0.25;
      for (let y = 0; y < rows; y++) {
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          const wx = wrap(x + offset, W);
          const j = y * W + wx;
          const k = kinds[j] ?? WATER;
          grid.kind[i] = k;
          grid.pigment[i] = pigments[j] ?? INK;
          if (k === WATER) {
            grid.wet[i] = 1;
            // The current: long streaks moving downstream.
            grid.ground[i] =
              smoothstep(
                0.62,
                0.86,
                fbmTiled((wx / W) * P * 3 - flow, y * 0.55, P * 3),
              ) * 0.34;
          } else {
            grid.wet[i] = 0.12;
            // Haze veils the mountains' feet and the plain, never a
            // building: a half-hidden tower would leave its eaves floating.
            const veiled = k === HILL || k === LAND;
            grid.ground[i] =
              (base[j] ?? 0) * (veiled ? 1 - haze.at(x, y) * 0.8 : 1);
          }
        }
      }
    },
    layout(view) {
      cols = view.cols;
      rows = view.rows;
      cell = view.cell;
      haze = coarseField(cols, rows);
      layoutWorld();
      spawn(view.width);
    },
    stamps(env, emit) {
      // Fixtures are sorted by x: visit only the window on screen, which may
      // wrap past the world's end.
      const span = W * cell;
      const from = wrap(env.pan - cell * 3, span);
      const visit = (lo: number, hi: number) => {
        let a = 0;
        let b = fixtures.length;
        while (a < b) {
          const m = (a + b) >> 1;
          if ((fixtures[m]?.x ?? 0) < lo) a = m + 1;
          else b = m;
        }
        for (let k = a; k < fixtures.length; k++) {
          const f = fixtures[k];
          if (!f || f.x > hi) break;
          drawFixture(f);
        }
      };
      const drawFixture = (f: Fixture) => {
        const sx = onScreen(f.x, env, cell * 3);
        if (sx === null) return;
        const wind = f.sway
          ? Math.sin(env.time * 1.4 + f.phase) * f.sway +
            Math.sin(env.time * 0.37 + f.phase * 0.5) * f.sway * 0.5
          : 0;
        emit(f.glyph, sx + wind, f.y, f.alpha, f.scale, f.pigment);
      };
      for (const boat of boats) {
        const sx = onScreen(boat.x, env);
        if (sx === null) continue;
        const col = boat.x / cell + 0.5;
        // Three lanes: along either bank, and mid-river where nothing
        // covers the water.
        const top = riverTop(col);
        const bottom = riverBottom(col);
        const lane =
          boat.lane < 0
            ? top + 2
            : boat.lane > 0
              ? bottom - 1.3
              : (top + bottom) / 2 + 1;
        const y = rowToPx(lane) + Math.sin(env.time * 1.3 + boat.id) * 1.5;
        const s = boat.big ? 1.45 : 1.1;
        const n = boat.big ? 7 : 3;
        const gap = cell * 0.7 * s;
        const x0 = sx - ((n - 1) * gap) / 2;
        const stern = boat.dir > 0 ? x0 - gap : x0 + n * gap;
        const bow = boat.dir > 0 ? x0 + n * gap : x0 - gap;
        emit(
          G.wake,
          stern - boat.dir * gap * 0.6,
          y + cell * 0.25,
          0.3,
          0.9,
          INK,
        );
        emit(
          G.wake,
          stern - boat.dir * gap * 1.5,
          y + cell * 0.3,
          0.18,
          0.8,
          INK,
        );
        for (let k = 0; k < n; k++) {
          emit(hulls[k % 2] ?? 0, x0 + k * gap, y, 0.9, s, ZHE);
          if (k > 0 && k < n - 1) {
            emit(G.roof, x0 + k * gap, y - cell * 0.85 * s, 0.8, s, INK);
          }
        }
        const stroke = Math.sin(env.time * 1.8 + boat.id) * cell * 0.15;
        emit(G.oar, stern, y + stroke, 0.6, 0.8, INK);
        // Crew: a boatman at the stern, poling at the bow on the big ones.
        emit(G.person, stern, y - cell * 0.9, 0.85, 0.75, INK);
        if (boat.big) {
          emit(G.person, bow, y - cell * 0.8 + stroke * 0.3, 0.85, 0.75, INK);
          for (let m = 1; m <= 4; m++) {
            emit(G.mast, sx, y - cell * (0.9 + m * 0.75) * s, 0.65, 0.9, INK);
          }
          const billow = Math.sin(env.time * 0.9 + boat.id) * 1.5;
          emit(
            G.sail,
            sx + cell * 0.75 + billow,
            y - cell * 2.6 * s,
            0.6,
            1.1,
            INK,
          );
        }
      }
      // The great boat beside the bridge, its crew lowering the mast.
      const fx = onScreen(colToPx(flagship.col), env, cell * 12);
      if (fx !== null) {
        const bob = Math.sin(env.time * 1.1) * 1.5;
        const y = rowToPx(flagship.row) + bob;
        const gap = cell * 0.7 * 1.6;
        for (let k = -4; k <= 4; k++) {
          emit(hulls[(k + 4) % 2] ?? 0, fx + k * gap, y, 0.9, 1.6, ZHE);
          if (Math.abs(k) < 4) {
            emit(G.roof, fx + k * gap, y - cell * 1.35, 0.85, 1.5, INK);
          }
        }
        // The mast laid over toward the bridge, its crew hauling on it.
        for (let k = 0; k < 9; k++) {
          emit(
            G.eaveL,
            fx - k * cell * 0.62,
            y - cell * (2.2 + k * 0.42),
            0.75,
            1,
            INK,
          );
        }
        const haul = Math.sin(env.time * 1.6) * cell * 0.15;
        for (const [dx, dy] of [
          [-2.6, 2.3],
          [-1.2, 2.4],
          [0.4, 2.3],
          [1.9, 2.4],
          [3.4, 2.3],
          [-4.4, 0.9],
        ] as const) {
          emit(G.person, fx + dx * cell + haul, y - dy * cell, 0.9, 0.8, INK);
        }
        for (let k = 0; k < 4; k++) {
          emit(
            G.dot,
            fx - cell * (1.5 + k),
            y - cell * (2.6 + k * 0.8),
            0.5,
            0.7,
            INK,
          );
        }
      }
      // The bridge and the other fixtures after the boats, which pass
      // beneath it.
      const to = from + env.width + cell * 6;
      visit(from, Math.min(to, span));
      if (to > span) visit(0, to - span);
      for (const w of walkers) {
        const at = walkerAt(w);
        const sx = onScreen(at.x, env);
        if (sx === null) continue;
        const stride = Math.abs(Math.sin(w.phase)) * 1.6;
        emit(w.glyph, sx, rowToPx(at.row) - stride, 0.9, 0.78, w.pigment);
      }
      // A low sun far off: it drifts with a tenth of the scroll's pace.
      const sun = wrap(env.width * 0.84 - env.pan * 0.1, span);
      if (sun < env.width + cell * 4) {
        emit(G.sun, sun, rowToPx(rows * 0.09), 0.32, 3.4, ZHU);
      }
      for (const b of birds) {
        const up = Math.sin(b.phase) > 0;
        emit(up ? G.birdUp : G.birdDown, b.x, b.y, 0.6, 0.6, INK);
      }
    },
    step(dt, env) {
      const span = W * cell;
      for (const boat of boats) {
        boat.x = wrap(boat.x + boat.dir * boat.speed * dt, span);
      }
      for (const b of birds) {
        b.phase += dt * 5;
        b.x -= dt * 16;
        b.y += Math.sin(env.time * 0.8 + b.phase * 0.1) * dt * 3;
        if (b.x < -cell * 3) b.x = env.width + cell * (3 + (b.phase % 4));
      }
      for (const w of walkers) {
        // Fresh ink on the bank sends anyone nearby running.
        const at = walkerAt(w);
        const sx = onScreen(at.x, env);
        if (sx !== null) {
          const y = rowToPx(at.row);
          for (const d of env.drops) {
            if (d.age > 1.5) continue;
            const dx = sx - d.x;
            if (Math.hypot(dx, y - d.y) < cell * 6) {
              w.dir = dx >= 0 ? 1 : -1;
              w.rush = 40;
            }
          }
        }
        w.rush = Math.max(0, w.rush - dt * 25);
        const speed = w.speed + w.rush;
        w.phase += dt * speed * 0.35;
        if (w.path === "bridge") {
          // Walk the arch, turning back at either foot.
          w.t += (w.dir * speed * dt) / (bridge.length * cell);
          if (w.t < 0.03 || w.t > 0.97) {
            w.dir = w.t < 0.03 ? 1 : -1;
            w.t = clamp(w.t, 0.03, 0.97);
          }
        } else w.x = wrap(w.x + w.dir * speed * dt, span);
      }
    },
  };
};
