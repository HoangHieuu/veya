import { useCallback, useRef, useState } from "react";
import type {
  RankedCard,
  RankedResponse,
  RecoverySessionResponse,
  RecoveryTrigger,
} from "@shared/types";
import { createRecoverySession, updateRecoverySessionStatus } from "../api/client";
import { MockReminderInbox } from "../components/MockReminderInbox";
import { RecoveryToast } from "../components/RecoveryToast";
import { cityLabel } from "./labels";
import { buildFallbackNudge } from "./recoveryNudge";
import { stashLocalRecovery, useAbandonSignals } from "./recoverySignals";

export function useAgentRecovery(options: {
  enabled: boolean;
  response?: RankedResponse;
  selectedCard?: RankedCard;
  onResume: () => void;
}) {
  const { enabled, response, selectedCard, onResume } = options;
  const [recoverySession, setRecoverySession] = useState<RecoverySessionResponse | null>(null);
  const [showRecoveryToast, setShowRecoveryToast] = useState(false);
  const [showInbox, setShowInbox] = useState(false);
  const openingRecovery = useRef(false);

  const recoveryArmed =
    enabled && Boolean(response && selectedCard) && !showRecoveryToast && !showInbox;

  const openRecovery = useCallback(
    async (trigger: RecoveryTrigger) => {
      if (!response || !selectedCard) return;
      if (openingRecovery.current || showRecoveryToast || showInbox) return;
      openingRecovery.current = true;

      const card = selectedCard;
      const dest = cityLabel(card.route.destinationCity);
      const optimistic: RecoverySessionResponse = {
        sessionId: `rec-local-${Date.now()}`,
        status: "active",
        createdAt: new Date().toISOString(),
        nudge: buildFallbackNudge({
          itineraryLine: `${response.intent.originCity} → ${card.route.destinationCity} (${dest}) · ${response.intent.dateWindow.start}–${response.intent.dateWindow.end} · ${response.intent.travellers} adults`,
          whyGateway: card.score.reasons.slice(0, 2),
          loyaltyLine: card.route.lotusmilesIndicative
            ? `Illustrative Lotusmiles: ${card.route.lotusmilesIndicative.earnBand} earn band — confirm at checkout.`
            : "Illustrative bonus miles — confirm at checkout.",
        }),
        mockTimeline: [
          {
            atHours: 0,
            subject: "Your trip sketch is ready",
            body: `${response.intent.originCity} → ${dest}. Open Veya anytime to continue.`,
            ctaLabel: "Continue",
          },
          {
            atHours: 1,
            subject: `Still thinking about ${dest}?`,
            body: "Your route is saved. Come back when you’re ready to book on Vietnam Airlines.",
            ctaLabel: "Continue",
          },
          {
            atHours: 24,
            subject: "Book direct on Vietnam Airlines",
            body: "Miles and member offers are clearer on vietnamairlines.com — finish there when ready.",
            ctaLabel: "Continue",
          },
        ],
        resume: {
          requestId: response.requestId,
          routeId: card.routeId,
          intent: response.intent,
          screen: "results",
        },
        remindAfterHours: 24,
      };

      stashLocalRecovery(optimistic);
      setRecoverySession(optimistic);
      if (trigger !== "manual_save") {
        setShowRecoveryToast(true);
      }

      try {
        const session = await createRecoverySession({
          requestId: response.requestId,
          routeId: card.routeId,
          intent: response.intent,
          trigger,
          consentReminder: false,
          screen: "results",
          tripOutline: card.tripOutline,
          reasons: card.score.reasons,
        });
        setRecoverySession({
          ...session,
          mockTimeline: optimistic.mockTimeline,
        });
        stashLocalRecovery({ ...session, mockTimeline: optimistic.mockTimeline });
      } catch {
        /* keep optimistic */
      } finally {
        openingRecovery.current = false;
      }
    },
    [response, selectedCard, showRecoveryToast, showInbox],
  );

  useAbandonSignals({
    enabled: recoveryArmed,
    onAbandon: (trigger) => {
      void openRecovery(trigger);
    },
  });

  function dismissRecoveryToast() {
    if (recoverySession) {
      void updateRecoverySessionStatus(recoverySession.sessionId, "dismissed").catch(
        () => undefined,
      );
    }
    setShowRecoveryToast(false);
  }

  function handleResume() {
    if (recoverySession) {
      void updateRecoverySessionStatus(recoverySession.sessionId, "resumed").catch(
        () => undefined,
      );
    }
    setShowRecoveryToast(false);
    setShowInbox(false);
    onResume();
  }

  const ui = (
    <>
      {showRecoveryToast && recoverySession ? (
        <RecoveryToast
          session={recoverySession}
          onResume={handleResume}
          onOpenInbox={() => {
            setShowRecoveryToast(false);
            setShowInbox(true);
          }}
          onDismiss={dismissRecoveryToast}
        />
      ) : null}

      {showInbox && recoverySession ? (
        <MockReminderInbox
          session={recoverySession}
          onBackToTrip={handleResume}
          onClose={() => setShowInbox(false)}
        />
      ) : null}
    </>
  );

  return { ui, openRecovery };
}
