import clsx from "clsx";

export type FlowStep = "brief" | "results" | "handoff";

const STEPS = [
  { id: "brief", label: "Your trip" },
  { id: "results", label: "Routes" },
  { id: "handoff", label: "Search" },
] as const;

export function StepIndicator({ current }: { current: FlowStep }) {
  const idx = STEPS.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Progress" className="flex justify-center">
      <ol className="inline-flex max-w-full items-center rounded-full border border-line/70 bg-surface-2/70 p-0.5 shadow-sm backdrop-blur-sm">
        {STEPS.map((step, i) => {
          const done = i < idx;
          const active = i === idx;

          return (
            <li key={step.id} className="flex min-w-0 items-center">
              <div
                className={clsx(
                  "flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 transition sm:px-3 sm:py-1.5",
                  active && "bg-white text-ink shadow-sm ring-1 ring-line/35",
                  done && !active && "text-teal",
                  !active && !done && "text-muted",
                )}
                aria-current={active ? "step" : undefined}
              >
                <span
                  className={clsx(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold tabular-nums sm:h-5 sm:w-5 sm:text-[11px]",
                    active && "bg-teal text-white",
                    done && !active && "bg-teal/12 text-teal",
                    !active && !done && "bg-line/70 text-muted",
                  )}
                  aria-hidden
                >
                  {done ? "✓" : i + 1}
                </span>
                <span
                  className={clsx(
                    "truncate text-[11px] font-semibold sm:text-xs",
                    active ? "inline" : "hidden sm:inline",
                  )}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
