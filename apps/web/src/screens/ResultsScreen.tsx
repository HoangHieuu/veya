import { useEffect, useState } from "react";
import type { PriorityPreset, RankedCard, RankedResponse } from "@shared/types";
import { GatewayAlternatives } from "../components/GatewayAlternatives";
import { RecommendedGatewayPanel } from "../components/RecommendedGatewayPanel";
import { ResultsBriefSidebar } from "../components/ResultsBriefSidebar";
import { Alert } from "../components/ui/Alert";

export function ResultsScreen({
  response,
  status,
  errorMessage,
  priorityOverride,
  showScores,
  savingRouteId,
  onPriorityChange,
  onEditIntent,
  onShowScoresChange,
  onSearch,
  onSave,
}: {
  response?: RankedResponse;
  status: "loading" | "success" | "idle" | "error";
  errorMessage?: string;
  priorityOverride?: PriorityPreset;
  showScores: boolean;
  savingRouteId: string | null;
  onPriorityChange: (p: PriorityPreset) => void;
  onEditIntent: () => void;
  onShowScoresChange: (v: boolean) => void;
  onSearch: (card: RankedCard) => void;
  onSave: (card: RankedCard) => void;
}) {
  const cards = response?.cards ?? [];
  const activePriority = priorityOverride ?? response?.intent.priority;
  const [selectedId, setSelectedId] = useState<string | undefined>(cards[0]?.routeId);

  useEffect(() => {
    if (!cards.length) return;
    if (!selectedId || !cards.some((c) => c.routeId === selectedId)) {
      setSelectedId(cards.find((c) => c.rank === 1)?.routeId ?? cards[0]!.routeId);
    }
  }, [cards, selectedId]);

  const selected = cards.find((c) => c.routeId === selectedId) ?? cards[0];

  return (
    <div className="results-shell flex h-full min-h-0 flex-col">
      <div className="results-layout min-h-0 flex-1">
        <ResultsBriefSidebar
          response={response}
          activePriority={activePriority}
          showScores={showScores}
          status={status}
          onPriorityChange={onPriorityChange}
          onEditIntent={onEditIntent}
          onShowScoresChange={onShowScoresChange}
        />

        <div className="results-stage min-h-0 flex-1 overflow-y-auto">
          <header className="results-stage-head">
            <p className="results-eyebrow">Step 2 · Your matches</p>
            <h1 className="results-stage-title">
              {status === "loading" ? "Finding your match…" : "Where to fly in"}
            </h1>
            <p className="results-stage-lead">
              Compare routes and places nearby — when you&apos;re ready, continue to Vietnam Airlines
              with your dates filled in.
            </p>
          </header>

          {errorMessage && status === "error" ? (
            <div className="results-stage-alerts">
              <Alert tone="error">{errorMessage}</Alert>
            </div>
          ) : null}

          <div className="results-stage-body">
            {status === "loading" ? <ResultsLoading /> : null}

            {status === "success" && cards.length > 0 && selected && response ? (
              <div className="results-ai-layout">
                {cards.length > 1 ? (
                  <GatewayAlternatives
                    cards={cards}
                    selectedId={selected.routeId}
                    onSelect={setSelectedId}
                  />
                ) : null}
                <RecommendedGatewayPanel
                  key={selected.routeId}
                  card={selected}
                  intent={response.intent}
                  activePriority={activePriority}
                  showScores={showScores}
                  saving={savingRouteId === selected.routeId}
                  onSearch={() => onSearch(selected)}
                  onSave={() => onSave(selected)}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultsLoading() {
  const lines = [
    "Reading your trip vibe…",
    "Checking Hanoi, Saigon, and Da Nang…",
    "Preparing your recommendation…",
  ];

  return (
    <div className="results-loading">
      <div className="results-ai-panel results-ai-panel-skeleton">
        <div className="results-ai-grid">
          <div className="results-ai-col results-ai-col-main">
            <div className="skeleton results-ai-hero" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-12 w-full rounded-xl" />
              <div className="skeleton h-10 w-full rounded-xl" />
              <div className="skeleton h-3 w-2/3 rounded" />
            </div>
          </div>
          <div className="results-ai-col results-ai-col-side">
            <div className="space-y-3 p-5">
              <div className="skeleton h-28 w-full rounded-xl" />
              <div className="skeleton h-28 w-full rounded-xl" />
              <div className="skeleton h-11 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
      <ul className="results-loading-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
