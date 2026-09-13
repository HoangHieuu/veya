import { useCallback, useEffect, useMemo, useState } from "react";
import type { OriginCity, RankedCard, TravelStyle } from "@shared/types";
import { ApiClientError, recommend } from "../api/client";
import { AgentChat } from "../components/agent/AgentChat";
import { AgentWorkspaceShell } from "../components/agent/AgentWorkspaceShell";
import { DiscoveryCanvas } from "../components/agent/DiscoveryCanvas";
import { TripPanel } from "../components/agent/TripPanel";
import { buildAgentCanvasState } from "../lib/agentCanvas";
import { type DestinationHint, type TripDraft } from "../lib/agentFlow";
import {
  agentReplyForInput,
  classifyAgentInput,
  friendlyApiError,
  buildRecommendBrief,
  hasEnoughForRecommend,
  mergeTextIntoTrip,
  whatToAsk,
} from "../lib/agentInput";
import type { AgentWidget } from "../lib/agentFlow";
import type { AgentCanvasState, ChatMessage, LocalityResolution } from "../lib/agentTypes";
import { tripFromPersona } from "../lib/agentPersona";
import { getPersonaTripSeed, type MemberDemoProfile } from "../lib/memberDemo";
import { useAgentRecovery } from "../lib/useAgentRecovery";
import {
  deriveStage,
  emptyTripSummary,
  hasEnoughForBooking,
  type BentoDestination,
  type PolicyOverlayId,
  suggestionToTrip,
  tripToBrief,
  type TripSummary,
} from "../lib/agentWorkspace";

