/**
 * InkPondEngine — an ink-wash background: Chinese glyphs laid on a cell grid
 * by stroke density. A scene (scene.ts) supplies the picture — distant hills
 * in mist by default, a lotus pond with koi, or a scroll of the river at
 * Qingming — and the engine runs what every scene shares: the pointer stirs
 * ripples through it, a click drops ink that blooms, pools at its rim and
 * fades, the page's content keeps a clear zone, and a panning scene scrolls
 * with its water. Pure Canvas 2D, no dependencies.
 *
 * The engine owns state and painting only; createInkPond (controller.ts)
 * owns the frame loop, input and performance tiers.
 * Costs are kept off the per-frame path: glyphs are rasterised once into an
 * atlas (one row per pigment), the scene's still parts and the clear zones
 * are precomputed per size, its slow layer is composed every few paints,
 * each ink blot touches only the cells inside its bounding box, and loose
 * glyphs (koi, boats) are a few dozen blits.
 *
 * jsdom/node safety: without a canvas or a 2D context the engine keeps its
 * state and simply never paints.
 */
import { DEFAULT_FALLBACK_FONTS } from "./glyphs.js";
import { clamp, hash2, noise, smoothstep } from "./noise.js";
import {
  type Emit,
  type InkPondScene,
  PIGMENTS,
  type SceneEnv,
  type SceneGrid,
} from "./scene.js";
import { createScene, type SceneName } from "./scenes/index.js";
import type { JieqiTerm } from "./scenes/jieqi/calendar.js";

export interface InkPondRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Wave sim rate: slower than 60 Hz so rings 荡漾 rather than flash past. */
export const STEP_S = 1 / 45;
const DAMP = 0.982;
/** Wave speed² at waveSpeed 1; capped below 0.25 to keep the simulation stable. */
const WAVE_C2 = 0.06;
const MAX_DROPS = 6;
const DROP_HOLD_S = 2.5;
const DROP_LIFE_S = 16;
const EDGE_SAMPLES = 64;
/**
 * Glyphs per atlas row: the atlas grows down, not across, so a large glyph
 * set at a high pixel ratio stays inside every GPU's texture limit.
 */
const ATLAS_COLUMNS = 16;
/** The slow layer is recomposed every this many paints. */
const COMPOSE_EVERY = 4;
/** 淡彩 when the page sets none (--inkpond-zhu and so on). */
export const DEFAULT_PIGMENT_COLORS = [
  "#c8452c",
  "#c45a78",
  "#a8683a",
  "#3d6b73",
] as const;

/** Below this mean wave energy the water counts as calm. */
const CALM_ENERGY = 0.0004;

interface Drop {
  x: number;
  y: number;
  t0: number;
  r: number;
  edge: Float32Array;
}

export interface InkPondEngineOptions {
  /** The picture: "shanshui" (default), "lotus", "qingming", "jieqi" or "beiming". */
  scene?: SceneName;
  /**
   * Stroke-density ramp of the scene's main ground, lightest level first.
   * The 节气 scene has a ramp per term and ignores it.
   */
  levels?: readonly string[];
  /** 节气 only: show this solar term, whatever the date. */
  term?: JieqiTerm;
  /**
   * 节气 only: show the term this date falls in. Without term or date the
   * scene shows today's and moves on when the next term begins.
   */
  date?: Date | number;
  /** Ink weight of the scene's picture (浓淡). Water and blots keep their own. */
  strength?: number;
  /** Ripple speed multiplier; 1 is the slow 荡漾 the defaults are tuned to. */
  waveSpeed?: number;
  /** CSS px kept bare around each avoided element (default 20). */
  avoidPadding?: number;
  /** CSS px over which the ground fades back in beyond that (default 140). */
  avoidFade?: number;
  /** Lay the scene's 淡彩 under the ink (default true); false is ink only. */
  tint?: boolean;
}

export interface InkPondFrame {
  /** No ripple left and no blot still blooming. */
  calm: boolean;
  /** Calm, and every blot has faded. */
  settled: boolean;
  /** Something in the scene moves by itself (koi, boats, the scroll). */
  moving: boolean;
}

