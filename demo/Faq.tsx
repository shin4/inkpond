import type { ReactNode } from "react";
import { type Lang, rootFrom } from "./copy";
import { INSTALL, REPO, UPDATED, VERSION } from "./site-meta";

/**
 * The questions people (and AI assistants) ask first. One list per language
 * feeds the page, its FAQPage structured data and llms-full.txt; `code` in
 * backticks renders as code, and `example` as a code block after the answer.
 */
export interface Entry {
  q: string;
  a: string;
  example?: string;
}

const NEXT = `// app/page.tsx — a Server Component is fine: inkpond/react is "use client"
import { InkPond } from "inkpond/react";
import "inkpond/inkpond.css";

export default function Page() {
  return (
    <main style={{ position: "relative", minHeight: "100vh" }}>
      <InkPond scene="lotus" />
      <h1 data-inkpond-avoid="">…</h1>
    </main>
  );
}`;

const VUE = `<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { createInkPond, type InkPond } from "inkpond";
import "inkpond/inkpond.css";

const canvas = ref<HTMLCanvasElement>();
let pond: InkPond | undefined;
onMounted(() => { pond = createInkPond(canvas.value!, { scene: "qingming" }); });
onBeforeUnmount(() => pond?.destroy());
</script>

<template>
  <main style="position: relative; min-height: 100vh">
    <canvas ref="canvas" class="inkpond" />
    <h1 data-inkpond-avoid>…</h1>
  </main>
</template>`;

const SVELTE = `<script lang="ts">
  import { onMount } from "svelte";
  import { createInkPond } from "inkpond";
  import "inkpond/inkpond.css";

  let canvas: HTMLCanvasElement;
  onMount(() => {
    const pond = createInkPond(canvas, { scene: "shanshui" });
    return () => pond.destroy();
  });
</script>

<main style="position: relative; min-height: 100vh">
  <canvas bind:this={canvas} class="inkpond"></canvas>
  <h1 data-inkpond-avoid>…</h1>
</main>`;

