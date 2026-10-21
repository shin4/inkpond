import { useEffect, useRef, useState } from "react";
import { Composer } from "./NewSession";

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

/** After the first send: plain bubbles over a quiet ground, no pond. */
export const Conversation = ({
  messages,
  onSend,
}: {
  messages: Message[];
  onSend: (text: string) => void;
}) => {
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: follow each new message
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  return (
    <section aria-label="对话" className="conversation">
      <ol className="messages">
        {messages.map((message) => (
          <li className={`bubble bubble-${message.role}`} key={message.id}>
            {message.text}
          </li>
        ))}
      </ol>
      <div ref={endRef} />
      <Composer
        draft={draft}
        onDraftChange={setDraft}
        onSend={(text) => {
          onSend(text);
          setDraft("");
        }}
        placeholder="继续说…"
      />
    </section>
  );
};
