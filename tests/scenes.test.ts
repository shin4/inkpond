import { describe, expect, it } from "vitest";
import { InkPondEngine, STEP_S } from "../src/engine";
import { DEFAULT_LEVELS, glyphsOf } from "../src/glyphs";
import type { InkPondScene, SceneEnv } from "../src/scene";
import { createScene, SCENES } from "../src/scenes";

const view = { cell: 16, cols: 77, height: 800, rows: 52, width: 1200 };
/** A centred page column, like the demo's greeting and composer. */
const content = { bottom: 520, left: 380, right: 820, top: 280 };
const inContent = (x: number, y: number) =>
  x >= content.left &&
  x <= content.right &&
  y >= content.top &&
  y <= content.bottom;

const envFor = (overrides: Partial<SceneEnv> = {}): SceneEnv => ({
  cell: view.cell,
  drops: [],
  height: view.height,
  maskAt: (x, y) => (inContent(x, y) ? 0 : 1),
  pan: 0,
  pointer: null,
  time: 0,
  width: view.width,
  ...overrides,
});

/** Where each koi's head is, read from what the scene draws. */
const heads = (scene: InkPondScene, env: SceneEnv) => {
  const head = scene.glyphs.indexOf("鲤");
  const found: { x: number; y: number }[] = [];
  scene.stamps(env, (glyph, x, y) => {
    if (glyph === head) found.push({ x, y });
  });
  return found;
};

