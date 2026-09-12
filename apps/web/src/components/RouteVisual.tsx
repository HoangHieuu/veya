/**
 * Secondary / future feature — compact route network hint.
 * Not used on the main intent screen; keep for a small auxiliary panel later.
 */
import type { OriginCity } from "@shared/types";
import { cityLabel } from "../lib/labels";
import clsx from "clsx";

export function RouteVisualMini({ origin }: { origin: OriginCity }) {
  return (
    <div
      className={clsx(
        "flex items-center gap-3 rounded-xl border border-line/80 bg-surface-2/80 px-3 py-2",
      )}
    >
      <svg width="48" height="24" viewBox="0 0 48 24" aria-hidden className="shrink-0">
        <defs>
          <linearGradient id="miniRoute" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#006885" />
            <stop offset="100%" stopColor="#c9a227" />
          </linearGradient>
        </defs>
        <path
          d="M4 16 Q 24 4, 44 12"
          fill="none"
          stroke="url(#miniRoute)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="4" cy="16" r="2.5" fill="#006885" />
        <circle cx="44" cy="12" r="2.5" fill="#c9a227" />
      </svg>
      <p className="text-[11px] leading-snug text-muted">
        <span className="font-semibold text-teal">{origin}</span>
        {" → "}
        <span className="text-ink">HAN · SGN · DAD</span>
        <span className="text-muted-2"> · from {cityLabel(origin)}</span>
      </p>
    </div>
  );
}
