import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_LEVELS, glyphsOf } from "../src/glyphs";
import { SCENES } from "../src/scenes";

const root = path.resolve(__dirname, "..");

describe("default glyphs", () => {
  it("never repeat across levels", () => {
    expect(glyphsOf(DEFAULT_LEVELS)).toHaveLength(
      DEFAULT_LEVELS.join("").length,
    );
  });

  it("ship with every scene's font subset and its licence", () => {
    for (const scene of SCENES) {
      expect(
        existsSync(path.join(root, `src/assets/inkpond-${scene}.woff2`)),
      ).toBe(true);
    }
    const licence = readFileSync(path.join(root, "src/assets/OFL.txt"), "utf8");
    expect(licence).toContain("SIL Open Font License");
    // The subset is renamed: a modified version may not keep "Source".
    expect(licence).toContain("Inkpond Glyphs");
  });
});
