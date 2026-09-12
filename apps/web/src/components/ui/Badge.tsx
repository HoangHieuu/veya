import clsx from "clsx";
import type { ReactNode } from "react";

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "teal" | "gold" | "warn" | "ok";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-lg px-2 py-0.5 text-[11px] font-semibold",
        tone === "neutral" && "bg-surface-2 text-muted",
        tone === "teal" && "accent-teal text-teal",
        tone === "gold" && "accent-gold text-[#8a6d1a]",
        tone === "warn" && "bg-amber-50 text-warn",
        tone === "ok" && "bg-teal-50 text-ok",
      )}
    >
      {children}
    </span>
  );
}
