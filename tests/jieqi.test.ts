import { afterEach, describe, expect, it, vi } from "vitest";
import { InkPondEngine, STEP_S } from "../src/engine";
import type { InkPondScene, SceneEnv, SceneGrid } from "../src/scene";
import { createScene } from "../src/scenes";
import { JIEQI, jieqiAt, sunLongitude } from "../src/scenes/jieqi/calendar";
import { TERM_SPECS } from "../src/scenes/jieqi/index";

const view = { cell: 16, cols: 77, height: 800, rows: 52, width: 1200 };
const envFor = (overrides: Partial<SceneEnv> = {}): SceneEnv => ({
  cell: view.cell,
  drops: [],
  height: view.height,
  maskAt: () => 1,
  pan: 0,
  pointer: null,
  time: 0,
  width: view.width,
  ...overrides,
});
const gridFor = (): SceneGrid => {
  const n = view.cols * view.rows;
  return {
    ground: new Float32Array(n),
    kind: new Uint8Array(n),
    pigment: new Uint8Array(n),
    wet: new Float32Array(n),
  };
};
/** The first kind of each term's ramps in the shared table. */
const firstKinds: number[] = [];
for (let i = 0, k = 0; i < TERM_SPECS.length; i++) {
  firstKinds.push(k);
  k += TERM_SPECS[i]?.ramps.length ?? 0;
}
/** Which term drew most of a composed grid. */
const termOf = (grid: SceneGrid) => {
  const votes = new Array(TERM_SPECS.length).fill(0);
  for (const kind of grid.kind) {
    let term = 0;
    while (term + 1 < firstKinds.length && kind >= (firstKinds[term + 1] ?? 0))
      term++;
    votes[term]++;
  }
  return votes.indexOf(Math.max(...votes));
};

afterEach(() => vi.useRealTimers());

describe("solar terms", () => {
  it("find the term a date falls in", () => {
    // 立春 2026 begins 4 February, 04:02 in China.
    expect(jieqiAt(new Date("2026-02-03T12:00:00+08:00"))).toBe("dahan");
    expect(jieqiAt(new Date("2026-02-04T12:00:00+08:00"))).toBe("lichun");
    expect(jieqiAt(new Date("2026-03-21T12:00:00+08:00"))).toBe("chunfen");
    expect(jieqiAt(new Date("2026-06-22T12:00:00+08:00"))).toBe("xiazhi");
    expect(jieqiAt(new Date("2026-10-27T12:00:00+08:00"))).toBe("shuangjiang");
    expect(jieqiAt(new Date("2026-12-22T12:00:00+08:00"))).toBe("dongzhi");
  });

  it("put the sun at the equinox longitude in March", () => {
    const lon = sunLongitude(new Date("2026-03-20T14:46:00Z"));
    expect(Math.min(lon, 360 - lon)).toBeLessThan(0.05);
  });

  it("list all twenty-four, 15° apart, in order", () => {
    expect(JIEQI).toHaveLength(24);
    expect(TERM_SPECS.map((spec) => spec.id)).toEqual(JIEQI.map((t) => t.id));
    JIEQI.forEach((term, i) => {
      expect(term.longitude).toBe((315 + i * 15) % 360);
    });
  });
});

describe("节气 scene", () => {
  it("paints every term with glyphs from its table, without throwing", () => {
    for (const term of JIEQI) {
      const engine = new InkPondEngine(null, { scene: "jieqi", term: term.id });
      engine.resize(1200, 800, 1, 16);
      for (let t = 0; t < 3; t += 1 / 24) {
        engine.advance(1 / 24);
        engine.render();
      }
      const scene = engine.scene;
      const grid = gridFor();
      scene.layout(view);
      scene.compose(grid, 0, 0);
      expect(grid.ground.some((v) => v > 0.2)).toBe(true);
      expect(termOf(grid)).toBe(JIEQI.indexOf(term));
      for (const kind of grid.kind) expect(scene.ramps[kind]).toBeDefined();
      let stamps = 0;
      scene.step(1 / 24, envFor({ time: 1 / 24 }));
      scene.stamps(envFor(), (glyph, x, y, alpha, scale) => {
        expect(scene.glyphs[glyph]).toBeDefined();
        expect(Number.isFinite(x + y + alpha + scale)).toBe(true);
        stamps++;
      });
      expect(stamps).toBeLessThan(1500);
    }
  });

  it("shows the given date's term and stays on it", () => {
    const scene = createScene("jieqi", undefined, {
      date: new Date("2026-07-10T12:00:00+08:00"),
    });
    scene.layout(view);
    const grid = gridFor();
    for (let t = 0; t < 200; t += 1) scene.step(1, envFor({ time: t }));
    scene.compose(grid, 0, 200);
    expect(JIEQI[termOf(grid)]?.id).toBe("xiaoshu");
  });

  it("follows the clock into the next term while open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T00:00:00+08:00"));
    const scene: InkPondScene = createScene("jieqi");
    scene.layout(view);
    const grid = gridFor();
    scene.compose(grid, 0, 0);
    expect(JIEQI[termOf(grid)]?.id).toBe("shuangjiang");
    // 立冬 2026 begins 7 November, 17:52 in China.
    vi.setSystemTime(new Date("2026-11-07T20:00:00+08:00"));
    let t = 0;
    for (; t < 64; t += 1 / 4) scene.step(1 / 4, envFor({ time: t }));
    scene.compose(grid, 0, t);
    expect(JIEQI[termOf(grid)]?.id).toBe("lidong");
  });

  it("answers a drop: 惊蛰 strikes where the ink fell", () => {
    const scene = createScene("jieqi", undefined, { term: "jingzhe" });
    scene.layout(view);
    const spark = scene.glyphs.indexOf("电");
    const env = envFor({ drops: [{ age: 1 / 24, x: 900, y: 600 }], time: 10 });
    scene.step(1 / 24, env);
    let lowest = { x: 0, y: -1 };
    scene.stamps(env, (glyph, x, y) => {
      if (glyph === spark && y > lowest.y) lowest = { x, y };
    });
    expect(lowest.y).toBeGreaterThan(view.height * 0.5);
    expect(Math.abs(lowest.x - 900)).toBeLessThan(40);
  });

  it("keeps its own motion out of the wave energy", () => {
    const engine = new InkPondEngine(null, { scene: "jieqi", term: "dahan" });
    engine.resize(1200, 800, 1, 16);
    let frame = engine.advance(0);
    for (let t = 0; t < 4; t += STEP_S) frame = engine.advance(STEP_S);
    expect(frame).toMatchObject({ calm: true, moving: true, settled: true });
  });
});
