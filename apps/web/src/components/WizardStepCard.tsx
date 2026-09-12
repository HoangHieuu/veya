import clsx from "clsx";
import type { ReactNode, Ref } from "react";
import { EditIcon } from "./ui/EditIcon";

export type WizardStepCardState = "locked" | "active" | "completed";

export function WizardStepCard({
  title,
  subtitle,
  vibe,
  state,
  summary,
  onEdit,
  children,
  cardRef,
}: {
  title: string;
  subtitle: string;
  vibe: string;
  state: WizardStepCardState;
  summary?: string | null;
  onEdit?: () => void;
  children?: ReactNode;
  cardRef?: Ref<HTMLDivElement>;
}) {
  const isLocked = state === "locked";
  const isActive = state === "active";
  const isCompleted = state === "completed";

  return (
    <div
      ref={cardRef}
      className={clsx(
        "wizard-step-card overflow-hidden rounded-3xl border transition-all duration-500 ease-out",
        isActive && "border-teal/30 bg-surface shadow-[0_8px_30px_-12px_rgb(0_104_133_/_0.25)]",
        isCompleted && "border-line/80 bg-surface-2/90",
        isLocked && "border-line/50 bg-surface-2/50",
      )}
    >
      {isCompleted ? (
        <button
          type="button"
          onClick={onEdit}
          className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-surface-2"
        >
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-2">{title}</p>
            <p className="mt-0.5 truncate text-sm font-medium text-ink">{summary ?? "—"}</p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-teal">
            <EditIcon className="size-3" />
            Edit
          </span>
        </button>
      ) : (
        <div className={clsx("px-5", isActive ? "pt-4 pb-1" : "py-3.5")}>
          <p
            className={clsx(
              "font-bold tracking-tight",
              isLocked ? "text-sm text-muted-2" : "text-base text-ink",
            )}
          >
            {title}
          </p>
          {isActive ? (
            <>
              <p className="mt-1 text-xs font-medium text-teal">{vibe}</p>
              <p className="mt-2 text-sm text-muted">{subtitle}</p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted-2">{subtitle}</p>
          )}
        </div>
      )}

      {isActive && children ? (
        <div className="px-5 pb-5 pt-2 anim-stack-content">{children}</div>
      ) : null}
    </div>
  );
}
