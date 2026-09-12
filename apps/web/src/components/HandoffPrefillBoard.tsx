import type { ConnectionType } from "@shared/types";
import { RouteTicket } from "./RouteTicket";
import { connectionLabel, durationLabel, formatShortDate } from "../lib/labels";

export function HandoffPrefillBoard({
  handoff,
  viaHub,
  connectionType,
  typicalDurationHours,
}: {
  handoff: {
    origin: string;
    destination: string;
    departDate: string;
    returnDate: string;
    adults: number;
  };
  viaHub?: string | null;
  connectionType?: ConnectionType;
  typicalDurationHours?: number;
}) {
  return (
    <section className="handoff-prefill-board" aria-label="Pre-filled search parameters">
      <h3 className="handoff-section-label">What VNA receives</h3>

      <RouteTicket
        variant="light"
        className="handoff-prefill-ticket"
        origin={handoff.origin}
        destination={handoff.destination}
        via={viaHub}
      />

      <ul className="handoff-prefill-meta">
        <li>
          <span className="handoff-prefill-meta-label">Dates</span>
          <span>
            {formatShortDate(handoff.departDate)} → {formatShortDate(handoff.returnDate)}
          </span>
        </li>
        <li>
          <span className="handoff-prefill-meta-label">Travellers</span>
          <span>
            {handoff.adults} adult{handoff.adults === 1 ? "" : "s"}
          </span>
        </li>
        {connectionType && typicalDurationHours ? (
          <li>
            <span className="handoff-prefill-meta-label">Route</span>
            <span>
              {connectionLabel(connectionType)} · {durationLabel(typicalDurationHours)}
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
