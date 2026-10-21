import { describe, expect, it } from "vitest";
import { InkPondEngine, STEP_S } from "../src/engine";
import {
  createTierJudge,
  DEFAULT_TIER_KEY,
  initialTier,
  isSoftwareRenderer,
  isWeakDevice,
  rememberTier,
  STILL_TIER,
} from "../src/tiers";

const settle = (engine: InkPondEngine, seconds: number) => {
  let state = engine.advance(0);
  for (let t = 0; t < seconds; t += STEP_S) {
    state = engine.advance(STEP_S);
    engine.render();
  }
  return state;
};

const pond = () => {
  const engine = new InkPondEngine(null);
  engine.resize(800, 600, 1, 16);
  return engine;
};

describe("InkPondEngine", () => {
  it("keeps its state without a canvas and never paints", () => {
    const engine = pond();
    expect(engine.cellCount).toBe(52 * 40);
    expect(engine.render()).toBe(0);
    expect(engine.renderStill()).toBe(0);
  });

  it("stirs on a pointer stroke and settles back to calm", () => {
    const engine = pond();
    expect(engine.advance(STEP_S).calm).toBe(true);

    for (let k = 0; k < 20; k++) engine.pointer(100 + k * 20, 300, k * 16);
    expect(engine.advance(STEP_S).calm).toBe(false);

    expect(settle(engine, 20)).toEqual({
      calm: true,
      moving: false,
      settled: true,
    });
  });

  it("refuses ink on the page's content and blooms elsewhere", () => {
    const engine = pond();
    engine.setAvoid([{ bottom: 400, left: 200, right: 600, top: 200 }]);

    expect(engine.drop(400, 300)).toBe(false);
    expect(engine.advance(STEP_S).calm).toBe(true);

    expect(engine.drop(80, 520)).toBe(true);
    // The blot keeps the pond awake while it blooms, then fades away.
    expect(settle(engine, 1).calm).toBe(false);
    expect(settle(engine, 20)).toEqual({
      calm: true,
      moving: false,
      settled: true,
    });
  });

  it("rings the water from a point, scaled by strength", () => {
    const engine = pond();
    engine.ripple(400, 300, 0);
    expect(engine.advance(STEP_S).calm).toBe(true);

    engine.ripple(400, 300, 0.35);
    expect(engine.advance(STEP_S).calm).toBe(false);
    expect(settle(engine, 20)).toEqual({
      calm: true,
      moving: false,
      settled: true,
    });
  });

  it("forgets the stroke origin on leave, so re-entry does not splash", () => {
    const engine = pond();
    engine.pointer(100, 100, 0);
    engine.pointerLeave();
    engine.pointer(700, 500, 16);
    expect(engine.advance(STEP_S).calm).toBe(true);
  });
});

describe("ink pond tiers", () => {
  const device = { software: false, weak: false };

  it("steps down when the slowest 5% of a 60-frame window run long", () => {
    const judge = createTierJudge(8);
    for (let k = 0; k < 59; k++) expect(judge.push(2, 16.7)).toBe("stay");
    expect(judge.push(2, 16.7)).toBe("stay");

    for (let k = 0; k < 56; k++) judge.push(2, 16.7);
    for (let k = 0; k < 3; k++) judge.push(12, 16.7);
    expect(judge.push(12, 16.7)).toBe("down");
  });

  it("goes straight to the still frame once recent frames run far past the budget", () => {
    const judge = createTierJudge(8);
    // Cheap opening frames, then the cost climbs as ripples and ink spread.
    for (let k = 0; k < 40; k++) expect(judge.push(2, 16.7)).toBe("stay");
    // Half of the last ten frames is enough.
    for (let k = 0; k < 4; k++) expect(judge.push(38, 33)).toBe("stay");
    expect(judge.push(38, 33)).toBe("still");
  });

  it("reads a stretched frame cadence as a slow device even when script is cheap", () => {
    const judge = createTierJudge(8);
    for (let k = 0; k < 59; k++) judge.push(2, 45);
    expect(judge.push(2, 45)).toBe("down");
    for (let k = 0; k < 9; k++) judge.push(2, 70);
    expect(judge.push(2, 70)).toBe("still");
  });

  it("ignores frames a throttled (covered or minimised) window delivers", () => {
    const judge = createTierJudge(8);
    // About one frame a second while covered: never a verdict.
    for (let k = 0; k < 200; k++) expect(judge.push(2, 1000)).toBe("stay");
    // A throttled frame also restarts the run it interrupts.
    for (let k = 0; k < 9; k++) judge.push(30, 70);
    judge.push(2, 1000);
    for (let k = 0; k < 9; k++) expect(judge.push(30, 70)).toBe("stay");
    expect(judge.push(30, 70)).toBe("still");
  });

  it("starts weak devices on lite and software rendering on the still frame", () => {
    expect(isWeakDevice({ hardwareConcurrency: 4 })).toBe(true);
    expect(isWeakDevice({ deviceMemory: 2, hardwareConcurrency: 16 })).toBe(
      true,
    );
    expect(isWeakDevice({ hardwareConcurrency: 12 })).toBe(false);
    expect(
      initialTier(null, DEFAULT_TIER_KEY, { ...device, weak: true }, 0),
    ).toBe(1);
    expect(initialTier(null, DEFAULT_TIER_KEY, device, 0)).toBe(0);
    expect(
      initialTier(null, DEFAULT_TIER_KEY, { software: true, weak: false }, 0),
    ).toBe(STILL_TIER);
  });

  it("recognises the software rasterisers browsers fall back to", () => {
    for (const name of [
      "ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)",
      "llvmpipe (LLVM 15.0.7, 256 bits)",
      "ANGLE (Microsoft, Microsoft Basic Render Driver Direct3D11)",
    ])
      expect(isSoftwareRenderer(name)).toBe(true);
    for (const name of [
      "ANGLE (Intel, Intel(R) UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0)",
      "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)",
    ])
      expect(isSoftwareRenderer(name)).toBe(false);
  });

  it("remembers a step down for 30 days and ignores bad entries", () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    };
    rememberTier(storage, DEFAULT_TIER_KEY, 2, 1000);
    expect(initialTier(storage, DEFAULT_TIER_KEY, device, 2000)).toBe(2);
    expect(
      initialTier(
        storage,
        DEFAULT_TIER_KEY,
        device,
        1000 + 31 * 24 * 3600 * 1000,
      ),
    ).toBe(0);

    store.set(DEFAULT_TIER_KEY, "{not json");
    expect(initialTier(storage, DEFAULT_TIER_KEY, device, 0)).toBe(0);
    store.set(DEFAULT_TIER_KEY, JSON.stringify({ at: 0, tier: 9 }));
    expect(initialTier(storage, DEFAULT_TIER_KEY, device, 0)).toBe(2);
  });
});
