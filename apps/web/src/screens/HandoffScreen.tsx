import type { HandOffParams } from "@shared/types";
import { Button } from "../components/ui/Button";
import { cityLabel, formatShortDate } from "../lib/labels";

export function HandoffScreen({
  destinationName,
  imageUrl,
  handoff,
  onBack,
  onOpenSearch,
}: {
  destinationName: string;
  imageUrl: string;
  handoff: HandOffParams;
  onBack: () => void;
  onOpenSearch: () => void;
}) {
  const steps = [
    "We open Vietnam Airlines flight search in a new tab",
    "Your origin, destination, dates & travellers are pre-filled",
    "You complete booking on the official VNA site — prices are live there",
  ];

  return (
    <div className="handoff-shell anim-rise">
      <div className="handoff-visual">
        <img src={imageUrl} alt="" />
        <div className="handoff-visual-overlay" />
        <div className="handoff-visual-content">
          <p className="handoff-eyebrow">Step 3 · Search</p>
          <h1 className="handoff-title">{destinationName}</h1>
          <p className="handoff-lead">
            Ready to search on Vietnam Airlines with your trip details already filled in.
          </p>

          <div className="handoff-route-ticket">
            <div className="handoff-route-leg">
              <span className="handoff-route-code">{handoff.origin}</span>
              <span className="handoff-route-city">{cityLabel(handoff.origin)}</span>
            </div>
            <div className="handoff-route-arrow" aria-hidden>
              <span />
            </div>
            <div className="handoff-route-leg handoff-route-leg-end">
              <span className="handoff-route-code">{handoff.destination}</span>
              <span className="handoff-route-city">{cityLabel(handoff.destination)}</span>
            </div>
          </div>

          <ol className="handoff-steps-desktop">
            {steps.map((s, i) => (
              <li key={s}>
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="handoff-panel">
        <header className="handoff-panel-head">
          <p className="handoff-eyebrow handoff-eyebrow-dark">Off to Vietnam Airlines</p>
          <h2 className="handoff-panel-title">Confirm search details</h2>
          <p className="handoff-panel-lead">
            Review before opening the official booking search — nothing is charged here.
          </p>
        </header>

        <div className="handoff-panel-body">
          <dl className="handoff-fields">
            <HandoffField label="From" value={`${cityLabel(handoff.origin)} (${handoff.origin})`} />
            <HandoffField
              label="To"
              value={`${cityLabel(handoff.destination)} (${handoff.destination})`}
            />
            <HandoffField label="Depart" value={formatShortDate(handoff.departDate)} />
            <HandoffField label="Return" value={formatShortDate(handoff.returnDate)} />
            <HandoffField label="Adults" value={String(handoff.adults)} highlight />
          </dl>

          <ol className="handoff-steps-mobile">
            {steps.map((s, i) => (
              <li key={s}>
                <span>{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>

          <div className="handoff-note">
            <strong>Note:</strong> Veya is a discovery layer only. Fares, availability, and payment
            happen entirely on vietnamairlines.com.
          </div>
        </div>

        <footer className="handoff-panel-foot">
          <Button className="min-h-12 w-full text-base" onClick={onOpenSearch}>
            Open pre-filled search on VNA →
          </Button>
          <Button variant="secondary" className="mt-2 w-full" onClick={onBack}>
            ← Back to routes
          </Button>
        </footer>
      </div>
    </div>
  );
}

function HandoffField({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? "handoff-field handoff-field-wide" : "handoff-field"}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
