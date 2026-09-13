import type { TripIntent } from "@shared/types";
import { gatewayInfo } from "../../../lib/labels";

export function IntentChips({ intent }: { intent: TripIntent }) {
  const chips = [
    intent.originCity,
    intent.travellers === 1 ? "1 traveller" : `${intent.travellers} travellers`,
    intent.dateWindow.start,
    ...intent.travelStyles.slice(0, 2),
    intent.preferredDestination
      ? gatewayInfo(intent.preferredDestination).title
      : null,
  ].filter(Boolean) as string[];

  return (
    <section className="agent-canvas-block" aria-label="Trip intent">
      <h3 className="agent-canvas-label">Your trip</h3>
      <div className="agent-intent-chips">
        {chips.map((c) => (
          <span key={c} className="agent-intent-chip">
            {c}
          </span>
        ))}
      </div>
      {intent.rawSummary ? (
        <p className="agent-canvas-muted">{intent.rawSummary}</p>
      ) : null}
    </section>
  );
}
