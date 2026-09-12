import clsx from "clsx";

export function WizardProgress({
  stepIndex,
  total,
  label,
}: {
  stepIndex: number;
  total: number;
  label: string;
}) {
  const pct = Math.round(((stepIndex + 1) / total) * 100);

  return (
    <div className="wizard-progress">
      <div className="wizard-progress-meta">
        <span className="wizard-progress-label">{label}</span>
        <span className="wizard-progress-count">
          {stepIndex + 1} / {total}
        </span>
      </div>
      <div className="wizard-progress-track" aria-hidden>
        <div className="wizard-progress-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function WizardProgressDots({
  stepIndex,
  total,
  className,
}: {
  stepIndex: number;
  total: number;
  className?: string;
}) {
  return (
    <div className={clsx("wizard-progress-dots", className)} aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={clsx(
            "wizard-progress-dot",
            i < stepIndex && "wizard-progress-dot-done",
            i === stepIndex && "wizard-progress-dot-active",
          )}
        />
      ))}
    </div>
  );
}
