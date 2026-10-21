/**
 * The contract between InkPondEngine and a scene. The engine owns what every
 * scene shares — the water, the ink blots, the clear zones, the glyph atlas
 * and the panning — and a scene supplies the picture:
 *
 * - layout(): per size, precompute everything that never moves;
 * - compose(): the slow layer (mist, haze), written into the engine's
 *   per-cell grid every few paints and whenever the scroll crosses a cell;
 * - step()/stamps(): the few things that move freely (koi, boats, people),
 *   advanced with the simulation and drawn as loose glyphs over the grid.
 *
 * Like the engine, a scene never touches the DOM, timers or storage.
 */

/**
 * The 淡彩 a scene may lay under its ink, in atlas-row order after ink (0):
 * 朱 vermilion, 胭脂 rouge, 赭石 ochre, 花青 indigo.
 */
export const PIGMENTS = ["zhu", "yanzhi", "zhe", "huaqing"] as const;
export type Pigment = 0 | 1 | 2 | 3 | 4;
export const INK: Pigment = 0;
export const ZHU: Pigment = 1;
export const YANZHI: Pigment = 2;
export const ZHE: Pigment = 3;
export const HUAQING: Pigment = 4;

/** The engine's grid: one cell border on every side, in CSS px cells. */
export interface SceneView {
  cols: number;
  rows: number;
  cell: number;
  width: number;
  height: number;
}

/** Per-cell layers the scene composes; all sized cols × rows. */
export interface SceneGrid {
  /** Ink density of the picture, 0–1 (before strength and the clear zones). */
  ground: Float32Array;
  /** Which of the scene's ramps draws the cell. */
  kind: Uint8Array;
  pigment: Uint8Array;
  /** How much ripples show here: 1 on water, low on land. */
  wet: Float32Array;
}

/** What a scene may read of the engine while it moves things. */
export interface SceneEnv {
  /** Seconds of simulated time. */
  time: number;
  width: number;
  height: number;
  cell: number;
  /** CSS px the scroll has travelled; 0 for a fixed scene. */
  pan: number;
  /** 0 on the page's content, 1 in the open (canvas-local CSS px). */
  maskAt(x: number, y: number): number;
  /** The pointer over the pond, if any (canvas-local CSS px). */
  pointer: { x: number; y: number } | null;
  /** Ink blots still on the water, with their age in seconds. */
  drops: readonly { x: number; y: number; age: number }[];
}

/** Draw one loose glyph centred on (x, y), canvas-local CSS px. */
export type Emit = (
  glyph: number,
  x: number,
  y: number,
  alpha: number,
  scale: number,
  pigment: Pigment,
) => void;

export interface InkPondScene {
  /** Every glyph the scene draws, in atlas order. */
  readonly glyphs: readonly string[];
  /** ramps[kind][level] lists glyph indices, lightest level first. */
  readonly ramps: readonly (readonly (readonly number[])[])[];
  readonly fontFamily: string;
  readonly fontUrl: string;
  /** Scroll speed in CSS px per second; 0 keeps the picture still. */
  readonly panSpeed: number;
  /** Whether anything moves by itself (sprites or the scroll). */
  readonly moving: boolean;
  layout(view: SceneView): void;
  /** `offset` is the scroll in whole cells; `time` drives the slow layer. */
  compose(grid: SceneGrid, offset: number, time: number): void;
  step(dt: number, env: SceneEnv): void;
  stamps(env: SceneEnv, emit: Emit): void;
}

/** Cells per coarse sample: slow fields look the same read bilinearly. */
export const COARSE = 4;

/** A field sampled every COARSE cells and read back bilinearly per cell. */
export const coarseField = (cols: number, rows: number) => {
  const w = Math.ceil(cols / COARSE) + 2;
  const h = Math.ceil(rows / COARSE) + 2;
  const data = new Float32Array(w * h);
  return {
    data,
    h,
    w,
    /** The value at cell (x, y). */
    at(x: number, y: number) {
      const fx = x / COARSE;
      const fy = y / COARSE;
      const x0 = fx | 0;
      const y0 = fy | 0;
      const ax = fx - x0;
      const ay = fy - y0;
      const j = y0 * w + x0;
      const a = data[j] ?? 0;
      const b = data[j + 1] ?? 0;
      const c = data[j + w] ?? 0;
      const d = data[j + w + 1] ?? 0;
      const top = a + (b - a) * ax;
      return top + (c + (d - c) * ax - top) * ay;
    },
  };
};
export type CoarseField = ReturnType<typeof coarseField>;

/**
 * The glyph table for a set of ramps (each a list of levels, each level a
 * string of glyphs) plus loose glyphs: distinct glyphs in order of first
 * appearance, ramps as index lists, and a lookup for the loose ones.
 */
export const glyphTable = (
  ramps: readonly (readonly string[])[],
  loose = "",
) => {
  const glyphs = [...new Set([...ramps.flat().join(""), ...loose])];
  const index = (glyph: string) => {
    const i = glyphs.indexOf(glyph);
    if (i < 0) throw new Error(`inkpond: glyph ${glyph} is not in the table`);
    return i;
  };
  return {
    glyphs,
    index,
    ramps: ramps.map((levels) => levels.map((level) => [...level].map(index))),
  };
};
