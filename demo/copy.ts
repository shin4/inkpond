import type { SceneName } from "../src/scenes";
import { LEDE, LEDE_EN } from "./site-meta";

/** The project page and FAQ come in Chinese (the root) and English (/en/). */
export type Lang = "zh" | "en";

export interface SceneCopy {
  name: SceneName;
  /** 浓淡 to show it at: fuller than the quiet default for a background. */
  strength: number;
  /** Whether the scene has 淡彩 to toggle. */
  tinted: boolean;
  title: string;
  latin: string;
  line: string;
  moves: string[];
}

const SCENE_BASE = {
  lotus: { strength: 0.6, tinted: true },
  qingming: { strength: 0.6, tinted: true },
  shanshui: { strength: 0.9, tinted: false },
  jieqi: { strength: 0.6, tinted: true },
} as const;

const scene = (
  name: SceneName,
  copy: Omit<SceneCopy, "name" | "strength" | "tinted">,
): SceneCopy => ({ name, ...SCENE_BASE[name], ...copy });

const snippet = (heading: string) => `import { InkPond } from "inkpond/react";
import "inkpond/inkpond.css";

<main style={{ position: "relative" }}>
  <InkPond scene="qingming" />
  <h1 data-inkpond-avoid="">${heading}</h1>
</main>`;

const vanilla = (
  ripple: string,
  drop: string,
) => `import { createInkPond } from "inkpond";
import "inkpond/inkpond.css";

const pond = createInkPond(canvas, { scene: "lotus" });
pond.ripple(x, y, 0.6); // ${ripple}
pond.drop(x, y);        // ${drop}`;

