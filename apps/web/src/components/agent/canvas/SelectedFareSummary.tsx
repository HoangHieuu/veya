import type { FareSelectionSummary } from "@shared/types";
import { formatAud } from "../../../lib/agentSession";

/**
 * The traveller's locked-in fare, kept visible in the centre panel for the rest
 * of the session so "what did I pick?" never needs re-asking.
 */
export function SelectedFareSummary({
  selection,
  routeLabel,
  onChangeFare,
  onAskBaggage,
}: {
  selection: FareSelectionSummary;
  routeLabel?: string;
  onChangeFare: () => void;
  onAskBaggage: () => void;
}) {
  const { fare, travellers, totalAud } = selection;

  return (
    <section className="vna-selected" aria-label="Selected fare">
      <header className="vna-selected-head">
        <div>
          <p className="vna-selected-eyebrow">Your fare</p>
          <h3 className="vna-selected-title">{fare.brandLabel}</h3>
          <p className="vna-selected-sub">
            {fare.cabinLabel}
            {routeLabel ? ` · ${routeLabel}` : ""} · {travellers} adult
            {travellers > 1 ? "s" : ""}
          </p>
        </div>
        <div className="vna-selected-price">
          <span className="vna-selected-total">{formatAud(totalAud)}</span>
          <span className="vna-selected-unit">
            total · {formatAud(fare.pricePerAdultAud)} per adult
          </span>
        </div>
      </header>

      <dl className="vna-selected-rules">
        <div>
          <dt>Checked baggage</dt>
          <dd>{fare.checkedBaggage}</dd>
        </div>
        <div>
          <dt>Hand baggage</dt>
          <dd>{fare.handBaggage}</dd>
        </div>
        <div>
          <dt>Changes</dt>
          <dd>{fare.changePolicy}</dd>
        </div>
        <div>
          <dt>Refunds</dt>
          <dd>{fare.refundPolicy}</dd>
        </div>
        <div>
          <dt>Lotusmiles earn</dt>
          <dd>{fare.milesEarnPct}% of base miles</dd>
        </div>
      </dl>

      <div className="vna-selected-actions">
        <button type="button" className="vna-selected-link" onClick={onChangeFare}>
          Change fare
        </button>
        <button type="button" className="vna-selected-link" onClick={onAskBaggage}>
          Ask about this fare's baggage
        </button>
      </div>

      <p className="vna-selected-note">
        Prices are illustrative and derived from a captured Vietnam Airlines fare
        snapshot. Confirm the live fare and its conditions at checkout on
        vietnamairlines.com.
      </p>
    </section>
  );
}
