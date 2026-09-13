import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AgentInputEvent,
  AgentTurnResponse,
  DestinationSuggestion,
  FareOption,
  RankedCard,
  TripSummary,
} from "@shared/types";
import { ApiClientError } from "../api/client";
import { agentTurn } from "../api/agentClient";
import { AgentChat } from "../components/agent/AgentChat";
import { AgentWorkspaceShell } from "../components/agent/AgentWorkspaceShell";
import { CanvasRenderer } from "../components/agent/CanvasRenderer";
import { TripPanel } from "../components/agent/TripPanel";
import {
  agentMessage,
  initialSessionState,
  reduceTurn,
  userMessage,
  type AgentSessionState,
} from "../lib/agentSession";
import { getPersonaTripSeed, type MemberDemoProfile } from "../lib/memberDemo";
import { useAgentRecovery } from "../lib/useAgentRecovery";

const OPENING =
  "Hi — I'm Veya. Tell me about your Vietnam trip: where you're flying from, roughly when, and what you're going for. I'll build it in the centre as we talk.";

function friendlyError(error: unknown): string {
  if (error instanceof ApiClientError) {
    if (error.errorCode === "AGENT_SESSION_NOT_FOUND") {
      return "That session expired. Tell me your trip again and I'll rebuild it.";
    }
    if (error.errorCode === "INTENT_INCOMPLETE") {
      return "I still need a few details before I can price this. What's missing?";
    }
    if (error.errorCode === "LLM_ERROR") {
      return "My language model is unavailable right now, so I'm reading your message with the built-in parser. Try naming the city, dates and number of adults directly.";
    }
    return error.message;
  }
  return "I couldn't reach the Veya API. Check that it's running on port 3001.";
}