export const COPY = {
  en: {
    copied: "Copied",
    copy: "Copy",
    credits: [
      "Inspired by",
      "— a sea of characters swimming behind the page. Thanks to its author for the idea; Inkpond turns it into ink wash and Chinese glyphs, written from scratch.",
    ],
    cue: "↓ Unroll",
    facts: ["Canvas 2D", "0 dependencies", "4 scenes", "MIT"],
    faq: "FAQ",
    h1Hidden: "Inkpond: an ink-wash background of Chinese glyphs for the web",
    intro: [
      "Ink wash laid behind the page.",
      "Glyphs dense or sparse by stroke count; the pointer is wind, a click is ink.",
    ],
    kickers: {
      perf: "PERFORMANCE",
      scenes: "FOUR SCROLLS",
      use: "USAGE",
    },
    lang: { href: "../", label: "中文" },
    lede: LEDE_EN,
    licence:
      "Glyphs from Source Han Serif (SIL OFL 1.1), renamed Inkpond Glyphs · code under MIT",
    nav: { scenes: "Scenes", session: "Chat demo", use: "Usage" },
    note: [
      "The canvas fills its nearest positioned parent; elements with",
      "keep a clear zone, and koi, boats and walkers steer around them.",
    ],
    perfNote:
      "Every frame only copies from a prerasterised glyph atlas; still parts are computed once per size and slow layers every 4 frames; slow devices step down to lite or a still picture, and hidden tabs pause.",
    reactSnippet: snippet("What shall we make today?"),
    scenes: [
      scene("shanshui", {
        latin: "山水 Shanshui",
        line: "Two ranges of distant hills with mist drifting past their slopes. The quietest scroll, and the default.",
        moves: [
          "Sweep for ripples",
          "Click to drop ink",
          "Mist drifts by itself",
        ],
        title: "Hills",
      }),
      scene("lotus", {
        latin: "荷塘 Lotus Pond",
        line: "A lotus pond seen from above. Koi swim around the page content, scatter when you come near and race to where ink drops.",
        moves: ["Koi avoid you", "Ink draws the koi", "They hide under leaves"],
        title: "Lotus",
      }),
      scene("qingming", {
        latin: "清明上河 Along the River at Qingming",
        line: "The scroll unrolls to the left: city walls under the mountains, a pagoda, taverns with flags along both banks, and a timber rainbow bridge arching from the near bank over the river, its foot crowded with a market while a big boat lowers its mast.",
        moves: ["The scroll unrolls", "Boatmen pole", "Ink scatters walkers"],
        title: "Qingming",
      }),
      scene("jieqi", {
        latin: "二十四节气 The 24 Solar Terms",
        line: "A picture for each of the twenty-four solar terms, chosen by today's date: ice cracking at the Start of Spring, frogs' calls ringing across the pond, geese shifting formation, frost growing in from the edges, one vermilion sun in the longest night. Keep the page open into the next term and it bleeds over in ink.",
        moves: ["Follows the date", "Each term answers ink", "term pins one"],
        title: "Solar Terms",
      }),
    ],
    stats: [
      ["0", "runtime dependencies"],
      ["0.7", "ms / frame of script on calm water"],
      ["1.9", "ms / frame p95, the whole screen stirred"],
      ["10–29", "KiB glyph subset per scene, loaded on demand"],
      ["30", "seconds idle and it stops; the next input wakes it"],
    ],
    theme: { dark: "● Dark", light: "○ Light", system: "◐ System" },
    tint: "Tint",
    vanillaLabel: "Vanilla",
    vanillaSnippet: vanilla("stir the water", "drop ink"),
    weight: "Depth",
  },
  zh: {
    copied: "已复制",
    copy: "复制",
    credits: [
      "受",
      "启发——用字符在页面背后养一片会游动的海。感谢原作者的创意；墨池把它换成了水墨与汉字，代码从头写起。",
    ],
    cue: "↓ 向下展开",
    facts: ["Canvas 2D", "0 dependencies", "4 scenes", "MIT"],
    faq: "常见问题",
    h1Hidden: "Inkpond：网页水墨汉字背景库",
    intro: [
      "一层铺在页面背后的水墨。",
      "字按笔画疏密成画，鼠标是风，点击是墨。",
    ],
    kickers: {
      perf: "性能 · PERFORMANCE",
      scenes: "四卷 · FOUR SCROLLS",
      use: "用法 · USAGE",
    },
    lang: { href: "./en/", label: "EN" },
    lede: LEDE,
    licence:
      "字形取自思源宋体（SIL OFL 1.1），改名为 Inkpond Glyphs · 代码以 MIT 许可发布",
    nav: { scenes: "四卷", session: "发起会话 Demo", use: "用法" },
    note: [
      "画布铺满最近的定位父元素；带",
      "的元素周围自动留白，鱼、船、行人也会绕开它。",
    ],
    perfNote:
      "每帧只从预先栅格化的字形图集贴图；静止的画面按尺寸预算，慢变层每 4 帧重算一次；性能不够时自动降到轻量档或静帧，标签页隐藏即暂停。",
    reactSnippet: snippet("今天想做点什么？"),
    scenes: [
      scene("shanshui", {
        latin: "Shanshui",
        line: "两重远山，云雾从山腰飘过。最安静的一卷，默认场景。",
        moves: ["划过起波", "点击落墨", "云雾自己飘"],
        title: "山水",
      }),
      scene("lotus", {
        latin: "Lotus Pond",
        line: "俯看一方荷塘。鲤鱼绕开页面内容游动，靠近会散开，落墨处会游过来抢食。",
        moves: ["鲤鱼躲开你", "落墨引鱼", "游到荷叶下隐去"],
        title: "荷塘",
      }),
      scene("qingming", {
        latin: "Along the River at Qingming",
        line: "长卷缓缓向左展开：群山之下城郭绵延，宝塔高耸，两岸酒旗飞檐，木拱虹桥从近岸拱起、越过河面落在远岸，桥头集市熙攘，桥边大船正放倒桅杆。",
        moves: ["长卷自己展开", "船夫撑船", "落墨惊散行人"],
        title: "清明上河",
      }),
      scene("jieqi", {
        latin: "The 24 Solar Terms",
        line: "二十四节气，一节一画，按今天的日期自动选：立春冰裂、立夏蛙鸣、寒露雁阵变换、霜降霜花从边缘结出、冬至长夜里一点朱阳。页面开着跨入下一个节气，会以墨晕过渡过去。",
        moves: ["随日期轮换", "落墨各有回应", "term 固定一个"],
        title: "二十四节气",
      }),
    ],
    stats: [
      ["0", "运行时依赖"],
      ["0.7", "ms / 帧，静水时的脚本开销"],
      ["1.9", "ms / 帧，满屏搅动的 p95"],
      ["10–29", "KiB，每个场景的字体子集，按需加载"],
      ["30", "秒无操作即停帧，下一次输入再醒"],
    ],
    theme: { dark: "● 暗", light: "○ 亮", system: "◐ 跟随系统" },
    tint: "淡彩",
    vanillaLabel: "原生",
    vanillaSnippet: vanilla("拨动水面", "落墨"),
    weight: "浓淡",
  },
} satisfies Record<Lang, unknown>;

/** Path from a page back to the site root, where session/ and llms.txt live. */
export const rootFrom = (lang: Lang, depth: 0 | 1) =>
  "../".repeat((lang === "en" ? 1 : 0) + depth) || "./";
