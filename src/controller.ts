/**
 * Drives an InkPondEngine on a canvas that fills its parent (the host): the
 * frame loop, pointer input, the clear zones around the host's
 * `[data-inkpond-avoid]` elements, the glyph font, the theme, the cell size
 * and the performance tiers.
 *
 * Painting follows what is on screen: every frame at the tier's rate while
 * the water moves, 24 fps while only the scene's own koi, boats or scroll
 * move, 10 fps while only the mist drifts, and nothing at all once the
 * water has settled and no one has touched it for SLEEP_AFTER_MS; the
 * next pointer event, ripple() or drop() wakes it. Reduced motion and the
 * still tier paint one settled frame and take no input. A hidden tab pauses;
 * prefers-reduced-motion, the colour scheme and a `class`/`data-theme` change
 * on <html> are followed live unless the caller pins them.
 */
import {
  DEFAULT_PIGMENT_COLORS,
  InkPondEngine,
  type InkPondEngineOptions,
  type InkPondRect,
  PIGMENT_PROPERTIES,
} from "./engine.js";
import { DEFAULT_FALLBACK_FONTS } from "./glyphs.js";
import {
  cellFor,
  createTierJudge,
  DEFAULT_TIER_KEY,
  initialTier,
  isSoftwareRenderer,
  isWeakDevice,
  rememberTier,
  STILL_TIER,
  TIERS,
} from "./tiers.js";

const CALM_INTERVAL_MS = 100;
/** Koi, boats and the scroll move smoothly enough at 24 fps. */
const MOVING_INTERVAL_MS = 1000 / 24;
const SLEEP_AFTER_MS = 30_000;
/** Clicks on these never drop ink: they belong to the control. */
const INTERACTIVE =
  'a, button, input, textarea, select, label, summary, [role="button"], [role="menuitem"], [role="option"], [contenteditable="true"]';

export const DEFAULT_AVOID_ATTRIBUTE = "data-inkpond-avoid";

export interface InkPondOptions extends InkPondEngineOptions {
  /** Start animating at once (default true). See InkPond.setActive. */
  active?: boolean;
  /** Pin reduced motion on or off; by default it follows the media query. */
  reducedMotion?: boolean;
  /** Elements with this attribute inside the host keep a clear zone. */
  avoidAttribute?: string;
  /**
   * Glyph font to load (default: the scene's own subset), or null to draw
   * with the fallback fonts only.
   */
  fontUrl?: string | null;
  fontFamily?: string;
  fallbackFonts?: string;
  /** localStorage key that remembers a step down, or null to forget it. */
  tierStorageKey?: string | null;
  /**
   * Glyph cell in CSS px, 12–48 (default: the tier's, 16). Smaller cells
   * draw more glyphs; a device that steps down never goes below its tier's
   * cell (22 on lite).
   */
  cellSize?: number;
}

export interface InkPond {
  /** Whether the host view is on screen; a hidden tab pauses by itself. */
  setActive(active: boolean): void;
  /**
   * Re-read the ink colour (`color` and `--inkpond-alpha` of the canvas) and
   * the 淡彩 (`--inkpond-zhu`, `-yanzhi`, `-zhe`, `-huaqing`).
   */
  refreshInk(): void;
  /**
   * Stir the water at a viewport point (clientX/clientY), strength 0–1.
   * Ignored while paused, in reduced motion and on the still tier.
   */
  ripple(clientX: number, clientY: number, strength?: number): void;
  /**
   * 落墨 at a viewport point. Like a click, it is refused on the host's
   * avoided elements; false when nothing was dropped.
   */
  drop(clientX: number, clientY: number): boolean;
  destroy(): void;
}

const fontLoads = new Map<string, Promise<boolean>>();
const loadGlyphFont = (family: string, url: string) => {
  const key = `${family}\n${url}`;
  const cached = fontLoads.get(key);
  if (cached) return cached;
  let load: Promise<boolean>;
  if (typeof FontFace === "undefined" || !document.fonts) {
    load = Promise.resolve(false);
  } else {
    const face = new FontFace(family, `url(${url}) format("woff2")`, {
      display: "swap",
      weight: "500",
    });
    load = face.load().then(
      (loaded) => {
        document.fonts.add(loaded);
        return true;
      },
      () => false,
    );
  }
  fontLoads.set(key, load);
  return load;
};

let softwareRendering: boolean | null = null;
/**
 * Whether the browser rasterises without a GPU. A context refused only under
 * failIfMajorPerformanceCaveat is a software fallback; otherwise the unmasked
 * renderer name tells. With no WebGL at all it is unknown, and the frame
 * judge decides.
 */