export const FAQ: Record<Lang, Entry[]> = {
  en: [
    {
      a: "Inkpond (墨池) is a web background library: a layer of animated Chinese glyphs in the style of ink-wash painting, laid behind the page. The glyphs, dense or sparse by stroke count, form distant hills in mist, a lotus pond with swimming koi, or the slowly unrolling handscroll Along the River During the Qingming Festival. The pointer stirs ripples and a click drops ink.",
      q: "What is Inkpond?",
    },
    {
      a: "Front-end developers and designers who want an East Asian ink-wash atmosphere on a page: product landing pages, sign-in pages, the empty start screen of an AI chat app, personal sites, portfolios and event pages, or any page with little content that needs some mood.",
      q: "Who is it for, and where does it fit?",
    },
    {
      a: "An empty landing or chat screen feels bare, while video backgrounds and large images are heavy and compete with the content. Inkpond gives the page a moving, pointer-aware background for very little (a glyph subset of 10–29 KiB per scene, no runtime dependencies) and keeps clear of the content, so text stays readable and the page stays fast.",
      q: "What problem does it solve?",
    },
    {
      a: `Install with \`${INSTALL}\` (or the latest commit with \`npm i github:shin4/inkpond\`). Import the stylesheet with \`import "inkpond/inkpond.css"\`, then put \`<InkPond />\` in a React tree, or call \`createInkPond(canvas)\` on any canvas.`,
      q: "How do I install and use it?",
    },
    {
      a: "The core is a framework-free TypeScript library: `createInkPond(canvas, options)` works in plain JavaScript, Vue, Svelte, Angular and anything else that gives you a canvas. There is also a React component, `inkpond/react`, for React 18 and later (an optional peer dependency).",
      q: "Which frameworks does it support? Is it React only?",
    },
    {
      a: 'Yes. `inkpond/react` is marked "use client", so you can render `<InkPond />` straight from a Server Component in the App Router; import `inkpond/inkpond.css` once (say in the root layout). Pass only plain props across the server boundary; to call `ripple()` or `drop()` from code, use `pondRef` inside a client component of your own.',
      example: NEXT,
      q: "Does it work with Next.js (App Router)?",
    },
    {
      a: "Use the framework-free API: create the pond when the component mounts and destroy it when it unmounts. The canvas needs the `inkpond` class (or your own sizing), and its parent must be positioned.",
      example: VUE,
      q: "How do I use it in Vue?",
    },
    {
      a: "The same pattern: create the pond in `onMount` and return its `destroy`.",
      example: SVELTE,
      q: "How do I use it in Svelte?",
    },
    {
      a: "Four: `shanshui` (the default) is two ranges of hills in mist; `lotus` is a lotus pond whose koi flee the pointer and swim to dropped ink; `qingming` is a handscroll that keeps unrolling, with city walls, a pagoda, the rainbow bridge, boats and walkers; `jieqi` is the twenty-four solar terms, a moving picture for each that changes with the date (or pin one with `term`). Lotus, Qingming and the solar terms carry a touch of pale colour, or ink only with `tint: false`.",
      q: "What scenes are there?",
    },
    {
      a: "Vanta.js draws 3D and WebGL effects with three.js or p5.js, and tsParticles draws configurable particles, confetti and similar effects; both offer many presets. Inkpond does one narrower thing: an ink-wash picture made of Chinese glyphs, with scenes that avoid your content (clear zones that koi, boats and walkers steer around), on Canvas 2D with no runtime dependencies. Pick Inkpond for that East Asian ink look behind text-heavy or empty pages; pick the others for 3D or particle effects.",
      q: "How is it different from Vanta.js or tsParticles?",
    },
    {
      a: "Not noticeably. Each glyph is rasterised once and every frame only copies from the atlas; measured at 1920×1080 and DPR 1.5, the script takes a median of under 1 ms per calm frame, and about 2 ms at the p95 when the whole screen is stirred; the busiest solar terms cost about the same as Qingming. It lowers its frame rate when calm, stops after 30 s idle, pauses in hidden tabs, and steps down to a lite tier or a still picture on weak devices or software rendering.",
      q: "Will it slow the page down or drain the battery?",
    },
    {
      a: "No. Mark content elements with `data-inkpond-avoid` and a clear zone forms around them, which koi, boats and walkers also avoid; clicks on buttons, links, inputs and other controls never drop ink. The canvas sits under the nearest positioned parent and does not affect layout.",
      q: "Does it cover or interfere with page content?",
    },
    {
      a: "Yes. On touch screens a dragging finger does not stir ripples (so scrolling stays smooth), and a tap on empty space drops ink. Devices with fewer cores or less memory start on the lite tier, with larger cells and a lower frame rate.",
      q: "How does it behave on phones and touch screens?",
    },
    {
      a: "The canvas is hidden from screen readers (`aria-hidden`); with reduced motion on, it draws one still picture; in forced-colours (high contrast) mode the canvas is hidden so text stays legible.",
      q: "Is it accessible?",
    },
    {
      a: "Yes. The ink and the four pale pigments (vermilion, rouge, ochre, indigo) are CSS variables with dark-mode values; ink depth, wave speed and the width of clear zones are options; `levels` replaces the glyphs of the main ground (other glyphs need a font that covers them).",
      q: "Can I change the colours, the depth or the glyphs?",
    },
    {
      a: "Yes. The code is MIT licensed: free for personal and commercial projects as long as the copyright notice stays. The bundled glyph subsets of Source Han Serif are under the SIL Open Font License 1.1, which also allows commercial use.",
      q: "Can I use it commercially? What is the licence?",
    },
    {
      a: "From Source Han Serif SC Medium. Each scene ships only the glyphs it uses, 10–29 KiB each (the 24 solar terms share one), loaded only when that scene is. As the OFL requires, the subsets are renamed Inkpond Glyphs.",
      q: "Where does the font come from, and how much does it load?",
    },
    {
      a: "Inkpond grew from stackedlol/ascii-sharks, a sea of characters swimming behind the page. Inkpond turns the idea into ink wash and Chinese glyphs and was written from scratch, with no code from the original.",
      q: "How is it related to ascii-sharks?",
    },
  ],
  zh: [
    {
      a: "墨池（Inkpond）是一个网页背景库：在页面背后铺一层水墨风格的汉字动画。汉字按笔画疏密排成远山云雾、鲤鱼游动的荷塘，或缓缓展开的清明上河长卷；鼠标划过泛起水波，点击空白处落墨。",
      q: "墨池是什么？",
    },
    {
      a: "给想让网页有东方水墨氛围的前端开发者和设计师：产品首页、登录页、AI 对话应用的空白起始页、个人主页、作品集、活动页，以及任何内容不多、需要一点氛围的页面。",
      q: "墨池给谁用？适合用在哪里？",
    },
    {
      a: "空白的首页或对话页显得冷清，而视频背景或大图又重又抢内容。墨池用很少的资源（每个场景十到三十 KiB 的字体子集，无运行时依赖）给页面一层会动、会回应鼠标的水墨背景，同时自动避开页面上的内容，不遮挡文字，也不拖慢页面。",
      q: "墨池解决什么问题？",
    },
    {
      a: `用 npm 安装：\`${INSTALL}\`（也可以从 GitHub 安装最新提交：\`npm i github:shin4/inkpond\`）。然后引入样式 \`import "inkpond/inkpond.css"\`，在 React 里放一个 \`<InkPond />\`，或者用 \`createInkPond(canvas)\` 挂到任意画布上。`,
      q: "怎么安装和使用？",
    },
    {
      a: "核心是不依赖任何框架的 TypeScript 库，`createInkPond(canvas, options)` 在原生 JavaScript、Vue、Svelte、Angular 里都能用。另外提供一个 React 组件 `inkpond/react`（需要 React 18 及以上，是可选依赖）。",
      q: "支持哪些框架？只能用 React 吗？",
    },
    {
      a: '可以。`inkpond/react` 已经标了 "use client"，在 App Router 的服务端组件里可以直接写 `<InkPond />`；`inkpond/inkpond.css` 引入一次即可（比如放在根 layout）。跨服务端边界只能传普通的属性；想在代码里调用 `ripple()` 或 `drop()`，就在你自己的客户端组件里用 `pondRef`。',
      example: NEXT,
      q: "能在 Next.js（App Router）里用吗？",
    },
    {
      a: "用不依赖框架的接口：组件挂载时创建，卸载时销毁。画布要带 `inkpond` 类名（或自己设置尺寸），父元素需要是定位元素。",
      example: VUE,
      q: "在 Vue 里怎么用？",
    },
    {
      a: "同样的做法：在 `onMount` 里创建，返回它的 `destroy`。",
      example: SVELTE,
      q: "在 Svelte 里怎么用？",
    },
    {
      a: "有四个场景：`shanshui`（山水，默认）是两重远山与云雾；`lotus`（荷塘）是荷叶荷花，鲤鱼会躲开鼠标、游向落墨处；`qingming`（清明上河）是一卷不断展开的长卷，有城郭、宝塔、虹桥、船只和行人；`jieqi`（二十四节气）一节一画，按日期自动切换，也可以用 `term` 固定某一个。荷塘、清明和节气带淡彩，也可以只用墨色。",
      q: "有哪些场景？",
    },
    {
      a: "Vanta.js 用 three.js 或 p5.js 做 3D、WebGL 效果，tsParticles 做可配置的粒子、彩带等效果，两者都有很多预设。墨池只做更窄的一件事：用汉字组成的水墨画面，并且会避开页面内容（留白区，鲤鱼、船、行人也会绕开），基于 Canvas 2D、零运行时依赖。想要东方水墨感、页面以文字为主或比较空时选墨池；想要 3D 或粒子效果时选它们。",
      q: "和 Vanta.js、tsParticles 有什么不同？",
    },
    {
      a: "不会明显拖慢。每个字只栅格化一次，之后每帧只贴图；实测（1920×1080，DPR 1.5）静水时每帧脚本耗时中位数不到 1 ms，满屏搅动时 p95 约 2 ms；最繁忙的节气画面和清明上河相当。画面静下来会降帧，30 秒无操作就停帧；标签页隐藏时暂停；弱设备或软件渲染时自动降到轻量档或静止画面。",
      q: "会不会拖慢页面、耗电？",
    },
    {
      a: "不会。给内容元素加上 `data-inkpond-avoid` 属性，它周围就会自动留白，鲤鱼、船和行人也会绕开；点击按钮、链接、输入框等可交互元素时不会落墨。画布铺在最近的定位父元素下面，不影响布局。",
      q: "会遮挡或干扰页面上的内容吗？",
    },
    {
      a: "可以用。触屏上手指滑动不会起波（避免和页面滚动冲突），轻点空白处会落墨；CPU 或内存偏弱的设备从轻量档开始，字格更大、帧率更低。",
      q: "手机和触屏上效果怎样？",
    },
    {
      a: "画布对读屏软件隐藏（`aria-hidden`）；系统开启「减少动画」时只画一张静止画面；高对比度（强制颜色）模式下隐藏画布，保证文字可读。",
      q: "对无障碍友好吗？",
    },
    {
      a: "可以换。墨色和四种淡彩（朱、胭脂、赭石、花青）都是 CSS 变量，支持暗色主题；浓淡、水波速度、留白宽度都有选项；`levels` 可以替换主地面用的字（换字需要自备覆盖这些字的字体）。",
      q: "能改颜色、浓淡或换成自己的字吗？",
    },
    {
      a: "可以。代码以 MIT 许可发布，个人和商业项目都能免费使用，保留版权声明即可。随包附带的字体是思源宋体的子集，按 SIL OFL 1.1 授权，同样允许商用。",
      q: "可以商用吗？是什么许可？",
    },
    {
      a: "字形来自思源宋体 SC Medium（Source Han Serif），每个场景只带自己用到的字，约 10–29 KiB 一个（二十四节气共用一个），用到哪个场景才加载哪个。按 OFL 规定改名为 Inkpond Glyphs。",
      q: "字体从哪里来？要额外加载多少？",
    },
    {
      a: "墨池的想法来自 stackedlol/ascii-sharks：用字符在页面背后养一片会游动的海。墨池把它换成了水墨和汉字，代码从头写起，没有使用原仓库的代码。",
      q: "和 ascii-sharks 是什么关系？",
    },
  ],
};

