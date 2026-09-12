import type { PriorityPreset, RankedCard, RankedResponse } from "@shared/types";
import { IntentSidebar } from "../components/IntentSidebar";
import { Alert } from "../components/ui/Alert";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import {
  connectionLabel,
  durationLabel,
  formatShortDate,
  routePathLabel,
} from "../lib/labels";
import clsx from "clsx";

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
  const featured = response?.cards[0];
  const rest = response?.cards.slice(1) ?? [];
  const activePriority = priorityOverride ?? response?.intent.priority;

  return (
    <div className="results-shell grid h-full min-h-0 lg:grid-cols-[auto_1fr]">
      <IntentSidebar
        response={response}
        activePriority={activePriority}
        showScores={showScores}
        status={status}
        onPriorityChange={onPriorityChange}
        onEditIntent={onEditIntent}
        onShowScoresChange={onShowScoresChange}
      />

      <div className="min-h-0 overflow-y-auto">
        <header className="results-hero">
          <div className="results-hero-inner">
            <p className="results-eyebrow">Step 2 · Routes</p>
            <h1 className="results-title">
              {status === "loading" ? "Finding routes…" : "Your ranked routes"}
            </h1>
            <p className="results-lead">
              {response
                ? `${response.cards.length} Vietnam Airlines options — pick one to search on VNA`
                : "Comparing connections, dates, and your trip brief"}
            </p>
          </div>
        </header>

        {errorMessage && status === "error" ? (
          <div className="px-4 pt-4 md:px-8">
            <Alert tone="error">{errorMessage}</Alert>
          </div>
        ) : null}

        {response?.meta.usedIllustrativeData ? (
          <div className="px-4 pt-4 md:px-8">
            <Alert tone="warn">{response.meta.disclaimer}</Alert>
          </div>
        ) : null}

        <div className="results-cards px-4 pb-8 pt-4 md:px-8 md:pt-6">
          {status === "loading" ? (
            <>
              <SkeletonCard tall />
              <div className="results-alt-grid">
                <SkeletonCard />
                <SkeletonCard />
              </div>
            </>
          ) : null}

          {status === "success" && featured ? (
            <>
              <FeaturedCard
                card={featured}
                showScores={showScores}
                saving={savingRouteId === featured.routeId}
                onSearch={() => onSearch(featured)}
                onSave={() => onSave(featured)}
              />
              {rest.length > 0 ? (
                <p className="results-section-label">Also worth considering</p>
              ) : null}
              <div className="results-alt-grid">
                {rest.map((card) => (
                  <RouteListCard
                    key={card.routeId}
                    card={card}
                    showScores={showScores}
                    saving={savingRouteId === card.routeId}
                    onSearch={() => onSearch(card)}
                    onSave={() => onSave(card)}
                  />
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function FeaturedCard({
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
  const { route, score, handoff, tripOutline } = card;

  return (
    <article className="results-featured anim-rise">
      <div className="results-featured-media">
        <img src={route.backgroundImage.url} alt="" />
        <div className="results-featured-media-overlay" />
        <div className="results-featured-media-content">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="gold">Best match</Badge>
            <Badge tone="teal">{connectionLabel(route.connectionType)}</Badge>
            {route.dataConfidence === "illustrative" ? (
              <Badge tone="warn">Illustrative</Badge>
            ) : (
              <Badge tone="ok">Confirmed</Badge>
            )}
          </div>
          <h2 className="results-featured-title">{route.destinationName}</h2>
          <p className="results-featured-route">
            {routePathLabel(route.originAirport, route.destinationAirport, route.viaHub)} ·{" "}
            {durationLabel(route.typicalDurationHours)}
          </p>
        </div>
      </div>

      <div className="results-featured-body">
        <div className="results-meta-row">
          <MetaPill label="Depart" value={formatShortDate(handoff.departDate)} />
          <MetaPill label="Return" value={formatShortDate(handoff.returnDate)} />
          <MetaPill label="Travellers" value={String(handoff.adults)} />
          <MetaPill label="Flight time" value={durationLabel(route.typicalDurationHours)} />
        </div>

        <div className="results-reasons">
          <p className="results-block-label">Why this fits</p>
          <ul>
            {score.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>

        <p className="results-outline">{tripOutline}</p>

        <div className="results-info-grid">
          <div className="results-info-card results-info-card-teal">
            <p className="results-block-label">Getting around</p>
            <p>{route.gettingAround}</p>
          </div>
          <div className="results-info-card results-info-card-gold">
            <p className="results-block-label">Season</p>
            <p>{route.seasonalityNotes}</p>
          </div>
        </div>

        {route.promotion ? (
          <div className="results-promo">
            <p className="font-bold text-[#8a6d1a]">{route.promotion.title}</p>
            <p className="mt-1 text-muted">{route.promotion.summary}</p>
          </div>
        ) : null}

        {showScores ? (
          <p className="text-[11px] text-muted-2">Judge score: {score.weightedTotal}/100</p>
        ) : null}

        <div className="results-featured-actions">
          <Button className="min-h-11 flex-1" onClick={onSearch}>
            Continue to search →
          </Button>
          <Button variant="secondary" className="min-h-11 px-6" disabled={saving} onClick={onSave}>
            {saving ? "…" : "Save"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function RouteListCard({
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
  const { route, score, handoff } = card;

  return (
    <article className="results-alt-card anim-rise">
      <div className="results-alt-media">
        <img src={route.backgroundImage.url} alt="" />
        <div className="results-alt-media-overlay" />
        <span className="results-alt-rank">#{card.rank}</span>
        <div className="results-alt-media-bottom">
          <h3>{route.destinationName}</h3>
          <Badge tone="neutral">{connectionLabel(route.connectionType)}</Badge>
        </div>
      </div>

      <div className="results-alt-body">
        <p className="results-alt-meta">
          {routePathLabel(route.originAirport, route.destinationAirport, route.viaHub)} ·{" "}
          {durationLabel(route.typicalDurationHours)}
        </p>
        <p className="results-alt-meta">
          {formatShortDate(handoff.departDate)} → {formatShortDate(handoff.returnDate)} ·{" "}
          {handoff.adults} pax
        </p>
        <p className="results-alt-reason">{score.reasons[0]}</p>
        {showScores ? (
          <p className="text-[10px] text-muted-2">Score {score.weightedTotal}</p>
        ) : null}
        <div className="results-alt-actions">
          <Button className="flex-1" onClick={onSearch}>
            Search
          </Button>
          <Button variant="secondary" className="px-4" disabled={saving} onClick={onSave}>
            {saving ? "…" : "Save"}
          </Button>
        </div>
      </div>
    </article>
  );
}

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="results-meta-pill">
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}

function SkeletonCard({ tall }: { tall?: boolean }) {
  return (
    <div className={clsx("results-skeleton", tall && "results-skeleton-tall")}>
      <div className="skeleton mb-3 h-32 rounded-xl" />
      <div className="skeleton mb-2 h-4 w-2/3 rounded" />
      <div className="skeleton h-4 w-full rounded" />
    </div>
  );
}
