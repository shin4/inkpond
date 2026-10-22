import { type RefObject, useEffect, useRef, useState } from "react";
import { InkPond } from "../src/react";
import type { SceneName } from "../src/scenes";

const REPO = "https://github.com/shin4/inkpond";
const INSPIRATION = "https://github.com/stackedlol/ascii-sharks";

type Theme = "system" | "light" | "dark";
const THEME_KEY = "inkpond-site.theme";

const SCENES: {
  name: SceneName;
  /** 浓淡 to show it at: fuller than the quiet default for a background. */
  strength: number;
  /** Whether the scene has 淡彩 to toggle. */
  tinted: boolean;
  title: string;
  latin: string;
  line: string;
  moves: string[];
}[] = [
  {
    latin: "Shanshui",
    line: "两重远山，云雾从山腰飘过。最安静的一卷，默认场景。",
    moves: ["划过起波", "点击落墨", "云雾自己飘"],
    name: "shanshui",
    strength: 0.9,
    tinted: false,
    title: "山水",
  },
  {
    latin: "Lotus Pond",
    line: "俯看一方荷塘。鲤鱼绕开页面内容游动，靠近会散开，落墨处会游过来抢食。",
    moves: ["鲤鱼躲开你", "落墨引鱼", "游到荷叶下隐去"],
    name: "lotus",
    strength: 0.6,
    tinted: true,
    title: "荷塘",
  },
  {
    latin: "Along the River at Qingming",
    line: "长卷缓缓向左展开：群山之下城郭绵延，宝塔高耸，两岸酒旗飞檐，木拱虹桥从近岸拱起、越过河面落在远岸，桥头集市熙攘，桥边大船正放倒桅杆。",
    moves: ["长卷自己展开", "船夫撑船", "落墨惊散行人"],
    name: "qingming",
    strength: 0.6,
    tinted: true,
    title: "清明上河",
  },
];

const REACT_SNIPPET = `import { InkPond } from "inkpond/react";
import "inkpond/inkpond.css";

<main style={{ position: "relative" }}>
  <InkPond scene="qingming" />
  <h1 data-inkpond-avoid="">今天想做点什么？</h1>
</main>`;

const VANILLA_SNIPPET = `import { createInkPond } from "inkpond";
import "inkpond/inkpond.css";

const pond = createInkPond(canvas, { scene: "lotus" });
pond.ripple(x, y, 0.6); // 拨动水面
pond.drop(x, y);        // 落墨`;

const recallTheme = (): Theme => {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === "light" || saved === "dark" ? saved : "system";
  } catch {
    return "system";
  }
};

/** Whether enough of the element is on screen to be worth animating. */
const useOnScreen = (ref: RefObject<Element | null>) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => setVisible(Boolean(entry?.isIntersecting)),
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return visible;
};

const Copy = ({ text }: { text: string }) => {
  const [done, setDone] = useState(false);
  return (
    <button
      className="copy"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(
          () => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1400);
          },
          () => {},
        );
      }}
      type="button"
    >
      {done ? "已复制" : "复制"}
    </button>
  );
};

const Hero = ({ theme, onTheme }: { theme: Theme; onTheme: () => void }) => {
  const ref = useRef<HTMLElement>(null);
  const visible = useOnScreen(ref);
  return (
    <header className="hero" ref={ref}>
      <InkPond
        active={visible}
        avoidFade={64}
        scene="qingming"
        strength={0.55}
      />
      <nav className="bar" data-inkpond-avoid="">
        <span className="mark">INKPOND / 墨池</span>
        <span className="bar-links">
          <a href="#scenes">三卷</a>
          <a href="#use">用法</a>
          <a href="./session/">发起会话 Demo</a>
          <a href={REPO}>GitHub</a>
          <button className="theme" onClick={onTheme} type="button">
            {theme === "system"
              ? "◐ 跟随系统"
              : theme === "light"
                ? "○ 亮"
                : "● 暗"}
          </button>
        </span>
      </nav>
      <div className="hero-title" data-inkpond-avoid="">
        <h1>墨池</h1>
        <span aria-hidden="true" className="seal">
          墨<br />池
        </span>
      </div>
      <div className="hero-copy" data-inkpond-avoid="">
        <p className="motto">以字为墨，以页为池。</p>
        <p className="latin">
          An ink-wash background of Chinese glyphs for the web — hills in mist,
          koi in a lotus pond, and a handscroll of the river at Qingming that
          never stops unrolling.
        </p>
        <div className="install">
          <code>npm i github:shin4/inkpond</code>
          <Copy text="npm i github:shin4/inkpond" />
        </div>
        <ul className="facts">
          <li>Canvas 2D</li>
          <li>0 dependencies</li>
          <li>3 scenes</li>
          <li>MIT</li>
        </ul>
      </div>
      <a className="cue" data-inkpond-avoid="" href="#scenes">
        ↓ 向下展开
      </a>
    </header>
  );
};

