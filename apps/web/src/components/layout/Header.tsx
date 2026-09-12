import { VeyaLogo } from "../VeyaLogo";
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
          className="flex min-w-0 items-center justify-self-start rounded-lg transition hover:brightness-105"
        >
          <VeyaLogo size="sm" />
        </button>

        <StepIndicator current={step} />

        <div className="justify-self-end" aria-hidden>
          <div className="h-8 w-[4.5rem]" />
        </div>
      </div>
    </header>
  );
}
