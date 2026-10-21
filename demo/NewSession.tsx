import {
  type FormEvent,
  type KeyboardEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { InkPond as Pond } from "../src/controller";

const greeting = (hour: number) =>
  hour < 6
    ? "夜深了"
    : hour < 11
      ? "早上好"
      : hour < 14
        ? "中午好"
        : hour < 18
          ? "下午好"
          : "晚上好";

/** Typing stirs the water no more often than this. */
const TYPE_RIPPLE_MS = 70;

type Box = DOMRect;
/** A point just outside the box, `t` (0–1) of the way round its outline. */
const aroundBox = (box: Box, t: number, gap: number) => {
  const w = box.width + gap * 2;
  const h = box.height + gap * 2;
  let d = (t % 1) * 2 * (w + h);
  const x0 = box.left - gap;
  const y0 = box.top - gap;
  if (d < w) return { x: x0 + d, y: y0 };
  d -= w;
  if (d < h) return { x: x0 + w, y: y0 + d };
  d -= h;
  if (d < w) return { x: x0 + w - d, y: y0 + h };
  return { x: x0, y: y0 + h - (d - w) };
};
/** Three sources along the box's midline: their rings merge into a pill. */
const ringFrom = (pond: Pond, box: Box, strength: number) => {
  const y = box.top + box.height / 2;
  for (const f of [0.2, 0.5, 0.8]) {
    pond.ripple(box.left + box.width * f, y, strength);
  }
};

/**
 * The new-session surface: a greeting over the composer. Both blocks are
 * marked data-inkpond-avoid so the ink keeps clear of them.
 *
 * The composer talks to the pond: each keystroke sends a ripple out from
 * its outline, focus rings the water once, and the first send drops ink
 * around it while the greeting dissolves and the pond fades.
 */
export const NewSession = ({
  leaving,
  onSend,
  pondRef,
}: {
  leaving: boolean;
  onSend: (text: string) => void;
  pondRef: { current: Pond | null };
}) => {
  const [draft, setDraft] = useState("");
  const boxRef = useRef<HTMLDivElement>(null);
  const lastRipple = useRef(0);

  const withPond = (act: (pond: Pond, box: Box) => void) => {
    const pond = pondRef.current;
    const box = boxRef.current?.getBoundingClientRect();
    if (pond && box) act(pond, box);
  };

  const onDraftChange = (value: string) => {
    setDraft(value);
    const now = performance.now();
    if (now - lastRipple.current < TYPE_RIPPLE_MS) return;
    lastRipple.current = now;
    withPond((pond, box) => {
      const { x, y } = aroundBox(box, Math.random(), 40);
      pond.ripple(x, y, 0.7);
    });
  };

  const send = (text: string) => {
    if (leaving) return;
    withPond((pond, box) => {
      ringFrom(pond, box, 1);
      // Ink lands beside the composer, never on it.
      const spots = [0.06, 0.31, 0.56, 0.81].map((t) =>
        aroundBox(box, t + Math.random() * 0.08, 36),
      );
      spots.forEach(({ x, y }, k) => {
        window.setTimeout(() => pond.drop(x, y), k * 110);
      });
    });
    onSend(text);
    setDraft("");
  };

  return (
    <section
      aria-labelledby="new-session-title"
      className={leaving ? "new-session leaving" : "new-session"}
    >
      <div className="hero" data-inkpond-avoid="">
        <h1 id="new-session-title">
          {greeting(new Date().getHours())}，今天想做点什么？
        </h1>
      </div>
      <div className="composer-slot" ref={boxRef}>
        <Composer
          draft={draft}
          onDraftChange={onDraftChange}
          onFocus={() => withPond((pond, box) => ringFrom(pond, box, 0.6))}
          onSend={send}
          placeholder="描述你要完成的事…"
        />
      </div>
    </section>
  );
};

export const Composer = ({
  draft,
  onDraftChange,
  onFocus,
  onSend,
  placeholder,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onFocus?: () => void;
  onSend: (text: string) => void;
  placeholder: string;
}) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = draft.trim();

  // Grow with the draft up to eight lines, then scroll inside: CSS
  // field-sizing where the browser has it, a measured height otherwise.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the draft is the trigger
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || CSS.supports?.("field-sizing", "content")) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 8 * 24)}px`;
  }, [draft]);

  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    if (text) onSend(text);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="composer" data-inkpond-avoid="" onSubmit={submit}>
      <label className="sr-only" htmlFor="composer-input">
        消息
      </label>
      <textarea
        id="composer-input"
        onChange={(event) => onDraftChange(event.target.value)}
        onFocus={onFocus}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        ref={ref}
        rows={1}
        value={draft}
      />
      <div className="composer-row">
        <button
          aria-label="发送"
          className="send"
          disabled={!text}
          type="submit"
        >
          ↑
        </button>
      </div>
    </form>
  );
};
