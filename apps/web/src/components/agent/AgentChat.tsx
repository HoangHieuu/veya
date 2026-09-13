import { useRef, useEffect } from "react";

import clsx from "clsx";

import type { OriginCity, TravelStyle } from "@shared/types";

import type { ChatMessage } from "../../lib/agentTypes";

import type { DestinationHint, TripDraft } from "../../lib/agentFlow";

import type { PolicyOverlayId } from "../../lib/agentWorkspace";

import { ChatWidget } from "./chat/ChatWidget";

import { Button } from "../ui/Button";



export function AgentChat({

  messages,

  status,

  draft,

  tripDraft,

  onDraftChange,

  onSend,

  onPickOrigin,

  onPickVibe,

  onPickDestination,

  onPickTravellers,

  bookingReady,

  onOpenPolicy,

}: {

  messages: ChatMessage[];

  status: "idle" | "typing" | "ready" | "error";

  draft: string;

  tripDraft: TripDraft;

  onDraftChange: (v: string) => void;

  onSend: () => void;

  onPickOrigin: (v: OriginCity) => void;

  onPickVibe: (v: TravelStyle) => void;

  onPickDestination: (v: DestinationHint) => void;

  onPickTravellers: (n: number) => void;

  bookingReady?: boolean;

  onOpenPolicy?: (id: PolicyOverlayId) => void;

}) {

  const bottomRef = useRef<HTMLDivElement>(null);

  const lastAgentWithWidget = [...messages].reverse().find((m) => m.role === "agent" && m.widget);



  useEffect(() => {

    bottomRef.current?.scrollIntoView({ behavior: "smooth" });

  }, [messages, status]);



  return (

    <div className="agent-chat">

      <header className="agent-chat-head">

        <p className="agent-chat-eyebrow">Veya agent</p>

        <h2 className="agent-chat-title">Chat with Veya</h2>
      </header>



      <div className="agent-chat-thread veya-scroll" role="log" aria-live="polite">

        {messages.map((m) => (

          <div

            key={m.id}

            className={clsx("agent-chat-msg", m.role === "user" && "agent-chat-msg-user")}

          >

            {m.role === "agent" ? (

              <span className="agent-chat-avatar" aria-hidden>

                V

              </span>

            ) : null}

            <div className="agent-chat-col">

              <div className="agent-chat-bubble">

                <p>{m.text}</p>

              </div>

              {m.widget && m.id === lastAgentWithWidget?.id && status !== "typing" ? (

                <ChatWidget

                  widget={m.widget}

                  draft={tripDraft}

                  disabled={false}

                  onPickOrigin={onPickOrigin}

                  onPickVibe={onPickVibe}

                  onPickDestination={onPickDestination}

                  onPickTravellers={onPickTravellers}

                />

              ) : null}

            </div>

          </div>

        ))}

        {status === "typing" ? (

          <div className="agent-chat-msg">

            <span className="agent-chat-avatar" aria-hidden>

              V

            </span>

            <div className="agent-chat-bubble">

              <p className="agent-chat-typing">Updating canvas…</p>

            </div>

          </div>

        ) : null}

        <div ref={bottomRef} />

      </div>



      {bookingReady && onOpenPolicy ? (
        <div className="agent-chat-policies">
          <span className="agent-chat-starters-label">Policies</span>
          <button
            type="button"
            className="agent-chat-starter"
            onClick={() => onOpenPolicy("direct-decision-offer")}
          >
            Offer terms
          </button>
          <button
            type="button"
            className="agent-chat-starter"
            onClick={() => onOpenPolicy("lotusmiles")}
          >
            Lotusmiles
          </button>
        </div>
      ) : null}

      <form

        className="agent-chat-compose"

        onSubmit={(e) => {

          e.preventDefault();

          onSend();

        }}

      >

        <textarea

          value={draft}

          onChange={(e) => onDraftChange(e.target.value)}

          placeholder="Where from, vibe, destination, dates, adults…"

          rows={2}

          disabled={status === "typing"}

          aria-label="Trip description"

        />

        <Button type="submit" disabled={!draft.trim() || status === "typing"}>

          Send

        </Button>

      </form>

    </div>

  );

}
