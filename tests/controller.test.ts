// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createInkPond } from "../src/controller";
import { InkPondEngine } from "../src/engine";

type Box = { left: number; top: number; width: number; height: number };

const boxes = new Map<Element, Box>();
const rectOf = (element: Element) => {
  const b = boxes.get(element) ?? { height: 0, left: 0, top: 0, width: 0 };
  return {
    bottom: b.top + b.height,
    height: b.height,
    left: b.left,
    right: b.left + b.width,
    toJSON: () => b,
    top: b.top,
    width: b.width,
    x: b.left,
    y: b.top,
  } as DOMRect;
};

let resizeCallbacks: ResizeObserverCallback[] = [];
class RecordingResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    resizeCallbacks.push(callback);
  }
  observe() {}
  unobserve() {}
  disconnect() {}
}
const fireResize = (target: Element) => {
  for (const callback of resizeCallbacks) {
    callback([{ target } as ResizeObserverEntry], {} as ResizeObserver);
  }
};
const nextFrame = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const mountHost = () => {
  const host = document.createElement("div");
  const canvas = document.createElement("canvas");
  host.append(canvas);
  document.body.append(host);
  boxes.set(host, { height: 600, left: 0, top: 0, width: 800 });
  boxes.set(canvas, { height: 600, left: 0, top: 0, width: 800 });
  return { canvas, host };
};

describe("createInkPondController", () => {
  const SetupResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    resizeCallbacks = [];
    globalThis.ResizeObserver =
      RecordingResizeObserver as unknown as typeof ResizeObserver;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
      function (this: Element) {
        return rectOf(this);
      },
    );
  });

  afterEach(() => {
    globalThis.ResizeObserver = SetupResizeObserver;
    vi.restoreAllMocks();
    boxes.clear();
    document.body.innerHTML = "";
  });

  it("clears ground around a marker that arrives after mount", async () => {
    const setAvoid = vi.spyOn(InkPondEngine.prototype, "setAvoid");
    const { canvas, host } = mountHost();
    const controller = createInkPond(canvas, {
      fontUrl: null,
      reducedMotion: true,
      tierStorageKey: null,
    });
    expect(setAvoid).toHaveBeenLastCalledWith([]);

    // A row of suggestions renders a moment after the page.
    const pills = document.createElement("div");
    pills.setAttribute("data-inkpond-avoid", "");
    boxes.set(pills, { height: 36, left: 40, top: 400, width: 720 });
    host.append(pills);
    await Promise.resolve();
    await nextFrame();

    expect(setAvoid).toHaveBeenLastCalledWith([
      { bottom: 436, left: 40, right: 760, top: 400 },
    ]);
    controller.destroy();
  });

  it("takes ripples and drops at viewport points while the water is live", () => {
    const ripple = vi.spyOn(InkPondEngine.prototype, "ripple");
    const drop = vi.spyOn(InkPondEngine.prototype, "drop");
    const { canvas, host } = mountHost();
    boxes.set(host, { height: 600, left: 20, top: 50, width: 800 });
    boxes.set(canvas, { height: 600, left: 20, top: 50, width: 800 });
    const composer = document.createElement("form");
    composer.setAttribute("data-inkpond-avoid", "");
    boxes.set(composer, { height: 100, left: 220, top: 300, width: 400 });
    host.append(composer);
    const controller = createInkPond(canvas, {
      fontUrl: null,
      reducedMotion: false,
      tierStorageKey: null,
    });

    controller.ripple(120, 150, 0.5);
    expect(ripple).toHaveBeenLastCalledWith(100, 100, 0.5);
    expect(controller.drop(120, 150)).toBe(true);
    // Like a click, programmatic ink never lands on the page's content.
    expect(controller.drop(400, 350)).toBe(false);
    expect(drop).toHaveBeenCalledTimes(2);

    controller.setActive(false);
    controller.ripple(120, 150);
    expect(controller.drop(120, 150)).toBe(false);
    expect(ripple).toHaveBeenCalledTimes(1);
    expect(drop).toHaveBeenCalledTimes(2);
    controller.destroy();
  });

  it("ignores ripples and drops in reduced motion", () => {
    const ripple = vi.spyOn(InkPondEngine.prototype, "ripple");
    const { canvas } = mountHost();
    const controller = createInkPond(canvas, {
      fontUrl: null,
      reducedMotion: true,
      tierStorageKey: null,
    });
    controller.ripple(100, 100);
    expect(controller.drop(100, 100)).toBe(false);
    expect(ripple).not.toHaveBeenCalled();
    controller.destroy();
  });

  it("lays the grid out once the canvas leaves display:none", () => {
    const resize = vi.spyOn(InkPondEngine.prototype, "resize");
    const { canvas } = mountHost();
    // Forced colors hide the canvas: nothing to lay out yet.
    boxes.set(canvas, { height: 0, left: 0, top: 0, width: 0 });
    const controller = createInkPond(canvas, {
      fontUrl: null,
      reducedMotion: true,
      tierStorageKey: null,
    });
    expect(resize).not.toHaveBeenCalled();

    // High contrast is turned off; only the canvas changes size.
    boxes.set(canvas, { height: 600, left: 0, top: 0, width: 800 });
    fireResize(canvas);

    // The cell size depends on the tier this machine starts on.
    expect(resize).toHaveBeenCalledWith(
      800,
      600,
      expect.any(Number),
      expect.any(Number),
    );
    controller.destroy();
  });

  it("lays the grid out at the page's cellSize", () => {
    const resize = vi.spyOn(InkPondEngine.prototype, "resize");
    const { canvas } = mountHost();
    boxes.set(canvas, { height: 600, left: 0, top: 0, width: 800 });
    // 30 px is coarser than every tier's cell, so it holds on any machine.
    const controller = createInkPond(canvas, {
      cellSize: 30,
      fontUrl: null,
      reducedMotion: true,
      tierStorageKey: null,
    });
    expect(resize).toHaveBeenLastCalledWith(800, 600, expect.any(Number), 30);
    controller.destroy();
  });
});
