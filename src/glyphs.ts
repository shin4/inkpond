/**
 * The default stroke-density ramp: 留白 → 焦墨. Each level holds a few glyphs
 * of roughly the same weight so neighbouring cells vary. The ramp is texture,
 * not text.
 *
 * They are the 山水 scene's ground: src/assets/inkpond-shanshui.woff2 holds
 * exactly its characters (scripts/build-font.sh reads every scene's glyphs);
 * a custom ramp needs a font that covers it, or it is drawn in the fallback
 * serif.
 */
export const DEFAULT_LEVELS = [
  "一",
  "二人八乙",
  "川山夕么",
  "水云风月石木",
  "雨泉波松苔星",
  "流浪深涧峰",
  "渊潮雾澜溪森晶",
  "墨瀚灏澹濛麒",
] as const;

export const DEFAULT_FONT_FAMILY = "Inkpond Glyphs";
/** The 山水 subset, resolved next to this module by the consumer's bundler. */
export const DEFAULT_FONT_URL = new URL(
  "./assets/inkpond-shanshui.woff2",
  import.meta.url,
).href;
/** Drawn until the font arrives, and wherever it cannot load. */
export const DEFAULT_FALLBACK_FONTS = '"Songti SC", "STSong", "SimSun", serif';

/** Every distinct glyph of a ramp, in order of first appearance. */
export const glyphsOf = (levels: readonly string[]) => [
  ...new Set(levels.join("")),
];
