import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { ChatMessage } from "../../lib/agentSession";
import { Button } from "../ui/Button";

function PolicySources({ message }: { message: ChatMessage }) {
  const answer = message.policyAnswer;
  if (!answer?.answered) return null;

  if (answer.sources.length === 0) {
    // The answer rested on the selected fare card rather than a scraped page,
    // so say which one instead of implying a Vietnam Airlines citation.
    if (!answer.appliedFareBrandId) return null;
    return (
      <div className="agent-chat-sources agent-chat-sources-fare">
        <p className="agent-chat-sources-label">
          From your selected fare — illustrative prototype data
        </p>
      </div>
    );
  }

  return (
    <div className="agent-chat-sources">
      <p className="agent-chat-sources-label">
        Grounded in Vietnam Airlines policy pages
      </p>
      <ul>
        {answer.sources.map((source) => (
          <li key={`${source.url}-${source.title}`}>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.breadcrumb.length > 0
                ? `${source.breadcrumb.join(" › ")} › ${source.title}`
                : source.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgentChat({
  messages,
  busy,
  draft,
  policySuggestions,
  onDraftChange,
  onSend,
  onAskPolicy,
  onReset,
}: {
  messages: ChatMessage[];
  busy: boolean;
  draft: string;
  policySuggestions: string[];
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onAskPolicy: (question: string) => void;
  onReset: () => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  return (
    <div className="agent-chat">
      <header className="agent-chat-head">
        <div>
          <p className="agent-chat-eyebrow">Veya agent</p>
          <h2 className="agent-chat-title">Chat with Veya</h2>
        </div>
        <button
          type="button"
          className="agent-chat-reset"
          disabled={busy}
          onClick={onReset}
        >
          Start over
        </button>
      </header>

      <div className="agent-chat-thread veya-scroll" role="log" aria-live="polite">
        {messages.map((message) => (
          <div
            key={message.id}
            className={clsx(
              "agent-chat-msg",
              message.role === "user" && "agent-chat-msg-user",
            )}
          >
            {message.role === "agent" ? (
              <span className="agent-chat-avatar" aria-hidden>
                V
              </span>
            ) : null}
            <div className="agent-chat-col">
              <div
                className={clsx(
                  "agent-chat-bubble",
                  message.tone === "error" && "agent-chat-bubble-error",
                )}
              >
                <p>{message.text}</p>
              </div>
              <PolicySources message={message} />
            </div>
          </div>
        ))}

        {busy ? (
          <div className="agent-chat-msg">
            <span className="agent-chat-avatar" aria-hidden>
              V
            </span>
            <div className="agent-chat-bubble">
              <p className="agent-chat-typing">Updating your trip…</p>
            </div>
          </div>
        ) : null}
        <div ref={bottomRef} />
      </div>

      {policySuggestions.length > 0 ? (
        <div className="agent-chat-policies">
          <span className="agent-chat-starters-label">Ask about your ticket</span>
          {policySuggestions.map((question) => (
            <button
              key={question}
              type="button"
              className="agent-chat-starter"
              disabled={busy}
              onClick={() => onAskPolicy(question)}
            >
              {question}
            </button>
          ))}
        </div>
      ) : null}

      <form
        className="agent-chat-compose"
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <textarea
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
          placeholder="Melbourne, visit family in Cà Mau, 12/04/2027 to 26/04/2027, 2 adults…"
          rows={2}
          disabled={busy}
          aria-label="Message Veya"
        />
        <Button type="submit" disabled={!draft.trim() || busy}>
          Send
        </Button>
      </form>
    </div>
  );
}
