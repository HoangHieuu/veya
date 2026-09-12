import { useEffect, useState } from "react";
import type { PriorityPreset, RankedCard, RecommendRequest } from "@shared/types";
import { ApiClientError, recommend, saveTrip } from "./api/client";
import { Header, type AppStep } from "./components/layout/Header";
import { Toast } from "./components/ui/Toast";
import {
  buildRecommendRequest,
  demoWizardState,
  initialWizardState,
  WIZARD_STEPS,
  type DemoPersona,
  type TripWizardState,
} from "./lib/wizard";
import { HandoffScreen } from "./screens/HandoffScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { ResultsScreen } from "./screens/ResultsScreen";
import { TripWizardScreen } from "./screens/TripWizardScreen";

interface UIState {
  step: AppStep;
  wizard: TripWizardState;
  priorityOverride?: PriorityPreset;
  status: "idle" | "loading" | "success" | "error";
  errorMessage?: string;
  response?: import("@shared/types").RankedResponse;
  selectedRouteId?: string;
}

const initial: UIState = {
  step: "home",
  wizard: initialWizardState,
  status: "idle",
};

export default function App() {
  const [state, setState] = useState<UIState>(initial);
  const [showScores, setShowScores] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [savingRouteId, setSavingRouteId] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const selectedCard = state.response?.cards.find(
    (c) => c.routeId === state.selectedRouteId,
  );

  function goHome() {
    setState((s) => ({
      ...initial,
      wizard: { ...initialWizardState, originCity: s.wizard.originCity },
    }));
  }

  function startPlanning() {
    setState((s) => ({
      ...s,
      step: "brief",
      wizard: { ...initialWizardState, originCity: s.wizard.originCity },
      errorMessage: undefined,
      status: "idle",
    }));
  }

  function tryExample(persona: DemoPersona) {
    const wizard = demoWizardState(persona);
    setState((s) => ({
      ...s,
      wizard,
      step: "results",
      status: "loading",
      errorMessage: undefined,
      response: undefined,
      priorityOverride: undefined,
    }));
    void runRecommend(wizard);
  }

  async function runRecommend(
    wizardOverride?: TripWizardState,
    extra?: Partial<RecommendRequest>,
  ) {
    const isRerank = Boolean(extra?.cachedIntent);
    let wizardSnapshot = wizardOverride ?? state.wizard;

    setState((s) => {
      if (wizardOverride) wizardSnapshot = wizardOverride;
      else wizardSnapshot = s.wizard;
      return {
        ...s,
        status: "loading",
        errorMessage: undefined,
        step: isRerank ? s.step : s.step === "brief" ? "results" : s.step,
      };
    });

    const base = buildRecommendRequest(wizardSnapshot);

    try {
      const response = await recommend({
        ...base,
        ...extra,
        cachedIntent: extra?.cachedIntent ?? state.response?.intent,
        priorityOverride: extra?.priorityOverride ?? state.priorityOverride,
      });
      setState((s) => ({
        ...s,
        status: "success",
        response,
        step: "results",
        errorMessage: undefined,
      }));
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Something went wrong. Please try again.";
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage: message,
        step: isRerank ? "results" : wizardOverride ? "results" : "brief",
        wizard: isRerank
          ? s.wizard
          : {
              ...s.wizard,
              stepIndex: WIZARD_STEPS.length - 1,
              furthestStep: WIZARD_STEPS.length - 1,
            },
      }));
      if (isRerank) {
        setToast(message);
      }
    }
  }

  async function handleSave(card: RankedCard) {
    if (!state.response) return;
    setSavingRouteId(card.routeId);
    try {
      const res = await saveTrip({
        requestId: state.response.requestId,
        routeId: card.routeId,
        intent: state.response.intent,
        consentReminder: true,
      });
      setToast(`Saved. Reminder in ~${res.remindAfterHours}h (prototype).`);
    } catch (err) {
      setToast(
        err instanceof ApiClientError ? err.message : "Could not save trip.",
      );
    } finally {
      setSavingRouteId(null);
    }
  }

  function openSearchUrl(url: string) {
    const target =
      url.startsWith("/handoff-mock") || url.startsWith("/handoff-mock.html")
        ? `${window.location.origin}${url}`
        : url;
    window.open(target, "_blank", "noopener,noreferrer");
  }

  return (
      <div className="page-bg flex h-dvh flex-col overflow-hidden text-ink">
        {state.step !== "home" ? (
          <Header step={state.step} onHome={goHome} />
        ) : null}

        <main className="min-h-0 flex-1 overflow-hidden">
        {state.step === "home" ? (
          <HomeScreen onStart={startPlanning} onTryExample={tryExample} />
        ) : null}

        {state.step === "brief" ? (
          <TripWizardScreen
            wizard={state.wizard}
            loading={state.status === "loading"}
            errorMessage={state.errorMessage}
            onChange={(wizard) => setState((s) => ({ ...s, wizard, errorMessage: undefined }))}
            onSubmit={() => void runRecommend()}
            onBack={goHome}
          />
        ) : null}

        {state.step === "results" ? (
          <ResultsScreen
            response={state.response}
            status={state.status}
            errorMessage={state.errorMessage}
            priorityOverride={state.priorityOverride}
            showScores={showScores}
            savingRouteId={savingRouteId}
            onPriorityChange={(p) => {
              setState((s) => ({ ...s, priorityOverride: p }));
              void runRecommend(undefined, {
                priorityOverride: p,
                cachedIntent: state.response!.intent,
              });
            }}
            onEditIntent={() =>
              setState((s) => ({
                ...s,
                step: "brief",
                status: "idle",
                errorMessage: undefined,
                wizard: {
                  ...s.wizard,
                  stepIndex: 0,
                  furthestStep: WIZARD_STEPS.length - 1,
                },
              }))
            }
            onShowScoresChange={setShowScores}
            onSearch={(card) =>
              setState((s) => ({
                ...s,
                selectedRouteId: card.routeId,
                step: "handoff",
              }))
            }
            onSave={(card) => void handleSave(card)}
          />
        ) : null}

        {state.step === "handoff" && selectedCard ? (
          <HandoffScreen
            destinationName={selectedCard.route.destinationName}
            imageUrl={selectedCard.route.backgroundImage.url}
            handoff={selectedCard.handoff}
            viaHub={selectedCard.route.viaHub}
            tripOutline={selectedCard.tripOutline}
            highlightReason={selectedCard.score.reasons[0]}
            connectionType={selectedCard.route.connectionType}
            typicalDurationHours={selectedCard.route.typicalDurationHours}
            onBack={() => setState((s) => ({ ...s, step: "results" }))}
            onOpenSearch={() => openSearchUrl(selectedCard.handoff.searchUrl)}
          />
        ) : null}
      </main>

        {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
      </div>
  );
}
