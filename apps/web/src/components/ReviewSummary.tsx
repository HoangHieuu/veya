import { useState } from "react";
import clsx from "clsx";
import { EditIcon } from "./ui/EditIcon";
import { ReviewFieldEditor } from "./ReviewFieldEditor";
import { wizardSummaryLines, type TripWizardState } from "../lib/wizard";

export function ReviewSummary({
  wizard,
  onPatch,
}: {
  wizard: TripWizardState;
  onPatch: (p: Partial<TripWizardState>) => void;
}) {
  const [openStep, setOpenStep] = useState<number | null>(null);

  function toggle(stepIndex: number) {
    setOpenStep((current) => (current === stepIndex ? null : stepIndex));
  }

  return (
    <dl className="divide-y divide-line/60 overflow-hidden rounded-3xl border border-line/80 bg-surface">
      {wizardSummaryLines(wizard).map((row) => {
        const isOpen = openStep === row.stepIndex;

        return (
          <div key={row.label}>
            <div
              className={clsx(
                "group grid grid-cols-[88px_1fr_auto] items-center gap-2 px-3 py-2.5 md:grid-cols-[108px_1fr_auto] md:gap-3 md:px-4 md:py-3",
                isOpen && "bg-surface-2/60",
              )}
            >
              <dt className="text-xs font-semibold uppercase tracking-wider text-muted">
                {row.label}
              </dt>
              <dd className="min-w-0 text-sm text-ink">{row.value}</dd>
              <button
                type="button"
                onClick={() => toggle(row.stepIndex)}
                aria-expanded={isOpen}
                aria-label={`Edit ${row.label}`}
                className={clsx(
                  "inline-flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface text-teal transition",
                  isOpen
                    ? "border-teal/40 bg-teal/5 opacity-100"
                    : "border-line/80 opacity-70 hover:border-teal/30 hover:bg-teal/5 hover:opacity-100 group-hover:opacity-100",
                )}
              >
                <EditIcon className="size-3.5" />
              </button>
            </div>

            {isOpen ? (
              <div className="border-t border-line/50 bg-surface-2/40 px-3 py-3 md:px-4 md:py-4 anim-stack-content">
                <ReviewFieldEditor
                  stepIndex={row.stepIndex}
                  wizard={wizard}
                  onPatch={onPatch}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </dl>
  );
}
