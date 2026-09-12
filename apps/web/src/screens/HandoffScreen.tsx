import type { HandOffParams } from "@shared/types";
import { HandoffPrefillBoard } from "../components/HandoffPrefillBoard";
import { RouteTicket } from "../components/RouteTicket";
import { Button } from "../components/ui/Button";

export function HandoffScreen({
  destinationName,
  imageUrl,
  handoff,
  viaHub,
  tripOutline,
  highlightReason,
  connectionType,
  typicalDurationHours,
  onBack,
  onOpenSearch,
}: {
  destinationName: string;
  imageUrl: string;
  handoff: HandOffParams;
  viaHub?: string | null;
  tripOutline?: string;
  highlightReason?: string;
  connectionType?: "direct" | "one_stop" | "two_stop";
  typicalDurationHours?: number;
  onBack: () => void;
  onOpenSearch: () => void;
}) {
  const steps = [
    {
      title: "Open VNA search",
      detail: "We launch vietnamairlines.com in a new tab with your trip already filled in.",
    },
    {
      title: "Choose your flights",
      detail: "Compare live fares, cabin classes, and schedules on the official airline site.",
    },
    {
      title: "Book & pay on VNA",
      detail: "Confirm passengers and payment directly with Vietnam Airlines — not through Veya.",
    },
  ];

  return (
    <div className="handoff-shell anim-rise">
      <div className="handoff-split">
        <div className="handoff-split-visual">
          <img src={imageUrl} alt="" />
          <div className="handoff-split-visual-overlay" />
          <div className="handoff-split-visual-content">
            <p className="handoff-visual-eyebrow">Step 3 · Search</p>
            <h1 className="handoff-visual-title">{destinationName}</h1>
            {highlightReason ? (
              <p className="handoff-visual-reason">{highlightReason}</p>
            ) : null}
            {tripOutline ? <p className="handoff-visual-outline">{tripOutline}</p> : null}
            <RouteTicket
              origin={handoff.origin}
              destination={handoff.destination}
              via={viaHub}
              className="handoff-visual-ticket"
            />
          </div>
        </div>

        <div className="handoff-split-panel">
          <header className="handoff-panel-head">
            <p className="results-eyebrow">Off to Vietnam Airlines</p>
            <h2 className="handoff-panel-title">Confirm your handoff</h2>
            <p className="handoff-panel-lead">
              Review what we send to VNA — nothing is charged until you book on their site.
            </p>
          </header>

          <HandoffPrefillBoard
            handoff={handoff}
            viaHub={viaHub}
            connectionType={connectionType}
            typicalDurationHours={typicalDurationHours}
          />

          <section className="handoff-journey" aria-label="What happens next">
            <h3 className="handoff-section-label">What happens next</h3>
            <ol className="handoff-journey-steps">
              {steps.map((step, i) => (
                <li key={step.title}>
                  <span className="handoff-journey-num">{i + 1}</span>
                  <div>
                    <p className="handoff-journey-title">{step.title}</p>
                    <p className="handoff-journey-detail">{step.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="handoff-trust">
            <div className="handoff-trust-icon" aria-hidden>
              ✓
            </div>
            <p>
              <strong>Veya is a discovery layer.</strong> Live prices, seat maps, and payment all
              happen on the official Vietnam Airlines website.
            </p>
          </div>

          <footer className="handoff-panel-foot">
            <Button className="min-h-12 w-full text-base" onClick={onOpenSearch}>
              Open pre-filled search on VNA →
            </Button>
            <button type="button" className="handoff-panel-back" onClick={onBack}>
              ← Back to routes
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
