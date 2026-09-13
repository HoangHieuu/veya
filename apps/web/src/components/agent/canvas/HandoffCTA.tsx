import type { HandOffParams } from "@shared/types";
import { Button } from "../../ui/Button";

export function HandoffCTA({
  handoff,
  destinationName,
  onContinue,
}: {
  handoff: HandOffParams;
  destinationName: string;
  onContinue: () => void;
}) {
  return (
    <section className="agent-canvas-block agent-handoff-cta" aria-label="Continue booking">
      <h3 className="agent-canvas-label">Ready to book direct</h3>
      <p className="agent-canvas-lead">
        Continue on Vietnam Airlines with {handoff.origin} → {handoff.destination},{" "}
        {handoff.adults} adult{handoff.adults > 1 ? "s" : ""}, dates pre-filled.
      </p>
      <dl className="agent-handoff-meta">
        <div>
          <dt>Depart</dt>
          <dd>{handoff.departDate}</dd>
        </div>
        <div>
          <dt>Return</dt>
          <dd>{handoff.returnDate}</dd>
        </div>
        <div>
          <dt>Into</dt>
          <dd>{destinationName}</dd>
        </div>
      </dl>
      <Button className="w-full min-h-11 text-base" onClick={onContinue}>
        Continue on Vietnam Airlines →
      </Button>
    </section>
  );
}