const PAGE = {
  en: {
    h1: "About Inkpond",
    kicker: "FAQ",
    lang: { href: "../../faq/", label: "中文" },
    lead: [
      "Inkpond is an ink-wash background library of Chinese glyphs for web developers. Straight answers to the questions asked most; for the full usage see the",
      ", and for the live scenes the",
      "project page",
      ".",
    ],
    licence: "Code under MIT · font under SIL OFL 1.1",
    nav: { scenes: "Scenes", use: "Usage" },
  },
  zh: {
    h1: "关于墨池 Inkpond",
    kicker: "常见问题 · FAQ",
    lang: { href: "../en/faq/", label: "EN" },
    lead: [
      "墨池是给网页开发者用的水墨汉字背景库。下面直接回答最常被问到的问题；更完整的用法见",
      "，在线效果见",
      "项目主页",
      "。",
    ],
    licence: "代码以 MIT 许可发布 · 字体按 SIL OFL 1.1 授权",
    nav: { scenes: "四卷", use: "用法" },
  },
} as const;

/** Plain text of an answer, for structured data and llms-full.txt. */
export const plain = (text: string) => text.replaceAll("`", "");

const rich = (text: string): ReactNode[] =>
  text
    .split("`")
    .map((part, k) => (k % 2 ? <code key={part}>{part}</code> : part));

