import type { ReactNode } from "react";
import { INSTALL, REPO, SITE } from "./site-meta";

/**
 * The questions people (and AI assistants) ask first. One list feeds the
 * page and its FAQPage structured data; `code` in backticks renders as code.
 */
export const FAQ: { q: string; a: string }[] = [
  {
    a: "墨池（Inkpond）是一个网页背景库：在页面背后铺一层水墨风格的汉字动画。汉字按笔画疏密排成远山云雾、鲤鱼游动的荷塘，或缓缓展开的清明上河长卷；鼠标划过泛起水波，点击空白处落墨。",
    q: "墨池是什么？",
  },
  {
    a: "给想让网页有东方水墨氛围的前端开发者和设计师：产品首页、登录页、AI 对话应用的空白起始页、个人主页、作品集、活动页，以及任何内容不多、需要一点氛围的页面。",
    q: "墨池给谁用？适合用在哪里？",
  },
  {
    a: "空白的首页或对话页显得冷清，而视频背景或大图又重又抢内容。墨池用很少的资源（每个场景十几 KiB 的字体子集，无运行时依赖）给页面一层会动、会回应鼠标的水墨背景，同时自动避开页面上的内容，不遮挡文字，也不拖慢页面。",
    q: "墨池解决什么问题？",
  },
  {
    a: `目前从 GitHub 安装：\`${INSTALL}\`，安装时会自动构建。然后引入样式 \`import "inkpond/inkpond.css"\`，在 React 里放一个 \`<InkPond />\`，或者用 \`createInkPond(canvas)\` 挂到任意画布上。`,
    q: "怎么安装和使用？",
  },
  {
    a: "核心是不依赖任何框架的 TypeScript 库，`createInkPond(canvas, options)` 在原生 JavaScript、Vue、Svelte、Angular 里都能用。另外提供一个 React 组件 `inkpond/react`（需要 React 18 及以上，是可选依赖）。",
    q: "支持哪些框架？只能用 React 吗？",
  },
  {
    a: "有三个场景：`shanshui`（山水，默认）是两重远山与云雾；`lotus`（荷塘）是荷叶荷花，鲤鱼会躲开鼠标、游向落墨处；`qingming`（清明上河）是一卷不断展开的长卷，有城郭、宝塔、虹桥、船只和行人。荷塘和清明带淡彩，也可以只用墨色。",
    q: "有哪些场景？",
  },
  {
    a: "不会明显拖慢。每个字只栅格化一次，之后每帧只贴图；实测（1920×1080，DPR 1.5）每帧脚本耗时中位数 0.2–0.7 ms，满屏搅动时 p95 不超过 1.9 ms。画面静下来会降帧，30 秒无操作就停帧；标签页隐藏时暂停；弱设备或软件渲染时自动降到轻量档或静止画面。",
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
    a: "字形来自思源宋体 SC Medium（Source Han Serif），每个场景只带自己用到的字，约 10–21 KiB 一个，用到哪个场景才加载哪个。按 OFL 规定改名为 Inkpond Glyphs。",
    q: "字体从哪里来？要额外加载多少？",
  },
  {
    a: "墨池的想法来自 stackedlol/ascii-sharks：用字符在页面背后养一片会游动的海。墨池把它换成了水墨和汉字，代码从头写起，没有使用原仓库的代码。",
    q: "和 ascii-sharks 是什么关系？",
  },
];

/** Plain text of an answer, for structured data and llms.txt. */
export const plain = (text: string) => text.replaceAll("`", "");

const rich = (text: string): ReactNode[] =>
  text
    .split("`")
    .map((part, k) => (k % 2 ? <code key={part}>{part}</code> : part));

export const Faq = () => (
  <>
    <header className="faq-bar">
      <a className="mark" href="../">
        INKPOND / 墨池
      </a>
      <span className="bar-links">
        <a href="../#scenes">三卷</a>
        <a href="../#use">用法</a>
        <a href={REPO}>GitHub</a>
      </span>
    </header>
    <main className="faq">
      <p className="kicker">常见问题 · FAQ</p>
      <h1>关于墨池 Inkpond</h1>
      <p className="faq-lead">
        墨池是给网页开发者用的水墨汉字背景库。下面直接回答最常被问到的问题；更完整的用法见{" "}
        <a href={`${REPO}#readme`}>README</a>，在线效果见{" "}
        <a href={SITE}>项目主页</a>。
      </p>
      <dl>
        {FAQ.map(({ q, a }) => (
          <div className="faq-item" key={q}>
            <dt>
              <h2>{q}</h2>
            </dt>
            <dd>{rich(a)}</dd>
          </div>
        ))}
      </dl>
    </main>
    <footer className="credits">
      <p>
        代码以 MIT 许可发布 · 字体按 SIL OFL 1.1 授权 ·{" "}
        <a href={REPO}>GitHub</a> · <a href="../llms.txt">llms.txt</a>
      </p>
    </footer>
  </>
);
