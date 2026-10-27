/**
 * What one solar term supplies to the 节气 scene (index.ts), which owns the
 * shared glyph table, the clock and the cross-fade between terms.
 *
 * A term is a smaller scene: cell() is its slow layer, read once per cell
 * whenever the engine composes (every few paints), so whatever moves fast
 * belongs in stamps(); step() advances the few things that move by
 * themselves and must not allocate per call.
 */
import type { Pigment, SceneEnv } from "../../scene.js";
import type { JieqiTerm } from "./calendar.js";

/** One cell of the slow layer, written by Term.cell. */
export interface TermCell {
  /** Ink density, 0–1. */
  v: number;
  p: Pigment;
  /** Which of the term's own ramps draws the cell. */
  k: number;
  /** How much ripples show: 1 on water, lower on land. */
  wet: number;
}

export interface TermView {
  width: number;
  height: number;
  cell: number;
}

/** Draw a glyph (from TermKit.glyph) centred at canvas-local CSS px. */
export type TermEmit = (
  glyph: number,
  x: number,
  y: number,
  alpha: number,
  scale: number,
  pigment: Pigment,
) => void;

export interface Term {
  /** Per size: place everything; the state starts over. */
  layout(view: TermView): void;
  /** The slow layer at canvas-local (x, y); cx, cy count cells from 0. */
  cell(
    x: number,
    y: number,
    t: number,
    out: TermCell,
    cx: number,
    cy: number,
  ): void;
  /** `t` is the term's own clock in seconds. */
  step(dt: number, t: number, env: SceneEnv): void;
  stamps(t: number, emit: TermEmit): void;
  /** Ink was dropped here: a term may answer it (a strike, a bloom). */
  drop?(x: number, y: number, t: number): void;
}

export interface TermKit {
  /** Seeded, so a term lays out the same way every time. */
  rand: () => number;
  /** Index of a loose glyph in the scene's table. */
  glyph: (char: string) => number;
}

export interface TermSpec {
  id: JieqiTerm;
  /** The ground's stroke-density ramps, lightest level first. */
  ramps: readonly (readonly string[])[];
  /** Glyphs drawn loose by stamps(). */
  loose: string;
  /** Seconds simulated before the first frame, so it opens mid-scene. */
  warm: number;
  create(kit: TermKit): Term;
}

export const TAU = Math.PI * 2;

/** A soft ring of radius r and half-width w, at distance d. */
export const ring = (d: number, r: number, w: number) => {
  const k = (d - r) / w;
  return Math.exp(-k * k);
};

export const angleTo = (from: number, to: number) => {
  let d = to - from;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
};

/** A loose thing — a raindrop, a spark, a ring — alive while life > 0. */
export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  /** Free slots: a birth time, a phase, a size. */
  a: number;
  b: number;
}

/** A fixed pool, allocated per layout so that stepping allocates nothing. */
export const pool = (n: number): Particle[] =>
  Array.from({ length: n }, () => ({
    a: 0,
    b: 0,
    life: 0,
    vx: 0,
    vy: 0,
    x: 0,
    y: 0,
  }));

/** A free slot, or the oldest-lived one when the pool is full. */
export const spawn = (ps: Particle[]) => {
  let pick = ps[0];
  for (const p of ps) {
    if (p.life <= 0) return p;
    if (pick && p.life < pick.life) pick = p;
  }
  return pick;
};

/** Water at rest: the lightest levels shared by the water scenes. */
export const WATER = ["丶", "一", "二", "氵", "水", "汀", "波", "澜"] as const;
