/** Deterministic value noise shared by the engine and the scenes. */

export const hash2 = (x: number, y: number) => {
  let n = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};

const ease = (a: number) => a * a * (3 - 2 * a);

/**
 * Value noise; with a period, x wraps every `period` units so a strip of it
 * tiles seamlessly (the panning scroll).
 */
export const noise = (x: number, y: number, period = 0) => {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = ease(x - xi);
  const fy = ease(y - yi);
  const x0 = period ? ((xi % period) + period) % period : xi;
  const x1 = period ? (x0 + 1) % period : xi + 1;
  const a = hash2(x0, yi);
  const b = hash2(x1, yi);
  const c = hash2(x0, yi + 1);
  const d = hash2(x1, yi + 1);
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
};

export const fbm = (x: number, y: number) =>
  0.57 * noise(x, y) +
  0.29 * noise(x * 2.03, y * 2.03) +
  0.14 * noise(x * 4.1, y * 4.1);

/** fbm that wraps every `period` units of x (whole octaves keep the seam). */
export const fbmTiled = (x: number, y: number, period: number) =>
  0.57 * noise(x, y, period) +
  0.29 * noise(x * 2, y * 2.03, period * 2) +
  0.14 * noise(x * 4, y * 4.1, period * 4);

export const smoothstep = (a: number, b: number, x: number) => {
  const k = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return k * k * (3 - 2 * k);
};

export const clamp = (x: number, a: number, b: number) =>
  x < a ? a : x > b ? b : x;

/** A seeded generator for layouts that must come out the same every time. */
export const rng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
};
