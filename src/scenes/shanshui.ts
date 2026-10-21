/**
 * 山水, the default scene: two ridgelines of distant hills washing down into
 * drifting mist, with cloud above. Nothing moves by itself.
 */
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_URL,
  DEFAULT_LEVELS,
} from "../glyphs.js";
import { fbm, smoothstep } from "../noise.js";
import {
  COARSE,
  type CoarseField,
  coarseField,
  glyphTable,
  INK,
  type InkPondScene,
} from "../scene.js";

export const createShanshui = (
  levels: readonly string[] = DEFAULT_LEVELS,
): InkPondScene => {
  const table = glyphTable([levels]);
  let cols = 0;
  let rows = 0;
  let hills = new Float32Array(0);
  let mist: CoarseField = coarseField(0, 0);
  let cloud: CoarseField = coarseField(0, 0);

  /** Two ridgelines and their brush texture (皴) never move: once per size. */
  const precomputeHills = () => {
    hills = new Float32Array(cols * rows * 2);
    const edge = (ry: number, ridge: number, w: number) =>
      smoothstep(ridge - 0.012, ridge + 0.03, ry) * Math.exp(-(ry - ridge) / w);
    for (let x = 0; x < cols; x++) {
      const far = 0.6 + 0.1 * (fbm(x * 0.045, 3.1) - 0.5) * 2;
      const near = 0.76 + 0.12 * (fbm(x * 0.07 + 40, 7.7) - 0.5) * 2;
      for (let y = 0; y < rows; y++) {
        const ry = y / rows;
        if (ry < far - 0.012) continue;
        const i = y * cols + x;
        const cun =
          0.25 + 0.75 * smoothstep(0.28, 0.58, fbm(x * 0.22, y * 0.38));
        hills[i * 2] = edge(ry, far, 0.06) * 0.5 * cun;
        if (ry >= near - 0.012) {
          hills[i * 2 + 1] = edge(ry, near, 0.08) * 0.75 * cun;
        }
      }
    }
  };

  /** 云雾 drift slowly over the hills. */
  const updateMist = (time: number) => {
    const drift = time * 0.012;
    for (let cy = 0; cy < mist.h; cy++) {
      const y = cy * COARSE;
      for (let cx = 0; cx < mist.w; cx++) {
        const x = cx * COARSE;
        const j = cy * mist.w + cx;
        mist.data[j] = smoothstep(
          0.42,
          0.72,
          fbm(x * 0.05 - drift, y * 0.14 + drift * 0.3),
        );
        cloud.data[j] =
          smoothstep(0.64, 0.86, fbm(x * 0.04 - drift * 0.8, y * 0.09)) *
          0.22 *
          (1 - Math.min(1, y / Math.max(1, rows)));
      }
    }
  };

  return {
    fontFamily: DEFAULT_FONT_FAMILY,
    fontUrl: DEFAULT_FONT_URL,
    glyphs: table.glyphs,
    moving: false,
    panSpeed: 0,
    ramps: table.ramps,
    compose(grid, _offset, time) {
      updateMist(time);
      grid.kind.fill(0);
      grid.pigment.fill(INK);
      grid.wet.fill(1);
      for (let y = 0; y < rows; y++) {
        for (let x = 0, i = y * cols; x < cols; x++, i++) {
          // 远山 wash down into the drifting mist; cloud drifts above.
          let base = cloud.at(x, y);
          const far = hills[i * 2] ?? 0;
          const near = hills[i * 2 + 1] ?? 0;
          if (far > 0 || near > 0) {
            const m = mist.at(x, y);
            base += Math.max(far * (1 - m * 0.85), near * (1 - m * 0.65));
          }
          grid.ground[i] = base;
        }
      }
    },
    layout(view) {
      cols = view.cols;
      rows = view.rows;
      mist = coarseField(cols, rows);
      cloud = coarseField(cols, rows);
      precomputeHills();
    },
    stamps() {},
    step() {},
  };
};