export const Faq = ({ lang }: { lang: Lang }) => {
  const words = PAGE[lang];
  const root = rootFrom(lang, 1);
  return (
    <>
      <header className="faq-bar">
        <a className="mark" href="../">
          INKPOND / 墨池
        </a>
        <span className="bar-links">
          <a href="../#scenes">{words.nav.scenes}</a>
          <a href="../#use">{words.nav.use}</a>
          <a href={REPO}>GitHub</a>
          <a
            className="lang"
            href={words.lang.href}
            hrefLang={lang === "zh" ? "en" : "zh-CN"}
          >
            {words.lang.label}
          </a>
        </span>
      </header>
      <main className="faq">
        <p className="kicker">{words.kicker}</p>
        <h1>{words.h1}</h1>
        <p className="faq-lead">
          {words.lead[0]} <a href={`${REPO}#readme`}>README</a>
          {words.lead[1]} <a href="../">{words.lead[2]}</a>
          {words.lead[3]}
        </p>
        <dl>
          {FAQ[lang].map(({ q, a, example }) => (
            <div className="faq-item" key={q}>
              <dt>
                <h2>{q}</h2>
              </dt>
              <dd>
                {rich(a)}
                {example ? (
                  <pre>
                    <code>{example}</code>
                  </pre>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </main>
      <footer className="credits">
        <p>
          {words.licence} · v{VERSION} ·{" "}
          <time dateTime={UPDATED}>{UPDATED}</time> · <a href={REPO}>GitHub</a>{" "}
          · <a href={`${root}llms.txt`}>llms.txt</a>
        </p>
      </footer>
    </>
  );
};