export class InkPondEngine {
  readonly scene: InkPondScene;
  private readonly canvas: HTMLCanvasElement | null;
  private readonly ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private cell = 16;
  private cols = 0;
  private rows = 0;
  private width = 0;
  private height = 0;
  private h = new Float32Array(0);
  private v = new Float32Array(0);
  private ink = new Float32Array(0);
  private seed = new Float32Array(0);
  private blot = new Float32Array(0);
  private mask = new Float32Array(0);
  private grid: SceneGrid = {
    ground: new Float32Array(0),
    kind: new Uint8Array(0),
    pigment: new Uint8Array(0),
    wet: new Float32Array(0),
  };
  /** The scroll in whole cells, as last composed. */
  private offset = 0;
  private avoid: InkPondRect[] = [];
  private drops: Drop[] = [];
  private blotActive = false;
  private atlas: HTMLCanvasElement | null = null;
  private atlasCell = 0;
  /** Atlas rows per colour block. */
  private atlasRows = 1;
  /** Reused for the scene each frame, so moving scenes allocate nothing. */
  private readonly envDrops: { x: number; y: number; age: number }[] = [];
  private inkColor = "#0d0d0d";
  private pigmentColors: readonly string[] = DEFAULT_PIGMENT_COLORS;
  private alphaMax = 0.5;
  private fontFamily = DEFAULT_FALLBACK_FONTS;
  private readonly strength: number;
  private readonly c2: number;
  private readonly avoidPad: number;
  private readonly avoidFade: number;
  private readonly tint: boolean;
  private acc = 0;
  private energy = 0;
  private paints = 0;
  private lastPointer: { x: number; y: number; at: number } | null = null;
  private readonly env: SceneEnv;
  /** Seconds of simulated time; drives the slow layer, the blots and the scroll. */
  time = 0;

  constructor(
    canvas: HTMLCanvasElement | null,
    options: InkPondEngineOptions = {},
  ) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext("2d") ?? null;
    this.scene = createScene(
      options.scene,
      options.levels?.length ? options.levels : undefined,
      { date: options.date, term: options.term },
    );
    this.strength = options.strength ?? 0.45;
    this.c2 = Math.min(0.24, WAVE_C2 * (options.waveSpeed ?? 1) ** 2);
    this.avoidPad = options.avoidPadding ?? 20;
    this.avoidFade = Math.max(1, options.avoidFade ?? 140);
    this.tint = options.tint ?? true;

