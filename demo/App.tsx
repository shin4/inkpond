import { useEffect, useRef, useState } from "react";
import type { InkPond as Pond } from "../src/controller";
import { InkPond } from "../src/react";
import type { SceneName } from "../src/scenes";
import { JIEQI, type JieqiTerm } from "../src/scenes/jieqi/calendar";
import { Conversation, type Message } from "./Conversation";
import { NewSession } from "./NewSession";

type Theme = "system" | "light" | "dark";

const SCENE_LABELS: Record<SceneName, string> = {
  lotus: "荷塘",
  qingming: "清明上河",
  shanshui: "山水",
  jieqi: "二十四节气",
};
/** 节气: today's term, or one picked to look at. */
type TermChoice = "today" | JieqiTerm;

/** A remembered choice, or the fallback when there is none (or no storage). */
const recall = <T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
) => {
  try {
    const saved = localStorage.getItem(key);
    return allowed.find((value) => value === saved) ?? fallback;
  } catch {
    return fallback;
  }
};
const remember = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private mode: the choice just is not remembered.
  }
};

const REPLIES = [
  "好的，我先把要点理一理，再给你一个初稿。",
  "收到。我会分三步来做：先看材料，再列提纲，最后成文。",
  "明白了，稍等，我整理好就发给你。",
];

/** How long the pond takes to bow out after the first send. */
const LEAVE_MS = 1200;
const prefersReducedMotion = () =>
  typeof matchMedia === "function" &&
  matchMedia("(prefers-reduced-motion: reduce)").matches;

export const App = () => {
  const [theme, setTheme] = useState<Theme>(() =>
    recall("inkpond-demo.theme", ["light", "dark"], "system"),
  );
  const [scene, setScene] = useState<SceneName>(() =>
    recall("inkpond-demo.scene", ["lotus", "qingming", "jieqi"], "shanshui"),
  );
  const [term, setTerm] = useState<TermChoice>("today");
  const [tint, setTint] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [strength, setStrength] = useState(0.45);
  const [waveSpeed, setWaveSpeed] = useState(1);
  const [cellSize, setCellSize] = useState(16);
  const [leaving, setLeaving] = useState(false);
  /** Hide the greeting and composer to see the whole picture. */
  const [showInput, setShowInput] = useState(true);
  const pondRef = useRef<Pond | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
    remember("inkpond-demo.theme", theme);
  }, [theme]);
  useEffect(() => remember("inkpond-demo.scene", scene), [scene]);

  const append = (text: string) => {
    setMessages((list) => [
      ...list,
      { id: crypto.randomUUID(), role: "user", text },
      {
        id: crypto.randomUUID(),
        role: "assistant",
        text: REPLIES[(list.length / 2) % REPLIES.length] ?? "",
      },
    ]);
  };

  // The first send lets the ink bloom and the pond fade before the
  // conversation takes over; later sends land at once.
  const send = (text: string) => {
    if (messages.length > 0 || prefersReducedMotion()) {
      append(text);
      return;
    }
    setLeaving(true);
    window.setTimeout(() => {
      append(text);
      setLeaving(false);
    }, LEAVE_MS);
  };

  const empty = messages.length === 0;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">
          <span className="brand-seal" aria-hidden="true">
            墨
          </span>
          墨池 Inkpond
        </span>
        <div className="topbar-actions">
          {!empty ? (
            <button
              className="ghost"
              onClick={() => setMessages([])}
              type="button"
            >
              新会话
            </button>
          ) : (
            <button
              aria-pressed={!showInput}
              className="ghost"
              onClick={() => setShowInput((shown) => !shown)}
              type="button"
            >
              {showInput ? "隐藏输入" : "显示输入"}
            </button>
          )}
          <label className="select">
            <span className="sr-only">画面</span>
            <select
              onChange={(event) => setScene(event.target.value as SceneName)}
              value={scene}
            >
              {Object.entries(SCENE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          {scene === "jieqi" ? (
            <label className="select">
              <span className="sr-only">节气</span>
              <select
                onChange={(event) => setTerm(event.target.value as TermChoice)}
                value={term}
              >
                <option value="today">今日节气</option>
                {JIEQI.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="select">
            <span className="sr-only">主题</span>
            <select
              onChange={(event) => setTheme(event.target.value as Theme)}
              value={theme}
            >
              <option value="system">跟随系统</option>
              <option value="light">亮色</option>
              <option value="dark">暗色</option>
            </select>
          </label>
        </div>
      </header>

      <main className={leaving ? "stage leaving" : "stage"}>
        {/* The pond only lies under an empty session, as a new-session ground. */}
        {empty ? (
          <InkPond
            avoidFade={72}
            cellSize={cellSize}
            key={`${scene}-${term}-${tint}-${strength}-${waveSpeed}-${cellSize}`}
            pondRef={pondRef}
            scene={scene}
            term={scene === "jieqi" && term !== "today" ? term : undefined}
            strength={strength}
            tint={tint}
            waveSpeed={waveSpeed}
          />
        ) : null}
        <div className="stage-scroll">
          {empty ? (
            showInput ? (
              <NewSession leaving={leaving} onSend={send} pondRef={pondRef} />
            ) : null
          ) : (
            <Conversation messages={messages} onSend={send} />
          )}
        </div>
      </main>

      {empty && !leaving ? (
        <details className="tuner">
          <summary>调节</summary>
          <label>
            墨色浓淡 <output>{Math.round(strength * 100)}%</output>
            <input
              max={1.2}
              min={0.2}
              onChange={(event) => setStrength(Number(event.target.value))}
              step={0.05}
              type="range"
              value={strength}
            />
          </label>
          <label>
            字号 <output>{cellSize}px</output>
            <input
              max={40}
              min={12}
              onChange={(event) => setCellSize(Number(event.target.value))}
              step={2}
              type="range"
              value={cellSize}
            />
          </label>
          <label>
            波速 <output>{waveSpeed.toFixed(1)}×</output>
            <input
              max={2}
              min={0.6}
              onChange={(event) => setWaveSpeed(Number(event.target.value))}
              step={0.1}
              type="range"
              value={waveSpeed}
            />
          </label>
          <label className="check">
            <input
              checked={tint}
              onChange={(event) => setTint(event.target.checked)}
              type="checkbox"
            />
            淡彩
          </label>
          <p>划过空白处起水波，点击空白处落墨。</p>
        </details>
      ) : null}
    </div>
  );
};
