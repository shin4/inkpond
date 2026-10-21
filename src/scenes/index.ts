import type { InkPondScene } from "../scene.js";
import { createLotus } from "./lotus.js";
import { createQingming } from "./qingming.js";
import { createShanshui } from "./shanshui.js";

/** 山水 (default), 荷塘 with koi, and the 清明上河 scroll. */
export const SCENES = ["shanshui", "lotus", "qingming"] as const;
export type SceneName = (typeof SCENES)[number];

/** A fresh scene; `levels` replaces its main ground ramp. */
export const createScene = (
  name: SceneName = "shanshui",
  levels?: readonly string[],
): InkPondScene => {
  switch (name) {
    case "lotus":
      return createLotus(levels);
    case "qingming":
      return createQingming(levels);
    default:
      return createShanshui(levels);
  }
};
