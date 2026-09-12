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
    <div className="grid h-full min-h-0 lg:grid-cols-[auto_1fr]">
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
        <div className="border-b border-line/60 px-4 py-3 md:px-5">
          <h1 className="text-lg font-bold text-ink md:text-xl">
            {status === "loading" ? "Finding routes…" : "Ranked routes for you"}
          </h1>
          <p className="mt-0.5 text-xs text-muted">
            {response
              ? `${response.cards.length} Vietnam Airlines options · tap a route to continue`
              : "Comparing connections, dates, and your trip brief"}
          </p>
        </div>

        {response?.meta.usedIllustrativeData ? (
          <div className="px-4 pt-3 md:px-5">
            <Alert tone="warn">{response.meta.disclaimer}</Alert>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 p-4 md:p-5">
          {status === "loading" ? (
            <>
              <SkeletonCard tall />
              <SkeletonCard />
              <SkeletonCard />
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
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
                  Also worth considering
                </p>
              ) : null}
              <div className="grid gap-3 xl:grid-cols-2">
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

function MetaPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-2.5 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-2">{label}</p>
      <p className="text-xs font-semibold text-ink">{value}</p>
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
    <article className="anim-rise card overflow-hidden rounded-xl">
      <div className="grid xl:grid-cols-[1.1fr_1fr]">
        <div className="relative min-h-[200px] xl:min-h-[340px]">
          <img
            src={route.backgroundImage.url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/25 to-transparent" />
          <div className="absolute bottom-4 left-4 right-4">
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="gold">Best match</Badge>
              <Badge tone="teal">{connectionLabel(route.connectionType)}</Badge>
              {route.dataConfidence === "illustrative" ? (
                <Badge tone="warn">Illustrative</Badge>
              ) : (
                <Badge tone="ok">Confirmed</Badge>
              )}
            </div>
            <h2 className="mt-2 text-2xl font-bold text-white md:text-3xl">
              {route.destinationName}
            </h2>
            <p className="mt-1 text-sm text-white/85">
              {routePathLabel(route.originAirport, route.destinationAirport, route.viaHub)} ·{" "}
              {durationLabel(route.typicalDurationHours)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-4 md:p-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <MetaPill label="Depart" value={formatShortDate(handoff.departDate)} />
            <MetaPill label="Return" value={formatShortDate(handoff.returnDate)} />
            <MetaPill label="Travellers" value={String(handoff.adults)} />
            <MetaPill label="Duration" value={durationLabel(route.typicalDurationHours)} />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
              Why this fits
            </p>
            <ul className="mt-2 space-y-1.5">
              {score.reasons.map((r) => (
                <li
                  key={r}
                  className="flex gap-2 text-sm text-ink/90"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  {r}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs leading-relaxed text-muted">{tripOutline}</p>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg accent-teal px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-muted">Getting around</p>
              <p className="mt-0.5 text-xs text-ink">{route.gettingAround}</p>
            </div>
            <div className="rounded-lg accent-gold px-3 py-2">
              <p className="text-[10px] font-semibold uppercase text-muted">Season</p>
              <p className="mt-0.5 text-xs text-ink">{route.seasonalityNotes}</p>
            </div>
          </div>

          {route.promotion ? (
            <div className="rounded-lg border border-gold/25 bg-gold-light/30 px-3 py-2">
              <p className="text-xs font-bold text-[#8a6d1a]">{route.promotion.title}</p>
              <p className="mt-0.5 text-[11px] text-muted">{route.promotion.summary}</p>
            </div>
          ) : null}

          {showScores ? (
            <p className="text-[11px] text-muted-2">Judge score: {score.weightedTotal}/100</p>
          ) : null}

          <div className="mt-auto flex gap-2">
            <Button className="flex-1" onClick={onSearch}>
              Continue to search →
            </Button>
            <Button variant="secondary" disabled={saving} onClick={onSave}>
              {saving ? "…" : "Save"}
            </Button>
          </div>
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
    <article className="anim-rise card flex flex-col overflow-hidden rounded-xl">
      <div className="relative h-28 shrink-0">
        <img src={route.backgroundImage.url} alt="" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
        <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
          <div>
            <Badge tone="teal">#{card.rank}</Badge>
            <h3 className="mt-1 text-lg font-bold text-white">{route.destinationName}</h3>
          </div>
          <Badge tone="neutral">{connectionLabel(route.connectionType)}</Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <p className="text-xs text-muted">
          {routePathLabel(route.originAirport, route.destinationAirport, route.viaHub)} ·{" "}
          {durationLabel(route.typicalDurationHours)}
        </p>
        <p className="text-xs text-muted">
          {formatShortDate(handoff.departDate)} → {formatShortDate(handoff.returnDate)} ·{" "}
          {handoff.adults} pax
        </p>
        <p className="line-clamp-2 text-xs leading-relaxed text-ink/85">{score.reasons[0]}</p>
        {showScores ? (
          <p className="text-[10px] text-muted-2">Score {score.weightedTotal}</p>
        ) : null}
        <div className="mt-auto flex gap-2 pt-1">
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

function SkeletonCard({ tall }: { tall?: boolean }) {
  return (
    <div className={clsx("card rounded-xl p-4", tall && "min-h-[240px]")}>
      <div className="skeleton mb-3 h-28 rounded-lg" />
      <div className="skeleton mb-2 h-4 w-2/3 rounded" />
      <div className="skeleton h-4 w-full rounded" />
    </div>
  );
}