export function AgentScreen({
  initialProfile = "guest",
  seedFromProfile = false,
  onHome,
  onHandoff,
}: {
  initialProfile?: MemberDemoProfile;
  seedFromProfile?: boolean;
  onHome: () => void;
  onHandoff: (card: RankedCard, response: AgentTurnResponse) => void;
}) {
  const [session, setSession] = useState<AgentSessionState>(() =>
    initialSessionState(
      initialProfile,
      seedFromProfile ? getPersonaTripSeed(initialProfile).openingText : OPENING,
    ),
  );
  const [draft, setDraft] = useState("");
  const [lastTurn, setLastTurn] = useState<AgentTurnResponse>();

  // The request payload is read from a ref rather than inside a state updater,
  // so it stays correct under StrictMode's double-invoked updaters. Only one
  // turn is ever in flight (`busy` gates every entry point), so the ref cannot
  // lag behind a concurrent send.
  const sessionRef = useRef(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const busy = session.status === "thinking";

  /**
   * Every interaction — typed or clicked — goes through one server turn, so the
   * chat transcript and the centre panel can never drift apart.
   */
  const runTurn = useCallback(
    async (
      input: { message: string } | { event: AgentInputEvent },
      echo?: string,
    ) => {
      const current = sessionRef.current;
      const request = {
        ...(current.sessionId ? { sessionId: current.sessionId } : {}),
        trip: current.trip,
        ...input,
      };

      setSession((state) => ({
        ...state,
        status: "thinking",
        messages: echo ? [...state.messages, userMessage(echo)] : state.messages,
      }));

      try {
        const response = await agentTurn(request);
        setLastTurn(response);
        setSession((state) => reduceTurn(state, response));
      } catch (error) {
        const text = friendlyError(error);
        setSession((state) => ({
          ...state,
          status: "idle",
          messages: [...state.messages, agentMessage(text, { tone: "error" })],
        }));
      }
    },
    [],
  );

  // First paint: ask the server for the centre panel so the workspace opens on
  // destination inspiration rather than an empty box. When a demo persona was
  // chosen, send their brief instead — the same turn that builds the canvas.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (seedFromProfile) {
      const brief = getPersonaTripSeed(initialProfile).briefText;
      // Echoed so the transcript reads as the persona having said it, rather
      // than the agent asserting details out of nowhere.
      void runTurn({ message: brief }, brief);
    } else {
      void runTurn({ event: { type: "open_workspace" } });
    }
  }, [seedFromProfile, initialProfile, runTurn]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (!text || busy) return;
    setDraft("");
    void runTurn({ message: text }, text);
  }, [draft, busy, runTurn]);

  const sendEvent = useCallback(
    (event: AgentInputEvent, echo?: string) => {
      if (busy) return;
      void runTurn({ event }, echo);
    },
    [busy, runTurn],
  );

  const askPolicy = useCallback(
    (question: string) => {
      if (busy) return;
      void runTurn({ message: question }, question);
    },
    [busy, runTurn],
  );

  const selectDestination = useCallback(
    (suggestion: DestinationSuggestion) => {
      sendEvent(
        {
          type: "select_destination",
          destinationLocalityId: suggestion.localityId,
          destinationTitle: suggestion.title,
        },
        suggestion.title,
      );
    },
    [sendEvent],
  );

  const selectFare = useCallback(
    (option: FareOption) => {
      sendEvent(
        { type: "select_fare", fareBrandId: option.brandId },
        `${option.brandLabel} please`,
      );
    },
    [sendEvent],
  );

  const bookingCard = useMemo(() => {
    if (session.centerContent.kind !== "booking") return undefined;
    return session.centerContent.recommendation.cards[0];
  }, [session.centerContent]);

  const bookingResponse =
    session.centerContent.kind === "booking"
      ? session.centerContent.recommendation
      : undefined;

  /**
   * Restoring a saved trip replays it through the server so the centre panel is
   * rebuilt from the same code path as a live conversation — no second way to
   * derive the canvas.
   */
  const restoreTrip = useCallback(
    (restored: TripSummary) => {
      setSession((state) => ({
        ...state,
        trip: restored,
        messages: [
          ...state.messages,
          agentMessage(
            `Welcome back — I've reloaded ${restored.destinationTitle ?? "your saved trip"}. Picking up where you left off.`,
          ),
        ],
      }));
      sessionRef.current = { ...sessionRef.current, trip: restored };
      void runTurn({ event: { type: "open_workspace" } });
    },
    [runTurn],
  );

  const recovery = useAgentRecovery({
    enabled: Boolean(bookingResponse && bookingCard),
    response: bookingResponse,
    selectedCard: bookingCard,
    onResume: () => {
      setSession((state) => ({
        ...state,
        messages: [
          ...state.messages,
          agentMessage("Welcome back — your fare and route are still in the centre panel."),
        ],
      }));
    },
  });

  const policySuggestions = useMemo(() => {
    if (session.centerContent.kind !== "booking") return [];
    const fare = session.centerContent.selectedFare?.fare;
    if (fare) {
      return [
        `What checked baggage does my ${fare.brandLabel} ticket include?`,
        `Can I change my ${fare.brandLabel} ticket?`,
        "Is this fare refundable?",
      ];
    }
    return [
      "How much checked baggage do I get?",
      "What can't I put in carry-on?",
      "What are the refund rules?",
    ];
  }, [session.centerContent]);

  return (
    <>
    <AgentWorkspaceShell
      onHome={onHome}
      chat={
        <AgentChat
          messages={session.messages}
          busy={busy}
          draft={draft}
          policySuggestions={policySuggestions}
          onDraftChange={setDraft}
          onSend={send}
          onAskPolicy={askPolicy}
          onReset={() => sendEvent({ type: "reset_journey" }, "Start over")}
        />
      }
      discovery={
        <CanvasRenderer
          content={session.centerContent}
          trip={session.trip}
          memberProfile={session.trip.memberProfile}
          busy={busy}
          onSelectDestination={selectDestination}
          onSelectFare={selectFare}
          onContinueBooking={() =>
            sendEvent({ type: "continue_booking" }, "Show me fares")
          }
          onAskPolicy={askPolicy}
          onHandoff={() => {
            if (bookingCard && lastTurn) onHandoff(bookingCard, lastTurn);
          }}
        />
      }
      tripPanel={
        <TripPanel
          trip={session.trip}
          stage={session.stage}
          centerContent={session.centerContent}
          meta={session.lastMeta}
          onRestoreTrip={restoreTrip}
          onTripSaved={() => {
            if (bookingResponse && bookingCard) void recovery.openRecovery("manual_save");
          }}
        />
      }
    />
    {recovery.ui}
    </>
  );
}