describe("scenes", () => {
  it("draw only glyphs from their own table", () => {
    for (const name of SCENES) {
      const scene = createScene(name);
      for (const ramp of scene.ramps) {
        for (const level of ramp) {
          expect(level.length).toBeGreaterThan(0);
          for (const glyph of level) {
            expect(scene.glyphs[glyph]).toBeDefined();
          }
        }
      }
    }
  });

  it("keep 山水 as the default, on the default ramp", () => {
    const scene = createScene();
    expect(scene.glyphs).toEqual(glyphsOf(DEFAULT_LEVELS));
    expect(scene.moving).toBe(false);
    expect(scene.panSpeed).toBe(0);
  });

  it("swim the koi around the page's content, not across it", () => {
    const scene = createScene("lotus");
    scene.layout(view);
    let inside = 0;
    let samples = 0;
    for (let t = 0; t < 60; t += 1 / 24) {
      const env = envFor({ time: t });
      scene.step(1 / 24, env);
      if (t < 5) continue;
      for (const h of heads(scene, env)) {
        samples++;
        if (inContent(h.x, h.y)) inside++;
      }
    }
    expect(samples).toBeGreaterThan(0);
    expect(inside / samples).toBeLessThan(0.05);
  });

  it("bring the koi to where ink was dropped", () => {
    const scene = createScene("lotus");
    scene.layout(view);
    const food = { age: 1, x: 140, y: 680 };
    const nearest = (env: SceneEnv) =>
      Math.min(
        ...heads(scene, env).map((h) => Math.hypot(h.x - food.x, h.y - food.y)),
      );
    const before = nearest(envFor());
    let t = 0;
    for (; t < 6; t += 1 / 24) {
      scene.step(1 / 24, envFor({ drops: [{ ...food, age: 1 + t }], time: t }));
    }
    expect(nearest(envFor({ time: t }))).toBeLessThan(Math.min(before, 120));
  });

  it("scatter the koi from the pointer", () => {
    const scene = createScene("lotus");
    scene.layout(view);
    const [first] = heads(scene, envFor());
    expect(first).toBeDefined();
    if (!first) return;
    const pointer = { x: first.x + 20, y: first.y };
    for (let t = 0; t < 1.5; t += 1 / 24) {
      scene.step(1 / 24, envFor({ pointer, time: t }));
    }
    const [after] = heads(scene, envFor({ time: 1.5 }));
    expect(after).toBeDefined();
    if (!after) return;
    expect(
      Math.hypot(after.x - pointer.x, after.y - pointer.y),
    ).toBeGreaterThan(80);
  });

  /** The 北冥 whale as composed: its cells, ink and where it is. */
  const whaleOf = (scene: InkPondScene, time: number, size = view) => {
    const n = size.cols * size.rows;
    const grid = {
      ground: new Float32Array(n),
      kind: new Uint8Array(n),
      pigment: new Uint8Array(n),
      wet: new Float32Array(n),
    };
    scene.compose(grid, 0, time);
    let ink = 0;
    let darkest = 0;
    let x = 0;
    let y = 0;
    let glyphs = 0;
    for (let i = 0; i < n; i++) {
      const g = grid.ground[i] ?? 0;
      // An upper bound on what the engine draws at the default strength.
      if (g * 0.45 >= 0.07) glyphs++;
      if (grid.kind[i] !== 1) continue;
      ink += g;
      darkest = Math.max(darkest, g);
      x += ((i % size.cols) - 0.5) * size.cell * g;
      y += (Math.floor(i / size.cols) - 0.5) * size.cell * g;
    }
    return { darkest, glyphs, ink, x: x / (ink || 1), y: y / (ink || 1) };
  };

  it("keep the 北冥 whale in view as it wanders", () => {
    const scene = createScene("beiming");
    scene.layout(view);
    let seen = 0;
    let samples = 0;
    for (let t = 0; t < 180; t += 1 / 24) {
      scene.step(1 / 24, envFor({ time: t }));
      if (Math.round(t * 24) % 48) continue;
      samples++;
      if (whaleOf(scene, t).ink > 20) seen++;
    }
    expect(seen / samples).toBeGreaterThan(0.9);
  });

  it("send the whale deeper from the pointer", () => {
    const run = (touch: boolean) => {
      const scene = createScene("beiming");
      scene.layout(view);
      let t = 0;
      for (; t < 4; t += 1 / 24) {
        const { x, y } = whaleOf(scene, t);
        scene.step(
          1 / 24,
          envFor({ pointer: touch ? { x, y } : null, time: t }),
        );
      }
      return whaleOf(scene, t).darkest;
    };
    expect(run(true)).toBeLessThan(run(false) * 0.8);
  });

  it("bring the whale toward dropped ink", () => {
    const food = { age: 1, x: 1100, y: 120 };
    const run = (fed: boolean) => {
      const scene = createScene("beiming");
      scene.layout(view);
      let t = 0;
      for (; t < 12; t += 1 / 24) {
        const drops = fed ? [{ ...food, age: 1 + (t % 8) }] : [];
        scene.step(1 / 24, envFor({ drops, time: t }));
      }
      const w = whaleOf(scene, t);
      return Math.hypot(w.x - food.x, w.y - food.y);
    };
    expect(run(true)).toBeLessThan(run(false));
  });

  it("keep 北冥 within the glyph budget at 1920×1080", () => {
    const size = { cell: 16, cols: 122, height: 1080, rows: 70, width: 1920 };
    const scene = createScene("beiming");
    scene.layout(size);
    let most = 0;
    for (let t = 0; t < 120; t += 1 / 24) {
      scene.step(
        1 / 24,
        envFor({
          height: size.height,
          maskAt: () => 1,
          time: t,
          width: size.width,
        }),
      );
      if (Math.round(t * 24) % 72 === 0) {
        most = Math.max(most, whaleOf(scene, t, size).glyphs);
      }
    }
    expect(most).toBeLessThan(2600);
  });

  it("unroll the 清明 scroll over time and keep it moving", () => {
    const engine = new InkPondEngine(null, { scene: "qingming" });
    engine.resize(1200, 800, 1, 16);
    expect(engine.pan).toBe(0);
    let frame = engine.advance(0);
    for (let t = 0; t < 4; t += STEP_S) frame = engine.advance(STEP_S);
    expect(engine.pan).toBeGreaterThan(20);
    expect(frame).toMatchObject({ calm: true, moving: true, settled: true });
  });

  it("tile the 清明 world seamlessly as it wraps", () => {
    const scene = createScene("qingming");
    scene.layout(view);
    const grid = () => ({
      ground: new Float32Array(view.cols * view.rows),
      kind: new Uint8Array(view.cols * view.rows),
      pigment: new Uint8Array(view.cols * view.rows),
      wet: new Float32Array(view.cols * view.rows),
    });
    // Whatever the world's width, every column's picture recurs after it.
    const strip = (offset: number) => {
      const g = grid();
      scene.compose(g, offset, 0);
      return Array.from(g.kind);
    };
    const start = strip(0);
    const widths = Array.from({ length: 400 }, (_, k) => k + 200);
    expect(widths.some((w) => strip(w).join() === start.join())).toBe(true);
  });
});