const ScenePanel = ({
  index,
  scene,
}: {
  index: number;
  scene: (typeof SCENES)[number];
}) => {
  const ref = useRef<HTMLElement>(null);
  const visible = useOnScreen(ref);
  const [tint, setTint] = useState(true);
  const [strength, setStrength] = useState(scene.strength);
  return (
    <section className={`scene scene-${scene.name}`} ref={ref}>
      <InkPond
        active={visible}
        avoidFade={56}
        key={`${tint}-${strength}`}
        scene={scene.name}
        strength={strength}
        tint={tint}
      />
      <div className="caption" data-inkpond-avoid="">
        <span className="numeral">{String(index + 1).padStart(2, "0")}</span>
        <h2>
          {scene.title}
          <small>{scene.latin}</small>
        </h2>
        <p>{scene.line}</p>
        <ul className="moves">
          {scene.moves.map((move) => (
            <li key={move}>{move}</li>
          ))}
        </ul>
        <div className="controls">
          {scene.tinted ? (
            <label>
              <input
                checked={tint}
                onChange={(event) => setTint(event.target.checked)}
                type="checkbox"
              />
              淡彩
            </label>
          ) : null}
          <label>
            浓淡
            <input
              max={1.2}
              min={0.25}
              onChange={(event) => setStrength(Number(event.target.value))}
              step={0.05}
              type="range"
              value={strength}
            />
          </label>
          <code>scene="{scene.name}"</code>
        </div>
      </div>
    </section>
  );
};

const STATS = [
  ["0", "运行时依赖"],
  ["0.7", "ms / 帧，静水时的脚本开销"],
  ["1.9", "ms / 帧，满屏搅动的 p95"],
  ["10–21", "KiB，每个场景的字体子集，按需加载"],
  ["30", "秒无操作即停帧，下一次输入再醒"],
];

export const Landing = () => {
  const [theme, setTheme] = useState<Theme>(recallTheme);
  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // Private mode: the choice just is not remembered.
    }
  }, [theme]);
  const cycle = () =>
    setTheme((t) =>
      t === "system" ? "light" : t === "light" ? "dark" : "system",
    );

  return (
    <>
      <Hero onTheme={cycle} theme={theme} />
      <main>
        <section className="intro" id="scenes">
          <p className="kicker">三卷 · THREE SCROLLS</p>
          <h2 className="intro-title">
            一层铺在页面背后的水墨。
            <br />
            字按笔画疏密成画，鼠标是风，点击是墨。
          </h2>
        </section>
        {SCENES.map((scene, k) => (
          <ScenePanel index={k} key={scene.name} scene={scene} />
        ))}
        <section className="use" id="use">
          <p className="kicker">用法 · USAGE</p>
          <div className="snippets">
            <figure>
              <figcaption>
                React <Copy text={REACT_SNIPPET} />
              </figcaption>
              <pre>
                <code>{REACT_SNIPPET}</code>
              </pre>
            </figure>
            <figure>
              <figcaption>
                原生 <Copy text={VANILLA_SNIPPET} />
              </figcaption>
              <pre>
                <code>{VANILLA_SNIPPET}</code>
              </pre>
            </figure>
          </div>
          <p className="note">
            画布铺满最近的定位父元素；带 <code>data-inkpond-avoid</code>{" "}
            的元素周围自动留白，鱼、船、行人也会绕开它。
          </p>
        </section>
        <section className="stats">
          <p className="kicker">性能 · PERFORMANCE</p>
          <dl>
            {STATS.map(([value, label]) => (
              <div key={label}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          <p className="note">
            每帧只从预先栅格化的字形图集贴图；静止的画面按尺寸预算，慢变层每 4
            帧重算一次；性能不够时自动降到轻量档或静帧，标签页隐藏即暂停。
          </p>
        </section>
      </main>
      <footer className="credits">
        <p>
          受 <a href={INSPIRATION}>stackedlol/ascii-sharks</a>{" "}
          启发——用字符在页面背后养一片会游动的海。感谢原作者的创意；墨池把它换成了水墨与汉字，代码从头写起。
        </p>
        <p>
          字形取自思源宋体（SIL OFL 1.1），改名为 Inkpond Glyphs · 代码以 MIT
          许可发布 · <a href={REPO}>GitHub</a> ·{" "}
          <a href="./session/">发起会话 Demo</a>
        </p>
      </footer>
    </>
  );
};
