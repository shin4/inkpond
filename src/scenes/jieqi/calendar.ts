/**
 * The twenty-four solar terms (二十四节气) and which one a date falls in.
 * A term begins when the sun's apparent ecliptic longitude reaches a
 * multiple of 15°; 立春 is 315°. The low-precision solar position below is
 * good to about 0.01°, a quarter of an hour at a term's boundary.
 */

export const JIEQI = [
  { id: "lichun", longitude: 315, name: "立春" },
  { id: "yushui", longitude: 330, name: "雨水" },
  { id: "jingzhe", longitude: 345, name: "惊蛰" },
  { id: "chunfen", longitude: 0, name: "春分" },
  { id: "qingming", longitude: 15, name: "清明" },
  { id: "guyu", longitude: 30, name: "谷雨" },
  { id: "lixia", longitude: 45, name: "立夏" },
  { id: "xiaoman", longitude: 60, name: "小满" },
  { id: "mangzhong", longitude: 75, name: "芒种" },
  { id: "xiazhi", longitude: 90, name: "夏至" },
  { id: "xiaoshu", longitude: 105, name: "小暑" },
  { id: "dashu", longitude: 120, name: "大暑" },
  { id: "liqiu", longitude: 135, name: "立秋" },
  { id: "chushu", longitude: 150, name: "处暑" },
  { id: "bailu", longitude: 165, name: "白露" },
  { id: "qiufen", longitude: 180, name: "秋分" },
  { id: "hanlu", longitude: 195, name: "寒露" },
  { id: "shuangjiang", longitude: 210, name: "霜降" },
  { id: "lidong", longitude: 225, name: "立冬" },
  { id: "xiaoxue", longitude: 240, name: "小雪" },
  { id: "daxue", longitude: 255, name: "大雪" },
  { id: "dongzhi", longitude: 270, name: "冬至" },
  { id: "xiaohan", longitude: 285, name: "小寒" },
  { id: "dahan", longitude: 300, name: "大寒" },
] as const;

export type JieqiTerm = (typeof JIEQI)[number]["id"];

const DAY_MS = 86_400_000;
/** Julian date of the Unix epoch, and of J2000.0. */
const UNIX_JD = 2440587.5;
const J2000 = 2451545;

/** The sun's apparent ecliptic longitude at a moment, in degrees 0–360. */
export const sunLongitude = (date: Date | number) => {
  const d = +date / DAY_MS + UNIX_JD - J2000;
  const g = ((357.529 + 0.98560028 * d) * Math.PI) / 180;
  const l =
    280.459 + 0.98564736 * d + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  return ((l % 360) + 360) % 360;
};

/** Index into JIEQI of the term a moment falls in, 0 (立春) to 23 (大寒). */
export const jieqiIndexAt = (date: Date | number) =>
  Math.floor(((((sunLongitude(date) - 315) % 360) + 360) % 360) / 15);

/** The solar term a moment falls in. */
export const jieqiAt = (date: Date | number = Date.now()): JieqiTerm =>
  JIEQI[jieqiIndexAt(date)]?.id ?? "lichun";
