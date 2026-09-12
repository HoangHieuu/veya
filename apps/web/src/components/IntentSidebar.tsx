import type { PriorityPreset, RankedResponse, TripIntent } from "@shared/types";
import { Button } from "./ui/Button";
import {
  budgetLabel,
  cityLabel,
  formatShortDate,
  PRIORITY_OPTIONS,
  travelStyleLabel,
} from "../lib/labels";
import clsx from "clsx";

export function IntentSidebar({
  response,
  activePriority,
  showScores,
  status,
  onPriorityChange,
  onEditIntent,
  onShowScoresChange,
}: {
  response?: RankedResponse;
  activePriority?: PriorityPreset;
  showScores: boolean;
  status: "loading" | "success" | "idle" | "error";
  onPriorityChange: (p: PriorityPreset) => void;
  onEditIntent: () => void;
  onShowScoresChange: (v: boolean) => void;
}) {
  const intent = response?.intent;

  return (
    <aside className="flex min-h-0 flex-col border-b border-line bg-surface/80 lg:w-72 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="shrink-0 border-b border-line/60 px-4 py-3">
        <h2 className="text-sm font-bold text-ink">Your trip</h2>
        {intent ? (
          <p className="mt-1 text-xs leading-relaxed text-muted">{intent.rawSummary}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-2">Loading…</p>
        )}
        <Button variant="ghost" onClick={onEditIntent} className="mt-2 h-8 px-2 text-xs">
          ← Edit trip idea
        </Button>
      </div>

      {intent ? (
        <div className="shrink-0 border-b border-line/60 px-4 py-3">
          <IntentChips intent={intent} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">
          Re-rank by priority
        </p>
        <div className="mt-2 flex flex-col gap-1.5">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={status === "loading" || !response}
              onClick={() => onPriorityChange(opt.value)}
              className={clsx(
                "rounded-lg px-3 py-2 text-left text-xs font-semibold transition",
                activePriority === opt.value
                  ? "accent-gold text-[#8a6d1a]"
                  : "border border-line bg-surface text-muted hover:border-teal/20 hover:text-ink",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="shrink-0 border-t border-line/60 px-4 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-muted">
          <input
            type="checkbox"
            checked={showScores}
            onChange={(e) => onShowScoresChange(e.target.checked)}
            className="accent-teal"
          />
          Show judge scores (dev)
        </label>
      </div>
    </aside>
  );
}

function IntentChips({ intent }: { intent: TripIntent }) {
  const chips = [
    `${cityLabel(intent.originCity)} · ${intent.originCity}`,
    `${formatShortDate(intent.dateWindow.start)} – ${formatShortDate(intent.dateWindow.end)}`,
    `${intent.tripDurationDays} days`,
    `${intent.travellers} traveller${intent.travellers > 1 ? "s" : ""}`,
    budgetLabel(intent.budgetBand),
    ...intent.travelStyles.map(travelStyleLabel),
    intent.constraints.maxStops === 0
      ? "Direct only"
      : `Max ${intent.constraints.maxStops} stop`,
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span
          key={c}
          className="rounded-md accent-teal px-2 py-1 text-[11px] font-medium text-teal"
        >
          {c}
        </span>
      ))}
    </div>
  );
}
