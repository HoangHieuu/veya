import type { PriorityPreset, RankedResponse, TripIntent } from "@shared/types";
import { Button } from "./ui/Button";
import {
  budgetLabel,
  cityLabel,
  formatShortDate,
  priorityLabel,
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
    <aside className="results-sidebar flex min-h-0 flex-col lg:w-80 lg:shrink-0">
      <div className="results-sidebar-head">
        <p className="results-eyebrow">Your trip</p>
        {intent ? (
          <p className="results-summary">{intent.rawSummary}</p>
        ) : (
          <p className="results-summary-muted">Loading your brief…</p>
        )}
        <Button variant="ghost" onClick={onEditIntent} className="mt-3 h-9 px-0 text-xs">
          ← Edit trip idea
        </Button>
      </div>

      {intent ? (
        <div className="results-sidebar-chips">
          <IntentChips intent={intent} activePriority={activePriority} />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-5">
        <p className="results-eyebrow">Re-rank by priority</p>
        <div className="mt-3 flex flex-col gap-2">
          {PRIORITY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              disabled={status === "loading" || !response}
              onClick={() => onPriorityChange(opt.value)}
              className={clsx(
                "results-priority-btn",
                activePriority === opt.value && "results-priority-btn-active",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="results-sidebar-foot">
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

function IntentChips({
  intent,
  activePriority,
}: {
  intent: TripIntent;
  activePriority?: PriorityPreset;
}) {
  const chips = [
    `${cityLabel(intent.originCity)} · ${intent.originCity}`,
    `${formatShortDate(intent.dateWindow.start)} – ${formatShortDate(intent.dateWindow.end)}`,
    `${intent.tripDurationDays} days`,
    `${intent.travellers} traveller${intent.travellers > 1 ? "s" : ""}`,
    budgetLabel(intent.budgetBand),
    ...intent.travelStyles.map(travelStyleLabel),
    priorityLabel(activePriority ?? intent.priority),
  ];

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <span key={c} className="results-chip">
          {c}
        </span>
      ))}
    </div>
  );
}
