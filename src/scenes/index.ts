import type { InkPondScene } from "../scene.js";
import { createBeiming } from "./beiming.js";
import { createDafeijing } from "./dafeijing.js";
import { createJieqi, type JieqiOptions } from "./jieqi/index.js";
import { createLotus } from "./lotus.js";
import { createQingming } from "./qingming.js";
import { createShanshui } from "./shanshui.js";

/**
 * 山水 (default), 荷塘 with koi, the 清明上河 scroll, the 二十四节气,
 * 北冥 with a whale under the sea, and 大肥鲸 with its bowl of rice.
 */
export const SCENES = [
  "shanshui",
  "lotus",
  "qingming",
  "jieqi",
  "beiming",
  "dafeijing",
] as const;
export type SceneName = (typeof SCENES)[number];

/**
 * A fresh scene; `levels` replaces its main ground ramp (节气 has a ramp
 * per term and ignores it), `jieqi` picks the 节气 scene's term or date.
 */
export const createScene = (
  name: SceneName = "shanshui",
  levels?: readonly string[],
  jieqi?: JieqiOptions,
): InkPondScene => {
  switch (name) {
    case "beiming":
      return createBeiming(levels);
    case "dafeijing":
      return createDafeijing(levels);
    case "jieqi":
      return createJieqi(jieqi);
    case "lotus":
      return createLotus(levels);
    case "qingming":
      return createQingming(levels);
    default:
      return createShanshui(levels);
  }
};
