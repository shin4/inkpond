/**
 * Performance tiers. A device starts at "standard", at
 * "lite" when it reports little CPU or memory, and on the still frame when
 * the browser paints without a GPU (VDI, remote desktop, a blocklisted
 * driver), where every glyph is rasterised on the CPU. It then steps down
 * whenever the slowest 5% of a window of painted frames run past the
 * budget, and goes straight to the still frame as soon as its last few
 * frames run far past it. A step down is remembered per
 * device for a while, so the next visit does not have to stutter its way
 * there again.
 */
export interface Tier {
  /** Smallest cell, in CSS px. */
  cell: number;
  dprCap: number;
  /** Paint rate while the water moves; 0 paints a single still frame. */
  fps: number;
}

export const TIERS: readonly Tier[] = [
  { cell: 16, dprCap: 1.5, fps: 60 },
  { cell: 22, dprCap: 1.25, fps: 30 },
  { cell: 22, dprCap: 1.25, fps: 0 },
];

export const STILL_TIER = TIERS.length - 1;

/** The cell sizes a page may ask for (cellSize), in CSS px. */
export const MIN_CELL = 12;
export const MAX_CELL = 48;

/**
 * The cell to lay out at. Without a request, the tier's own. A request is
 * kept within MIN_CELL–MAX_CELL and, once a device has stepped down, never
 * finer than that tier's cell: cost grows with the square of 1 / cell, and
 * the larger cells are what the lower tiers save by.
 */
export const cellFor = (tier: number, requested?: number) => {
  const own = TIERS[tier]?.cell ?? TIERS[0]?.cell ?? 16;
  if (requested === undefined || !Number.isFinite(requested)) return own;
  const asked = Math.min(MAX_CELL, Math.max(MIN_CELL, requested));
  return tier === 0 ? asked : Math.max(asked, own);
};
/** p95 work per painted frame before stepping down. */
export const BUDGET_MS = 8;
const WINDOW = 60;
/**
 * Frames to the fast verdict. The cost climbs as ripples and ink spread, so
 * a fixed window that opens on the cheap first frames would answer late.
 */
const RECENT = 10;
const REMEMBER_MS = 30 * 24 * 60 * 60 * 1000;
export const DEFAULT_TIER_KEY = "inkpond.tier";

export type TierVerdict = "stay" | "down" | "still";

/**
 * The frame cadence while the water moves. Without a GPU the canvas is
 * rasterised after the frame's script has run, so the work measured in
 * script misses most of the cost; a stretched frame interval still shows it.
 */
const DOWN_INTERVAL_MS = 40;
const STILL_INTERVAL_MS = 60;
/**
 * Past this the browser is throttling the page (a covered or minimised
 * window keeps document.hidden false but runs about one frame a second),
 * which says nothing about the device: such a frame is not counted, and the
 * run it interrupted starts over.
 */
const THROTTLED_INTERVAL_MS = 200;

const quantile = (values: number[], q: number) =>
  values.slice().sort((a, b) => a - b)[Math.floor(values.length * q)] ?? 0;

/**
 * Collects each painted frame's script work and the interval since the frame
 * before. "still" as soon as the median of the last RECENT frames exceeds
 * twice the budget or STILL_INTERVAL_MS; at the end of each window, "down"
 * when a p95 exceeds the budget or DOWN_INTERVAL_MS.
 */
export const createTierJudge = (budgetMs = BUDGET_MS) => {
  const work: number[] = [];
  const intervals: number[] = [];
  const reset = () => {
    work.length = 0;
    intervals.length = 0;
  };
  return {
    push(ms: number, intervalMs = 0): TierVerdict {
      if (intervalMs > THROTTLED_INTERVAL_MS) {
        reset();
        return "stay";
      }
      work.push(ms);
      intervals.push(intervalMs);
      if (work.length >= RECENT) {
        const recentWork = quantile(work.slice(-RECENT), 0.5);
        const recentInterval = quantile(intervals.slice(-RECENT), 0.5);
        if (recentWork > budgetMs * 2 || recentInterval > STILL_INTERVAL_MS) {
          reset();
          return "still";
        }
      }
      if (work.length < WINDOW) return "stay";
      const slow =
        quantile(work, 0.95) > budgetMs ||
        quantile(intervals, 0.95) > DOWN_INTERVAL_MS;
      reset();
      return slow ? "down" : "stay";
    },
    reset,
  };
};

/** Renderer names of the software rasterisers browsers fall back to. */
const SOFTWARE_RENDERER =
  /swiftshader|llvmpipe|softpipe|basic render|software rasterizer|software adapter/i;

export const isSoftwareRenderer = (renderer: string) =>
  SOFTWARE_RENDERER.test(renderer);

export const isWeakDevice = (nav: {
  hardwareConcurrency?: number;
  deviceMemory?: number;
}) => (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;

/** The tier to start at: a remembered step down, else the device's default. */
export const initialTier = (
  storage: Pick<Storage, "getItem"> | null,
  key: string,
  device: { weak: boolean; software: boolean },
  now: number,
) => {
  const base = device.software ? STILL_TIER : device.weak ? 1 : 0;
  try {
    const raw = storage?.getItem(key);
    if (!raw) return base;
    const saved = JSON.parse(raw) as { tier?: unknown; at?: unknown };
    if (
      typeof saved.tier !== "number" ||
      typeof saved.at !== "number" ||
      now - saved.at > REMEMBER_MS
    ) {
      return base;
    }
    return Math.max(base, Math.min(STILL_TIER, Math.floor(saved.tier)));
  } catch {
    return base;
  }
};

export const rememberTier = (
  storage: Pick<Storage, "setItem"> | null,
  key: string,
  tier: number,
  now: number,
) => {
  try {
    storage?.setItem(key, JSON.stringify({ at: now, tier }));
  } catch {
    // Storage may be full or blocked; the tier just is not remembered.
  }
};
