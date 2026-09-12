import type { PriorityPreset, RankedCard, RankedResponse } from "@shared/types";
import { ResultsBriefSidebar } from "../components/ResultsBriefSidebar";
import { RouteTicket } from "../components/RouteTicket";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  connectionLabel,
  durationLabel,
  fareBandLabel,
  gatewayInfo,
} from "../lib/labels";

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
            <p className="results-eyebrow">Step 2 · Places</p>
            <h1 className="results-stage-title">
              {status === "loading" ? "Finding your gateways…" : "Compare Vietnam gateways"}
            </h1>
            <p className="results-stage-lead">
              Three ways in — pick the city that fits, then search flights on VNA.
            </p>
          </header>

          {errorMessage && status === "error" ? (
            <div className="results-stage-alerts">
              <Alert tone="error">{errorMessage}</Alert>
            </div>
          ) : null}

          {response?.meta.usedIllustrativeData ? (
            <div className="results-stage-alerts">
              <Alert tone="warn">{response.meta.disclaimer}</Alert>
            </div>
          ) : null}

          <div className="results-stage-body">
            {status === "loading" ? <ResultsLoading /> : null}

            {status === "success" && cards.length > 0 ? (
              <div className="results-compare" role="list" aria-label="Ranked Vietnam gateways">
                {cards.map((card) => (
                  <GatewayCompareCard
                    key={card.routeId}
                    card={card}
                    showScores={showScores}
                    saving={savingRouteId === card.routeId}
                    onSearch={() => onSearch(card)}
                    onSave={() => onSave(card)}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function GatewayCompareCard({
  card,
  showScores,
  saving,
  onSearch,
  onSave,
}: {
  card: RankedCard;
  showScores?: boolean;
  saving?: boolean;
  onSearch: () => void;
  onSave: () => void;
}) {
  const { route, score, tripOutline } = card;
  const gw = gatewayInfo(route.destinationCity);

  return (
    <article className="results-compare-card anim-rise" role="listitem">
      <div className="results-compare-media">
        <img src={route.backgroundImage.url} alt="" />
        <div className="results-compare-media-overlay" />
        <span className="results-compare-rank">#{card.rank}</span>
        {card.rank === 1 ? (
          <span className="results-compare-match">Best match</span>
        ) : null}
      </div>

      <div className="results-compare-body">
        <p className="results-compare-gateway">{gw.subtitle}</p>
        <h2 className="results-compare-title">{gw.title}</h2>
        <p className="results-compare-vibe">{gw.vibe}</p>

        <RouteTicket
          variant="light"
          className="results-compare-ticket"
          origin={route.originAirport}
          destination={route.destinationAirport}
          via={route.viaHub}
        />

        <div className="results-compare-badges">
          <Badge tone="teal">{connectionLabel(route.connectionType)}</Badge>
          <Badge tone="neutral">{durationLabel(route.typicalDurationHours)}</Badge>
          <Badge tone="neutral">{fareBandLabel(route.indicativeFareBand)}</Badge>
          {route.dataConfidence === "illustrative" ? (
            <Badge tone="warn">Illustrative</Badge>
          ) : null}
        </div>

        <section className="results-compare-section">
          <h3 className="results-block-label">Why this fits</h3>
          <ul className="results-compare-reasons">
            {score.reasons.slice(0, 3).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </section>

        <section className="results-compare-section">
          <h3 className="results-block-label">Trip sketch</h3>
          <p className="results-compare-sketch">{tripOutline}</p>
        </section>

        {showScores ? (
          <p className="results-compare-score">Score {score.weightedTotal}/100</p>
        ) : null}
      </div>

      <footer className="results-compare-foot">
        <Button className="min-h-10 w-full text-sm" onClick={onSearch}>
          Search on VNA →
        </Button>
        <Button variant="secondary" className="min-h-10 w-full text-sm" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save trip"}
        </Button>
      </footer>
    </article>
  );
}

function ResultsLoading() {
  const lines = [
    "Matching your vibe to Vietnam gateways…",
    "Checking Da Nang, Saigon, and Hanoi…",
    "Almost ready — compare side by side.",
  ];

  return (
    <div className="results-loading">
      <div className="results-compare">
        {[1, 2, 3].map((n) => (
          <div key={n} className="results-compare-card results-compare-card-skeleton">
            <div className="skeleton results-compare-media" />
            <div className="space-y-2 p-4">
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-5 w-2/3 rounded" />
              <div className="skeleton h-3 w-full rounded" />
              <div className="skeleton h-3 w-full rounded" />
            </div>
          </div>
        ))}
      </div>
      <ul className="results-loading-lines">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