function msgId(): string {
  return `m-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function agentMsg(text: string, widget?: AgentWidget): ChatMessage {
  return { id: msgId(), role: "agent", text, ts: Date.now(), widget };
}

function userMsg(text: string): ChatMessage {
  return { id: msgId(), role: "user", text, ts: Date.now() };
}

const OPENING = agentMsg(
  "Hi — where are you flying from in Australia? Use the globe below, then explore destinations in the centre →",
  { type: "pick_origin" },
);

function originLabel(origin: OriginCity): string {
  return origin === "MEL" ? "Melbourne" : origin === "PER" ? "Perth" : "Sydney";
}

function localityFromTrip(trip: TripSummary): LocalityResolution | undefined {
  if (!trip.destinationTitle || !trip.gateway) return undefined;
  return {
    localityId: trip.destinationLocalityId ?? trip.destinationTitle.toLowerCase().replace(/\s+/g, "-"),
    localityTitle: trip.destinationTitle,
    gateway: trip.gateway,
    ruledOut: [],
    onwardNote:
      trip.destinationLocalityId === "ca-mau"
        ? "Plan ~3 hours by road from Tan Son Nhat (SGN) to reach Cà Mau — or a domestic connection."
        : undefined,
  };
}

function draftFromSummary(trip: TripSummary): TripDraft {
  return {
    origin: trip.origin,
    travelStyle: trip.travelStyle,
    destinationHint: trip.destinationHint,
    localityNote: trip.localityNote,
    travellers: trip.travellers,
    monthHint: trip.monthHint,
  };
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
  onHandoff: (card: RankedCard, canvas: AgentCanvasState) => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    seedFromProfile
      ? [agentMsg(getPersonaTripSeed(initialProfile).openingText)]
      : [OPENING],
  );
  const [draft, setDraft] = useState("");
  const [trip, setTrip] = useState<TripSummary>(() =>
    seedFromProfile ? tripFromPersona(initialProfile) : emptyTripSummary("guest"),
  );
  const [status, setStatus] = useState<"idle" | "typing" | "ready" | "error">("idle");
  const [rawResponse, setRawResponse] = useState<Awaited<ReturnType<typeof recommend>>>();
  const [lastBrief, setLastBrief] = useState("");
  const memberProfile = trip.memberProfile;
  const [policyOverlay, setPolicyOverlay] = useState<PolicyOverlayId | null>(null);
  const [previewDestination, setPreviewDestination] = useState<BentoDestination | null>(null);
  const [showOfferView, setShowOfferView] = useState(false);

  const tripDraft = useMemo(() => draftFromSummary(trip), [trip]);

  const canvas = useMemo(() => {
    if (!rawResponse || !lastBrief) return undefined;
    return buildAgentCanvasState(rawResponse, lastBrief, memberProfile);
  }, [rawResponse, lastBrief, memberProfile]);

  const bookingReady = Boolean(canvas);
  const stage = deriveStage(trip, bookingReady);
  const locality = localityFromTrip(trip);

  const loadCanvas = useCallback(
    async (brief: string) => {
      setStatus("typing");
      setLastBrief(brief);
      try {
        const response = await recommend({
          mode: "brief",
          briefText: brief,
          originCity: trip.origin ?? "SYD",
        });
        setRawResponse(response);
        setMessages((m) => [
          ...m,
          agentMsg(
            "Your trip summary is ready — review the map, season, and hotels in the centre, then continue to your offer when ready.",
          ),
        ]);
        setStatus("ready");
      } catch (err) {
        const raw = err instanceof ApiClientError ? err.message : "Something went wrong.";
        setRawResponse(undefined);
        setLastBrief("");
        setStatus("idle");
        setMessages((m) => [...m, agentMsg(friendlyApiError(raw))]);
      }
    },
    [trip.origin],
  );

  useEffect(() => {
    if (!hasEnoughForBooking(trip) || canvas || status === "typing") return;
    if (stage === "hotels" && !trip.hotelInterest) return;
    void loadCanvas(tripToBrief(trip));
  }, [trip, canvas, status, stage, loadCanvas]);

  const applyDraft = useCallback((nextDraft: TripDraft) => {
    setTrip((t) => ({ ...t, ...nextDraft }));
  }, []);

  const confirmOrigin = useCallback(
    (origin: OriginCity) => {
      const label = originLabel(origin);
      const next = { ...trip, origin };
      setTrip(next);
      setMessages((m) => [
        ...m,
        userMsg(label),
        agentMsg(
          `Great — ${label}. What kind of trip — beach, family, food? Or pick a destination in the centre.`,
          { type: "pick_vibe" },
        ),
      ]);
    },
    [trip],
  );

  const submitBrief = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setMessages((m) => [...m, userMsg(trimmed)]);
      setDraft("");

      const inputKind = classifyAgentInput(trimmed);
      if (inputKind === "greeting") {
        setMessages((m) => [...m, agentMsg(agentReplyForInput("greeting"))]);
        return;
      }

      const nextTrip = mergeTextIntoTrip(trimmed, trip);
      setTrip(nextTrip);
      const merged = draftFromSummary(nextTrip);

      if (inputKind === "too_short") {
        if (hasEnoughForRecommend(merged, trimmed, nextTrip) || hasEnoughForBooking(nextTrip)) {
          const brief = buildRecommendBrief(trimmed, nextTrip);
          setMessages((m) => [...m, agentMsg("Got it — building your route…")]);
          await loadCanvas(brief);
          return;
        }
        const { reply, widget } = whatToAsk(merged, trimmed);
        setMessages((m) => [...m, agentMsg(reply, widget)]);
        return;
      }

      if (hasEnoughForRecommend(merged, trimmed, nextTrip) || hasEnoughForBooking(nextTrip)) {
        const brief = buildRecommendBrief(trimmed, nextTrip);
        setMessages((m) => [...m, agentMsg("Got it — building your route…")]);
        await loadCanvas(brief);
        return;
      }

      const { reply, widget } = whatToAsk(merged, trimmed);
      setMessages((m) => [...m, agentMsg(reply, widget)]);
    },
    [trip, loadCanvas],
  );

  const pickOrigin = useCallback(
    (origin: OriginCity) => {
      confirmOrigin(origin);
    },
    [confirmOrigin],
  );

  const pickVibe = useCallback(
    (travelStyle: TravelStyle) => {
      const label =
        travelStyle === "vfr"
          ? "Visit family"
          : travelStyle === "beach_relaxation"
            ? "Beach & relax"
            : travelStyle === "food_culture"
              ? "Food & culture"
              : "Not sure yet";
      applyDraft({ ...tripDraft, travelStyle });
      const followUp =
        travelStyle === "beach_relaxation"
          ? "Beach trip — pick a coast destination in the centre, or tell me when and how many adults."
          : travelStyle === "vfr"
            ? "Visiting family — pick a region in the centre or name the province."
            : "Pick a destination in the centre, or tell me when and how many adults.";
      setMessages((m) => [...m, userMsg(label), agentMsg(followUp)]);
    },
    [tripDraft, applyDraft],
  );

  const pickDestination = useCallback(
    (hint: DestinationHint) => {
      const opt = {
        compare_gateways: "Compare Hanoi, Saigon, Da Nang",
        family_south: "Family in the south (Cà Mau area)",
        beach_central: "Beach & central coast",
        food_city: "City & street food",
      }[hint];
      applyDraft({ ...tripDraft, destinationHint: hint });
      setMessages((m) => [...m, userMsg(opt), agentMsg("When roughly, and how many adults?")]);
    },
    [tripDraft, applyDraft],
  );

  const pickTravellers = useCallback(
    (n: number) => {
      applyDraft({ ...tripDraft, travellers: n });
      setMessages((m) => [...m, userMsg(`${n} adult${n > 1 ? "s" : ""}`), agentMsg("When are you thinking of going?")]);
    },
    [tripDraft, applyDraft],
  );

  const handlePreviewDestination = useCallback((suggestion: BentoDestination) => {
    setPreviewDestination(suggestion);
  }, []);

  const handleConfirmDestination = useCallback(
    (suggestion: BentoDestination) => {
      const next = suggestionToTrip(suggestion, trip);
      setPreviewDestination(null);
      setShowOfferView(false);
      setTrip(next);
      setMessages((m) => [
        ...m,
        userMsg(suggestion.title),
        agentMsg(
          `${suggestion.title} — fly into ${suggestion.gateway}. How many adults, and when roughly?`,
          !next.travellers ? { type: "pick_travellers" } : undefined,
        ),
      ]);
    },
    [trip],
  );

  const handleSkipHotels = useCallback(() => {
    setTrip((t) => ({ ...t, hotelInterest: false }));
    if (hasEnoughForBooking(trip)) {
      void loadCanvas(tripToBrief(trip));
    }
  }, [trip, loadCanvas]);

  const selectedCard =
    canvas?.response.cards.find((c) => c.rank === 1) ?? canvas?.response.cards[0];

  const recovery = useAgentRecovery({
    enabled: Boolean(bookingReady && canvas && selectedCard),
    response: canvas?.response,
    selectedCard,
    onResume: () => {
      setMessages((m) => [
        ...m,
        agentMsg("Welcome back — your route sketch is still in the centre panel."),
      ]);
    },
  });

  const handleRestoreTrip = useCallback((restored: TripSummary) => {
    setPreviewDestination(null);
    setShowOfferView(false);
    setRawResponse(undefined);
    setLastBrief("");
    setStatus("idle");
    setTrip(restored);
    const label = restored.destinationTitle ?? restored.origin ?? "your trip";
    setMessages((m) => [
      ...m,
      agentMsg(`Welcome back — I've loaded your saved trip (${label}). Continue in the centre or chat.`),
    ]);
  }, []);

  return (
    <>
    <AgentWorkspaceShell
      onHome={onHome}
      chat={
        <AgentChat
          messages={messages}
          status={status}
          draft={draft}
          tripDraft={tripDraft}
          onDraftChange={setDraft}
          onSend={() => void submitBrief(draft)}
          onPickOrigin={pickOrigin}
          onPickVibe={pickVibe}
          onPickDestination={pickDestination}
          onPickTravellers={pickTravellers}
          bookingReady={bookingReady}
          onOpenPolicy={setPolicyOverlay}
        />
      }
      discovery={
        <DiscoveryCanvas
          trip={trip}
          bookingReady={bookingReady}
          showOfferView={showOfferView}
          onContinueToOffer={() => setShowOfferView(true)}
          onBackToTripSummary={() => setShowOfferView(false)}
          canvas={canvas}
          memberProfile={memberProfile}
          locality={locality}
          policyOverlay={policyOverlay}
          previewDestination={previewDestination}
          onPreviewDestination={handlePreviewDestination}
          onConfirmDestination={handleConfirmDestination}
          onClearPreview={() => setPreviewDestination(null)}
          onSkipHotels={handleSkipHotels}
          onClosePolicy={() => setPolicyOverlay(null)}
          onOpenPolicy={() => setPolicyOverlay("direct-decision-offer")}
          onHandoff={() => {
            const card = canvas?.response.cards[0];
            if (card && canvas) {
              onHandoff(card, canvas);
              setMessages((m) => [
                ...m,
                agentMsg(
                  "Opened Vietnam Airlines in a new tab — finish booking there. Your trip and offer stay here if you switch back.",
                ),
              ]);
            }
          }}
        />
      }
      tripPanel={
        <TripPanel
          trip={trip}
          canvas={canvas}
          onRestoreTrip={handleRestoreTrip}
          onTripSaved={() => {
            if (bookingReady && canvas && selectedCard) {
              void recovery.openRecovery("manual_save");
            }
          }}
        />
      }
    />
    {recovery.ui}
    </>
  );
}
