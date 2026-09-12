import { StepIndicator, type FlowStep } from "./StepIndicator";

export type AppStep = "home" | FlowStep;

export function Header({
  step,
  onHome,
}: {
  step: FlowStep;
  onHome: () => void;
}) {
  return (
    <header className="shrink-0 border-b border-line/80 bg-surface/85 backdrop-blur-xl">
      <div className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 md:px-5">
        <button
          type="button"
          onClick={onHome}
          className="flex min-w-0 items-center gap-2 justify-self-start rounded-lg transition hover:opacity-80"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-teal/20 to-gold/15">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M12 3c1.5 3 2 5.5 2 8 0 2-.5 3.5-2 5.5-1.5-2-2-3.5-2-5.5 0-2.5.5-5 2-8Z"
                fill="url(#lotus)"
              />
              <defs>
                <linearGradient id="lotus" x1="12" y1="3" x2="12" y2="16">
                  <stop stopColor="#c9a227" />
                  <stop offset="1" stopColor="#006885" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="truncate text-sm font-bold text-ink">Veya</span>
        </button>

        <StepIndicator current={step} />

        <div className="justify-self-end" aria-hidden>
          <div className="h-8 w-[4.5rem]" />
        </div>
      </div>
    </header>
  );
}