const detectSoftwareRendering = () => {
  if (softwareRendering !== null) return softwareRendering;
  softwareRendering = false;
  try {
    const probe = () => document.createElement("canvas");
    const fast = probe().getContext("webgl", {
      failIfMajorPerformanceCaveat: true,
    });
    if (!fast) {
      softwareRendering = probe().getContext("webgl") !== null;
    } else {
      const info = fast.getExtension("WEBGL_debug_renderer_info");
      const name = info
        ? fast.getParameter(info.UNMASKED_RENDERER_WEBGL)
        : fast.getParameter(fast.RENDERER);
      softwareRendering = typeof name === "string" && isSoftwareRenderer(name);
      fast.getExtension("WEBGL_lose_context")?.loseContext();
    }
  } catch {
    softwareRendering = false;
  }
  return softwareRendering;
};

const safeStorage = () => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const createInkPond = (
  canvas: HTMLCanvasElement,
  options: InkPondOptions = {},
): InkPond => {
  const {
    avoidAttribute = DEFAULT_AVOID_ATTRIBUTE,
    fallbackFonts = DEFAULT_FALLBACK_FONTS,
    tierStorageKey = DEFAULT_TIER_KEY,
  } = options;
  const avoidSelector = `[${avoidAttribute}]`;
  const host = canvas.parentElement ?? canvas;
  const engine = new InkPondEngine(canvas, options);
  const fontFamily = options.fontFamily ?? engine.scene.fontFamily;
  const fontUrl =
    options.fontUrl === undefined ? engine.scene.fontUrl : options.fontUrl;
  const judge = createTierJudge();
  const storage = tierStorageKey ? safeStorage() : null;
  const tierKey = tierStorageKey ?? "";
  let tier = initialTier(
    storage,
    tierKey,
    { software: detectSoftwareRendering(), weak: isWeakDevice(navigator) },
    Date.now(),
  );
  const motionQuery =
    options.reducedMotion === undefined && typeof matchMedia === "function"
      ? matchMedia("(prefers-reduced-motion: reduce)")
      : null;
  const reduced = () => options.reducedMotion ?? motionQuery?.matches ?? false;
  let active = options.active ?? true;
  let running = false;
  let disposed = false;
  let raf = 0;
  let last = 0;
  let lastPaint = 0;
  let lastInput = performance.now();
  let syncQueued = 0;
  let avoidKey = "";
  const observed = new Set<Element>();

  const still = () => reduced() || (TIERS[tier]?.fps ?? 0) === 0;

  const readInk = () => {
    const style = getComputedStyle(canvas);
    const alpha = Number.parseFloat(style.getPropertyValue("--inkpond-alpha"));
    const pigments = PIGMENT_PROPERTIES.map(
      (name, k) =>
        style.getPropertyValue(name).trim() || DEFAULT_PIGMENT_COLORS[k] || "",
    );
    engine.setInk(style.color, Number.isFinite(alpha) ? alpha : 0.5, pigments);
  };

  // Markers can arrive after first paint (the capability pills) or leave;
  // observe exactly the current set, and redo the mask only when a rect moved.
  const syncAvoid = (force = false) => {
    syncQueued = 0;
    const origin = canvas.getBoundingClientRect();
    const rects: InkPondRect[] = [];
    const current = new Set(host.querySelectorAll(avoidSelector));
    for (const element of observed) {
      if (current.has(element)) continue;
      observed.delete(element);
      resizeObserver?.unobserve(element);
    }
    for (const element of current) {
      if (!observed.has(element)) {
        observed.add(element);
        resizeObserver?.observe(element);
      }
      const r = element.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) continue;
      rects.push({
        bottom: r.bottom - origin.top,
        left: r.left - origin.left,
        right: r.right - origin.left,
        top: r.top - origin.top,
      });
    }
    const key = rects
      .map((r) => `${r.left},${r.top},${r.right},${r.bottom}`)
      .join(";");
    if (!force && key === avoidKey) return;
    avoidKey = key;
    engine.setAvoid(rects);
    if (running && !raf) paintOnce();
  };
  const queueSync = () => {
    if (!syncQueued) syncQueued = requestAnimationFrame(() => syncAvoid());
  };

  const layout = () => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;
    const t = TIERS[tier] ?? TIERS[0];
    if (!t) return;
    const dpr = Math.min(window.devicePixelRatio || 1, t.dprCap);
    engine.resize(
      rect.width,
      rect.height,
      dpr,
      cellFor(tier, options.cellSize),
    );
    syncAvoid(true);
  };

  const paintOnce = () => {
    if (still()) engine.renderStill();
    else engine.render();
  };

  const stepDown = (toStill: boolean) => {
    tier = toStill ? STILL_TIER : Math.min(STILL_TIER, tier + 1);
    rememberTier(storage, tierKey, tier, Date.now());
    judge.reset();
    layout();
    start();
  };

  const frame = (now: number) => {
    raf = 0;
    if (disposed || !running) return;
    const t0 = performance.now();
    const sinceLast = now - last;
    const state = engine.advance(Math.min(0.1, sinceLast / 1000));
    last = now;
    const fps = TIERS[tier]?.fps ?? 60;
    const interval = !state.calm
      ? 1000 / fps - 2
      : state.moving
        ? Math.max(MOVING_INTERVAL_MS, 1000 / fps) - 2
        : CALM_INTERVAL_MS;
    if (now - lastPaint >= interval) {
      engine.render();
      lastPaint = now;
      const verdict = state.calm
        ? "stay"
        : judge.push(performance.now() - t0, sinceLast);
      if (verdict !== "stay") {
        stepDown(verdict === "still");
        return;
      }
    }
    // Settled and untouched: stop on this frame until the next input.
    if (state.settled && now - lastInput > SLEEP_AFTER_MS) return;
    raf = requestAnimationFrame(frame);
  };

  function start() {
    cancelAnimationFrame(raf);
    raf = 0;
    if (disposed || !running) return;
    if (still()) {
      engine.renderStill();
      return;
    }
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  const wake = () => {
    lastInput = performance.now();
    if (running && !raf && !still()) start();
  };

  const local = (event: { clientX: number; clientY: number }) => {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };
  /** Programmatic input lands only where the water is live. */
  const live = () => running && !still();
  const onPointerMove = (event: PointerEvent) => {
    if (still() || event.pointerType === "touch") return;
    const { x, y } = local(event);
    engine.pointer(x, y, event.timeStamp);
    wake();
  };
  const onPointerLeave = () => engine.pointerLeave();
  const onPointerDown = (event: PointerEvent) => {
    if (still() || event.button !== 0) return;
    if (
      event.target instanceof Element &&
      event.target.closest(`${INTERACTIVE}, ${avoidSelector}`)
    ) {
      return;
    }
    const { x, y } = local(event);
    if (engine.drop(x, y)) wake();
  };

  const resizeObserver =
    typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver((entries) => {
          // The canvas itself resizes when it leaves display:none (forced
          // colors turned off) without the host changing size.
          if (
            entries.some(
              (entry) => entry.target === host || entry.target === canvas,
            )
          ) {
            layout();
          } else queueSync();
        });
  resizeObserver?.observe(host);
  resizeObserver?.observe(canvas);
  const mutationObserver =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(queueSync);
  mutationObserver?.observe(host, {
    attributeFilter: [avoidAttribute],
    childList: true,
    subtree: true,
  });
  host.addEventListener("pointermove", onPointerMove, { passive: true });
  host.addEventListener("pointerleave", onPointerLeave);
  host.addEventListener("pointerdown", onPointerDown, { passive: true });
  // Content scrolling inside the host moves under the canvas.
  host.addEventListener("scroll", queueSync, { capture: true, passive: true });

  const setRunning = (next: boolean) => {
    if (running === next) return;
    running = next;
    if (running) {
      lastInput = performance.now();
      layout();
      start();
    } else {
      cancelAnimationFrame(raf);
      raf = 0;
      engine.pointerLeave();
    }
  };
  const syncRunning = () => setRunning(active && !document.hidden);
  const refreshInk = () => {
    readInk();
    if (running) paintOnce();
  };
  const onMotionChange = () => {
    if (running) start();
  };
  const schemeQuery =
    typeof matchMedia === "function"
      ? matchMedia("(prefers-color-scheme: dark)")
      : null;
  // A theme switch usually lands as a class or data-theme on <html>.
  const themeObserver =
    typeof MutationObserver === "undefined"
      ? null
      : new MutationObserver(refreshInk);
  themeObserver?.observe(document.documentElement, {
    attributeFilter: ["class", "data-theme", "style"],
    attributes: true,
  });
  document.addEventListener("visibilitychange", syncRunning);
  motionQuery?.addEventListener("change", onMotionChange);
  schemeQuery?.addEventListener("change", refreshInk);

  engine.setFontFamily(fallbackFonts);
  readInk();
  layout();
  syncRunning();
  if (fontUrl) {
    void loadGlyphFont(fontFamily, fontUrl).then((ok) => {
      if (!ok || disposed) return;
      engine.setFontFamily(`"${fontFamily}", ${fallbackFonts}`);
      if (running) paintOnce();
    });
  }

  return {
    destroy() {
      disposed = true;
      cancelAnimationFrame(raf);
      cancelAnimationFrame(syncQueued);
      resizeObserver?.disconnect();
      mutationObserver?.disconnect();
      themeObserver?.disconnect();
      document.removeEventListener("visibilitychange", syncRunning);
      motionQuery?.removeEventListener("change", onMotionChange);
      schemeQuery?.removeEventListener("change", refreshInk);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerleave", onPointerLeave);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("scroll", queueSync, { capture: true });
    },
    drop(clientX, clientY) {
      if (!live()) return false;
      const { x, y } = local({ clientX, clientY });
      if (!engine.drop(x, y)) return false;
      wake();
      return true;
    },
    refreshInk,
    ripple(clientX, clientY, strength = 1) {
      if (!live()) return;
      const { x, y } = local({ clientX, clientY });
      engine.ripple(x, y, strength);
      wake();
    },
    setActive(next) {
      active = next;
      syncRunning();
    },
  };
};