    this.env = {
      cell: 16,
      drops: [],
      height: 0,
      maskAt: (x, y) => this.maskAt(x, y),
      pan: 0,
      pointer: null,
      time: 0,
      width: 0,
    };
  }

  get cellCount() {
    return this.cols * this.rows;
  }

  /** CSS px the scroll has travelled. */
  get pan() {
    return this.time * this.scene.panSpeed;
  }

  /** Ink colour, the hills' darkest alpha and, optionally, the 淡彩 colours. */
  setInk(color: string, alphaMax: number, pigments?: readonly string[]) {
    this.inkColor = color;
    this.alphaMax = alphaMax;
    if (pigments) this.pigmentColors = pigments;
    this.buildAtlas();
  }

  setFontFamily(family: string) {
    this.fontFamily = family;
    this.buildAtlas();
  }

  /** CSS px size, the device pixel ratio to paint at, and the cell size. */
  resize(width: number, height: number, dpr: number, cell: number) {
    this.dpr = dpr;
    this.cell = cell;
    this.width = width;
    this.height = height;
    if (this.canvas) {
      this.canvas.width = Math.max(1, Math.round(width * dpr));
      this.canvas.height = Math.max(1, Math.round(height * dpr));
    }
    this.cols = Math.ceil(width / cell) + 2;
    this.rows = Math.ceil(height / cell) + 2;
    const n = this.cols * this.rows;
    this.h = new Float32Array(n);
    this.v = new Float32Array(n);
    this.ink = new Float32Array(n);
    this.blot = new Float32Array(n);
    this.seed = new Float32Array(n);
    this.grid = {
      ground: new Float32Array(n),
      kind: new Uint8Array(n),
      pigment: new Uint8Array(n),
      wet: new Float32Array(n),
    };
    this.lastPointer = null;
    this.scene.layout({
      cell,
      cols: this.cols,
      height,
      rows: this.rows,
      width,
    });
    this.precomputeMask();
    this.offset = Math.floor(this.pan / cell);
    this.compose();
    this.buildAtlas();
  }

  /** Content rects (CSS px, canvas-local) the ground fades away from. */
  setAvoid(rects: InkPondRect[]) {
    this.avoid = rects;
    this.precomputeMask();
  }

  isInsideAvoid(x: number, y: number) {
    return this.avoid.some(
      (r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom,
    );
  }

  /** 0 on the page's content, 1 in the open, at a canvas-local point. */
  maskAt(x: number, y: number) {
    const cx = Math.floor(x / this.cell) + 1;
    const cy = Math.floor(y / this.cell) + 1;
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return 0;
    return this.mask[cy * this.cols + cx] ?? 0;
  }

  /** A pointer sample in CSS px; the stroke since the last one stirs the water. */
  pointer(x: number, y: number, at: number) {
    const last = this.lastPointer;
    this.lastPointer = { at, x, y };
    if (!last) return;
    const dx = x - last.x;
    const dy = y - last.y;
    const dist = Math.hypot(dx, dy);
    if (dist === 0) return;
    const speed = dist / Math.max(8, at - last.at);
    const force = clamp(speed * 0.3, 0.05, 0.5);
    const steps = Math.max(1, Math.ceil(dist / (this.cell * 0.6)));
    for (let k = 1; k <= steps; k++) {
      this.disturb(
        last.x + (dx * k) / steps,
        last.y + (dy * k) / steps,
        (force / Math.sqrt(steps)) * 1.4,
        1.8,
        0.12,
      );
    }
  }

  pointerLeave() {
    this.lastPointer = null;
  }

  /** A ring of ripples from a point in CSS px; strength 0–1 (default 1). */
  ripple(x: number, y: number, strength = 1) {
    const k = clamp(strength, 0, 1);
    if (k > 0) this.disturb(x, y, 1.1 * k, 2.4, 0.2 * k);
  }

  /** 落墨 at a point; refused on the page's own content. */
  drop(x: number, y: number) {
    if (this.isInsideAvoid(x, y)) return false;
    this.disturb(x, y, 1.6, 3, 0.6);
    // The ragged edge depends only on direction, so sample it once per drop.
    const k = hash2(x * 7.1, y * 3.3 + this.time * 100) * 100;
    const edge = new Float32Array(EDGE_SAMPLES);
    for (let s = 0; s < EDGE_SAMPLES; s++) {
      const a = (s / EDGE_SAMPLES) * Math.PI * 2;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      edge[s] =
        0.72 +
        0.5 * noise(c * 2.2 + k, sn * 2.2 + k) +
        0.18 * noise(c * 7 + k, sn * 7);
    }
    this.drops.push({ edge, r: 70 + (k % 1) * 50, t0: this.time, x, y });
    if (this.drops.length > MAX_DROPS) this.drops.shift();
    return true;
  }

  /** Advance the water, the scroll and the scene by dt seconds. */
  advance(dt: number): InkPondFrame {
    this.time += dt;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP_S && n < 4) {
      this.step();
      this.acc -= STEP_S;
      n++;
    }
    if (n === 4) this.acc = 0;
    if (n) this.bleed();
    while (
      this.drops.length &&
      this.time - (this.drops[0]?.t0 ?? 0) > DROP_LIFE_S
    ) {
      this.drops.shift();
    }
    this.scroll();
    if (this.scene.moving && dt > 0) this.scene.step(dt, this.sceneEnv());
    const blooming = this.drops.some((d) => this.time - d.t0 < 3);
    const calm = this.energy < CALM_ENERGY && !blooming;
    return {
      calm,
      moving: this.scene.moving,
      settled: calm && this.drops.length === 0,
    };
  }

  /** Paint the current state; returns the number of glyphs drawn. */
  render() {
    if (this.paints++ % COMPOSE_EVERY === 0) this.compose();
    const frac = this.pan - this.offset * this.cell;
    this.updateBlots(frac);
    const ctx = this.ctx;
    const atlas = this.atlas;
    if (!ctx || !atlas || !this.canvas) return 0;
    const S = this.cell;
    const { cols, rows, dpr } = this;
    const { ground, kind, pigment, wet } = this.grid;
    const ramps = this.scene.ramps;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    const cs = this.atlasCell;
    const half = (S * dpr * 1.25) / 2;
    let drawn = 0;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1, i = y * cols + 1; x < cols - 1; x++, i++) {
        const mask = this.mask[i] ?? 0;
        const base = (ground[i] ?? 0) * mask * this.strength;
        const w = wet[i] ?? 1;
        const hi = (this.h[i] ?? 0) * w;
        const wave = Math.abs(hi) * 0.6 + (this.ink[i] ?? 0) * 0.5 * w;
        const blot = this.blotActive
          ? (this.blot[i] ?? 0) * (0.55 + 0.45 * mask)
          : 0;
        let val = base + wave * (0.3 + 0.7 * mask) + blot;
        const seed = this.seed[i] ?? 0;
        // 留白: sparse cells drop out entirely, so the ground breathes.
        if (val < 0.07 + seed * 0.09) continue;
        val = Math.min(1, val);

        const levels = ramps[kind[i] ?? 0] ?? ramps[0] ?? [];
        const level = Math.min(
          levels.length - 1,
          (val * levels.length * 1.05) | 0,
        );
        const choices = levels[level] ?? [];
        const glyph = choices[((seed * 997) | 0) % choices.length] ?? 0;
        // The picture keeps its colour until water or ink take the cell over.
        const pig = this.tint ? (pigment[i] ?? 0) : 0;
        const row = pig && blot < 0.25 && wave < base ? pig : 0;

        // Refraction: the glyph slides down the wave's slope; crests swell,
        // troughs pale. A blot may go past the picture's ceiling.
        const gx = ((this.h[i + 1] ?? 0) - (this.h[i - 1] ?? 0)) * S * 0.7 * w;
        const gy =
          ((this.h[i + cols] ?? 0) - (this.h[i - cols] ?? 0)) * S * 0.7 * w;
        const offX = clamp(gx, -S * 0.6, S * 0.6);
        const offY = clamp(gy, -S * 0.6, S * 0.6);
        const scale = 1 + clamp(hi, -1, 1) * 0.14;
        const alpha =
          val ** 1.15 *
          this.alphaMax *
          (1 + Math.min(1, blot) * 0.9) *
          clamp(1 + hi * 0.7, 0.35, 1.8);
        if (alpha < 0.012) continue;

        ctx.globalAlpha = Math.min(1, alpha);
        const size = cs * scale;
        const hs = half * scale;
        const px = (x - 1) * S + S / 2 - frac;
        const py = (y - 1) * S + S / 2;
        ctx.drawImage(
          atlas,
          (glyph % ATLAS_COLUMNS) * cs,
          (row * this.atlasRows + ((glyph / ATLAS_COLUMNS) | 0)) * cs,
          cs,
          cs,
          (px + offX) * dpr - hs,
          (py + offY) * dpr - hs,
          size,
          size,
        );
        drawn++;
      }
    }
    drawn += this.renderStamps(ctx, atlas);
    ctx.globalAlpha = 1;
    return drawn;
  }

  /** Reduced motion: no water, one settled frame. */
  renderStill() {
    this.h.fill(0);
    this.v.fill(0);
    this.ink.fill(0);
    this.drops = [];
    this.paints = 0;
    return this.render();
  }

  // ---- scene ----

  private sceneEnv() {
    const env = this.env;
    env.cell = this.cell;
    const drops = this.envDrops;
    drops.length = this.drops.length;
    this.drops.forEach((d, k) => {
      const out = drops[k] ?? { age: 0, x: 0, y: 0 };
      out.age = this.time - d.t0;
      out.x = d.x;
      out.y = d.y;
      drops[k] = out;
    });
    env.drops = drops;
    env.height = this.height;
    env.pan = this.pan;
    env.pointer = this.lastPointer;
    env.time = this.time;
    env.width = this.width;
    return env;
  }

  /** The scene's slow layer, and the per-cell seeds that travel with it. */
  private compose() {
    const { cols, rows } = this;
    this.scene.compose(this.grid, this.offset, this.time);
    for (let y = 0, i = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++, i++) {
        this.seed[i] = hash2(x + this.offset + 911, y);
      }
    }
  }

  /** A panning scene carries its water along whenever it crosses a cell. */
  private scroll() {
    if (!this.scene.panSpeed || !this.cols) return;
    const next = Math.floor(this.pan / this.cell);
    const k = next - this.offset;
    if (k <= 0) return;
    this.offset = next;
    const { cols, rows } = this;
    for (const field of [this.h, this.v, this.ink]) {
      for (let y = 0; y < rows; y++) {
        const row = y * cols;
        field.copyWithin(row, row + Math.min(k, cols), row + cols);
        field.fill(0, row + Math.max(0, cols - k), row + cols);
      }
    }
    for (const d of this.drops) d.x -= k * this.cell;
    this.compose();
  }

  private renderStamps(
    ctx: CanvasRenderingContext2D,
    atlas: HTMLCanvasElement,
  ) {
    if (!this.scene.moving) return 0;
    const { cell: S, cols, dpr } = this;
    const cs = this.atlasCell;
    const half = (S * dpr * 1.25) / 2;
    let drawn = 0;
    const emit: Emit = (glyph, x, y, alpha, scale, pigment) => {
      const cx = Math.floor(x / S) + 1;
      const cy = Math.floor(y / S) + 1;
      const i = cy * cols + cx;
      // Loose glyphs keep clear of the page's content and ride the ripples.
      const mask = this.maskAt(x, y);
      const a = alpha * this.alphaMax * 1.6 * (0.2 + 0.8 * mask);
      if (a < 0.012) return;
      const gx = ((this.h[i + 1] ?? 0) - (this.h[i - 1] ?? 0)) * S * 0.5;
      const gy = ((this.h[i + cols] ?? 0) - (this.h[i - cols] ?? 0)) * S * 0.5;
      const row = this.tint ? pigment : 0;
      ctx.globalAlpha = Math.min(1, a);
      ctx.drawImage(
        atlas,
        (glyph % ATLAS_COLUMNS) * cs,
        (row * this.atlasRows + ((glyph / ATLAS_COLUMNS) | 0)) * cs,
        cs,
        cs,
        (x + clamp(gx, -S * 0.5, S * 0.5)) * dpr - half * scale,
        (y + clamp(gy, -S * 0.5, S * 0.5)) * dpr - half * scale,
        cs * scale,
        cs * scale,
      );
      drawn++;
    };
    this.scene.stamps(this.sceneEnv(), emit);
    return drawn;
  }

  // ---- simulation ----

  private step() {
    const { cols, rows, h, v, ink } = this;
    let e = 0;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1, i = y * cols + 1; x < cols - 1; x++, i++) {
        const hc = h[i] ?? 0;
        const lap =
          (h[i - 1] ?? 0) +
          (h[i + 1] ?? 0) +
          (h[i - cols] ?? 0) +
          (h[i + cols] ?? 0) -
          4 * hc;
        v[i] = ((v[i] ?? 0) + this.c2 * lap) * DAMP;
      }
    }
    for (let i = 0; i < h.length; i++) {
      const vi = v[i] ?? 0;
      h[i] = clamp(((h[i] ?? 0) + vi) * 0.996, -1.6, 1.6);
      const inkI = (ink[i] ?? 0) * 0.986;
      ink[i] = inkI;
      e += Math.abs(vi) + inkI * 0.02;
    }
    this.energy = h.length ? e / h.length : 0;
  }

  /** 墨晕: the ink trail bleeds a little into its neighbours. */
  private bleed() {
    const { cols, rows, ink } = this;
    for (let y = 1; y < rows - 1; y++) {
      for (let x = 1, i = y * cols + 1; x < cols - 1; x++, i++) {
        const avg =
          ((ink[i - 1] ?? 0) +
            (ink[i + 1] ?? 0) +
            (ink[i - cols] ?? 0) +
            (ink[i + cols] ?? 0)) *
          0.25;
        const cur = ink[i] ?? 0;
        if (avg > cur) ink[i] = cur + (avg - cur) * 0.12;
      }
    }
  }

  private disturb(
    px: number,
    py: number,
    force: number,
    radius: number,
    inkAmount: number,
  ) {
    const { cols, rows } = this;
    const cx = px / this.cell + 1;
    const cy = py / this.cell + 1;
    const r = Math.ceil(radius);
    const y0 = Math.max(1, Math.floor(cy - r));
    const y1 = Math.min(rows - 2, Math.ceil(cy + r));
    const x0 = Math.max(1, Math.floor(cx - r));
    const x1 = Math.min(cols - 2, Math.ceil(cx + r));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (radius * radius);
        if (d2 > 1) continue;
        const f = Math.exp(-d2 * 3);
        const i = y * cols + x;
        this.v[i] = (this.v[i] ?? 0) - force * f;
        this.ink[i] = Math.min(1, (this.ink[i] ?? 0) + inkAmount * f);
      }
    }
  }

  /**
   * Blot density per cell, written only inside each drop's bounding box:
   * an irregular feathered edge, pigment pooling at the rim, a darker core.
   */
  private updateBlots(frac: number) {
    if (this.blotActive) this.blot.fill(0);
    this.blotActive = false;
    const { cols, rows, cell, blot } = this;
    for (const d of this.drops) {
      const age = this.time - d.t0;
      const fade = age < DROP_HOLD_S ? 1 : Math.exp(-(age - DROP_HOLD_S) / 3);
      if (fade < 0.02) continue;
      this.blotActive = true;
      const grow = 1 - Math.exp(-age / 0.45);
      const reach = d.r * grow * 1.4 * 1.35 + cell;
      const x0 = Math.max(1, Math.floor((d.x - reach) / cell) + 1);
      const x1 = Math.min(cols - 2, Math.ceil((d.x + reach) / cell) + 1);
      const y0 = Math.max(1, Math.floor((d.y - reach) / cell) + 1);
      const y1 = Math.min(rows - 2, Math.ceil((d.y + reach) / cell) + 1);
      for (let y = y0; y <= y1; y++) {
        const py = (y - 1) * cell + cell / 2;
        const dy = py - d.y;
        for (let x = x0, i = y * cols + x0; x <= x1; x++, i++) {
          const px = (x - 1) * cell + cell / 2 - frac;
          const dx = px - d.x;
          const s =
            ((Math.atan2(dy, dx) / (Math.PI * 2) + 1) * EDGE_SAMPLES) %
            EDGE_SAMPLES;
          const r = d.r * grow * (d.edge[s | 0] ?? 1) + 1;
          const q = Math.sqrt(dx * dx + dy * dy) / r;
          if (q > 1.35) continue;
          const core = q < 1 ? (1 - q) ** 0.55 * 0.75 : 0;
          const rim = Math.exp(-(((q - 0.96) / 0.12) ** 2)) * 0.55;
          const feather =
            q > 1
              ? (1 - smoothstep(1, 1.35, q)) *
                0.35 *
                noise(px * 0.15, py * 0.15)
              : 0;
          blot[i] = Math.min(
            1.2,
            (blot[i] ?? 0) + (core + rim + feather) * fade,
          );
        }
      }
    }
  }

  // ---- precomputed fields ----

  /** 0 on and around the page's content, rising to 1 across the fade. */
  private precomputeMask() {
    const { cols, rows, cell } = this;
    const n = cols * rows;
    if (this.mask.length !== n) this.mask = new Float32Array(n);
    if (!this.avoid.length) {
      this.mask.fill(1);
      return;
    }
    for (let y = 0; y < rows; y++) {
      const py = (y - 1) * cell + cell / 2;
      for (let x = 0, i = y * cols; x < cols; x++, i++) {
        const px = (x - 1) * cell + cell / 2;
        let nearest = Number.POSITIVE_INFINITY;
        for (const r of this.avoid) {
          const dx = Math.max(
            r.left - this.avoidPad - px,
            0,
            px - r.right - this.avoidPad,
          );
          const dy = Math.max(
            r.top - this.avoidPad - py,
            0,
            py - r.bottom - this.avoidPad,
          );
          nearest = Math.min(nearest, Math.hypot(dx, dy));
        }
        this.mask[i] = smoothstep(0, this.avoidFade, nearest);
      }
    }
  }

  /** Every glyph rasterised once per colour; frames only blit from it. */
  private buildAtlas() {
    if (!this.ctx || typeof document === "undefined") return;
    const cs = Math.ceil(this.cell * this.dpr * 1.25);
    const glyphs = this.scene.glyphs;
    const colors = [this.inkColor, ...this.pigmentColors];
    const blocks = this.tint ? colors.length : 1;
    const perBlock = Math.ceil(glyphs.length / ATLAS_COLUMNS);
    const atlas = document.createElement("canvas");
    atlas.width = cs * Math.min(ATLAS_COLUMNS, glyphs.length);
    atlas.height = cs * perBlock * blocks;
    const g = atlas.getContext("2d");
    if (!g) return;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.font = `500 ${Math.round(this.cell * 0.8 * this.dpr)}px ${this.fontFamily}`;
    colors.slice(0, blocks).forEach((color, block) => {
      g.fillStyle = color;
      glyphs.forEach((glyph, i) => {
        const x = (i % ATLAS_COLUMNS) * cs;
        const y = (block * perBlock + Math.floor(i / ATLAS_COLUMNS)) * cs;
        g.fillText(glyph, x + cs / 2, y + cs / 2 + this.dpr);
      });
    });
    this.atlas = atlas;
    this.atlasCell = cs;
    this.atlasRows = perBlock;
  }
}

/** The CSS custom properties the 淡彩 colours are read from, in atlas order. */
export const PIGMENT_PROPERTIES = PIGMENTS.map((name) => `--inkpond-${name}`);
