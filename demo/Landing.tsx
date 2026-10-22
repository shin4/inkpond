import { type RefObject, useEffect, useRef, useState } from "react";
import { InkPond } from "../src/react";
import { COPY, type Lang, rootFrom, type SceneCopy } from "./copy";
import { INSTALL, REPO, UPDATED, VERSION } from "./site-meta";

const INSPIRATION = "https://github.com/stackedlol/ascii-sharks";

type Theme = "system" | "light" | "dark";
const THEME_KEY = "inkpond-site.theme";

export const recallTheme = (): Theme => {
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

type Words = (typeof COPY)[Lang];

const Copy = ({ text, words }: { text: string; words: Words }) => {
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
      {done ? words.copied : words.copy}
    </button>
  );
};

const Hero = ({
  lang,
  theme,
  onTheme,
}: {
  lang: Lang;
  theme: Theme;
  onTheme: () => void;
}) => {
  const words = COPY[lang];
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
          <a href="#scenes">{words.nav.scenes}</a>
          <a href="#use">{words.nav.use}</a>
          <a href={`${rootFrom(lang, 0)}session/`}>{words.nav.session}</a>
          <a href="./faq/">FAQ</a>
          <a href={REPO}>GitHub</a>
          <a
            className="lang"
            href={words.lang.href}
            hrefLang={lang === "zh" ? "en" : "zh-CN"}
          >
            {words.lang.label}
          </a>
          <button className="theme" onClick={onTheme} type="button">
            {words.theme[theme]}
          </button>
        </span>
      </nav>
      <div className="hero-title" data-inkpond-avoid="">
        <h1>
          墨池<span className="sr-only">{words.h1Hidden}</span>
        </h1>
        <p className="motto">以字为墨，以页为池。</p>
        <span aria-hidden="true" className="seal">
          墨<br />池
        </span>
      </div>
      <div className="hero-copy" data-inkpond-avoid="">
        <p className="lede">{words.lede}</p>
        <div className="install">
          <code>{INSTALL}</code>
          <Copy text={INSTALL} words={words} />
        </div>
        <ul className="facts">
          {words.facts.map((fact) => (
            <li key={fact}>{fact}</li>
          ))}
        </ul>
      </div>
      <a className="cue" data-inkpond-avoid="" href="#scenes">
        {words.cue}
      </a>
    </header>
  );
};

const ScenePanel = ({
  index,
  scene,
  words,
}: {
  index: number;
  scene: SceneCopy;
  words: Words;
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
              {words.tint}
            </label>
          ) : null}
          <label>
            {words.weight}
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

export const Landing = ({ lang }: { lang: Lang }) => {
  const words = COPY[lang];
  const root = rootFrom(lang, 0);
  // "system" on the first render, so it matches the prerendered HTML; the
  // saved choice is applied by the inline script in index.html and here.
  const [theme, setTheme] = useState<Theme>("system");
  const recalled = useRef(false);
  useEffect(() => setTheme(recallTheme()), []);
  useEffect(() => {
    // The first pass would undo the inline script; the recalled theme follows.
    if (!recalled.current) {
      recalled.current = true;
      return;
    }
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
      <Hero lang={lang} onTheme={cycle} theme={theme} />
      <main>
        <section className="intro" id="scenes">
          <p className="kicker">{words.kickers.scenes}</p>
          <h2 className="intro-title">
            {words.intro[0]}
            <br />
            {words.intro[1]}
          </h2>
        </section>
        {words.scenes.map((scene, k) => (
          <ScenePanel index={k} key={scene.name} scene={scene} words={words} />
        ))}
        <section className="use" id="use">
          <p className="kicker">{words.kickers.use}</p>
          <div className="snippets">
            <figure>
              <figcaption>
                React <Copy text={words.reactSnippet} words={words} />
              </figcaption>
              <pre>
                <code>{words.reactSnippet}</code>
              </pre>
            </figure>
            <figure>
              <figcaption>
                {words.vanillaLabel}{" "}
                <Copy text={words.vanillaSnippet} words={words} />
              </figcaption>
              <pre>
                <code>{words.vanillaSnippet}</code>
              </pre>
            </figure>
          </div>
          <p className="note">
            {words.note[0]} <code>data-inkpond-avoid</code> {words.note[1]}
          </p>
        </section>
        <section className="stats">
          <p className="kicker">{words.kickers.perf}</p>
          <dl>
            {words.stats.map(([value, label]) => (
              <div key={label}>
                <dt>{value}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
          <p className="note">{words.perfNote}</p>
        </section>
      </main>
      <footer className="credits">
        <p>
          {words.credits[0]} <a href={INSPIRATION}>stackedlol/ascii-sharks</a>{" "}
          {words.credits[1]}
        </p>
        <p>
          {words.licence} · v{VERSION} ·{" "}
          <time dateTime={UPDATED}>{UPDATED}</time> · <a href={REPO}>GitHub</a>{" "}
          · <a href={`${root}session/`}>{words.nav.session}</a> ·{" "}
          <a href="./faq/">{words.faq}</a> ·{" "}
          <a href={`${root}llms.txt`}>llms.txt</a>
        </p>
      </footer>
    </>
  );
};
