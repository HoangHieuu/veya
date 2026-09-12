import type { PriorityPreset, RankedResponse } from "@shared/types";
import clsx from "clsx";
import { Button } from "./ui/Button";
import {
  budgetLabel,
  cityLabel,
  formatShortDate,
  PRIORITY_OPTIONS,
  travelStyleLabel,
} from "../lib/labels";

export function ResultsBriefSidebar({
  response,
  activePriority,
  status,
  showScores,
  onPriorityChange,
  onEditIntent,
  onShowScoresChange,
}: {
  response?: RankedResponse;
  activePriority?: PriorityPreset;
  status: "loading" | "success" | "idle" | "error";
  onPriorityChange: (p: PriorityPreset) => void;
  onEditIntent: () => void;
  onShowScoresChange: (v: boolean) => void;
  showScores: boolean;
}) {
  const intent = response?.intent;

  return (
    <aside className="results-brief" aria-label="Your trip brief">
      <div className="results-brief-inner">
        <header className="results-brief-head">
          <p className="results-eyebrow">Your brief</p>
          <Button variant="ghost" onClick={onEditIntent} className="h-8 px-2 text-xs">
            Edit
          </Button>
        </header>

        {intent ? (
          <dl className="results-brief-fields">
            <BriefField label="From" value={cityLabel(intent.originCity)} />
            <BriefField
              label="Vibe"
              value={intent.travelStyles.map(travelStyleLabel).join(", ")}
            />
            <BriefField
              label="Dates"
              value={`${formatShortDate(intent.dateWindow.start)} – ${formatShortDate(intent.dateWindow.end)}`}
            />
            <BriefField label="Travellers" value={`${intent.travellers} pax`} />
            <BriefField label="Budget" value={budgetLabel(intent.budgetBand)} />
          </dl>
        ) : (
          <p className="results-summary-muted">Loading your brief…</p>
        )}

        <div className="results-brief-priorities">
          <p className="results-brief-priorities-label">What matters most?</p>
          <div className="results-brief-priority-stack">
            {PRIORITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={status === "loading" || !response}
                onClick={() => onPriorityChange(opt.value)}
                className={clsx(
                  "results-brief-priority-btn",
                  activePriority === opt.value && "results-brief-priority-btn-active",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <label className="results-brief-dev flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            checked={showScores}
            onChange={(e) => onShowScoresChange(e.target.checked)}
            className="accent-teal"
          />
          Show judge scores
        </label>
      </div>
    </aside>
  );
}

function BriefField({ label, value }: { label: string; value: string }) {
  return (
    <div className="results-brief-field">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
