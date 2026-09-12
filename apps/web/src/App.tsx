import { useEffect, useState } from "react";
import type { OriginCity, PriorityPreset, RankedCard, RecommendRequest } from "@shared/types";
import { ApiClientError, isMockMode, recommend, saveTrip } from "./api/client";
import { GlobeTuningPanel } from "./components/GlobeTuningPanel";
import { Header, type AppStep } from "./components/layout/Header";
import { Toast } from "./components/ui/Toast";
import { GlobeTuningProvider } from "./context/GlobeTuningContext";
import {
  buildRecommendRequest,
  initialWizardState,
  oliviaWizardState,
  WIZARD_STEPS,
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

  function tryExample(_payload: { originCity: OriginCity }) {
    setState((s) => ({
      ...s,
      step: "brief",
      wizard: oliviaWizardState(),
      errorMessage: undefined,
      status: "idle",
    }));
  }

  async function runRecommend(extra?: Partial<RecommendRequest>) {
    setState((s) => ({
      ...s,
      status: "loading",
      errorMessage: undefined,
      step: s.step === "brief" ? "results" : s.step,
    }));

    const base = buildRecommendRequest(state.wizard);

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
      }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        errorMessage:
          err instanceof ApiClientError
            ? err.message
            : "Something went wrong. Please try again.",
        step: "brief",
        wizard: {
          ...s.wizard,
          stepIndex: WIZARD_STEPS.length - 1,
        },
      }));
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
    if (url.startsWith("/handoff-mock")) {
      window.open(`${window.location.origin}${url}`, "_blank", "noopener,noreferrer");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  }

  const showGlobeTuner = import.meta.env.DEV || isMockMode();

  return (
    <GlobeTuningProvider>
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
            priorityOverride={state.priorityOverride}
            showScores={showScores}
            savingRouteId={savingRouteId}
            onPriorityChange={(p) => {
              setState((s) => ({ ...s, priorityOverride: p }));
              void runRecommend({
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
                  stepIndex: WIZARD_STEPS.length - 1,
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
            onBack={() => setState((s) => ({ ...s, step: "results" }))}
            onOpenSearch={() => openSearchUrl(selectedCard.handoff.searchUrl)}
          />
        ) : null}
      </main>

        {toast ? <Toast message={toast} onDismiss={() => setToast(null)} /> : null}
        {showGlobeTuner ? <GlobeTuningPanel /> : null}
      </div>
    </GlobeTuningProvider>
  );
}
