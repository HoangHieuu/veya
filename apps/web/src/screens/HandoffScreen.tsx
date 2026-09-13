import type { HandOffParams, PriorityPreset, RouteRecord } from "@shared/types";
import { DirectBookingValueCard } from "../components/DirectBookingValueCard";
import { HandoffPrefillBoard } from "../components/HandoffPrefillBoard";
import { RouteTicket } from "../components/RouteTicket";
import { Button } from "../components/ui/Button";
import { resolveRouteImageUrl } from "../lib/routeMedia";

export function HandoffScreen({
  destinationName,
  imageUrl,
  handoff,
  route,
  priority,
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
  route: RouteRecord;
  priority?: PriorityPreset;
  viaHub?: string | null;
  tripOutline?: string;
  highlightReason?: string;
  connectionType?: "direct" | "one_stop" | "two_stop";
  typicalDurationHours?: number;
  onBack: () => void;
  onOpenSearch: () => void;
}) {
  const resolvedImage = resolveRouteImageUrl(imageUrl);
  const steps = [
    {
      title: "Open airline search",
      detail: "We open Vietnam Airlines in a new tab with your destination and dates already filled in.",
    },
    {
      title: "Pick your flights",
      detail: "Compare live fares, times, and cabins on the airline site.",
    },
    {
      title: "Book and pay there",
      detail: "Complete booking with Vietnam Airlines — we never take payment.",
    },
  ];

  return (
    <div className="handoff-shell anim-rise">
      <div className="handoff-split">
        <div className="handoff-split-visual">
          <img src={resolvedImage} alt="" />
          <div className="handoff-split-visual-overlay" />
          <div className="handoff-split-visual-content">
            <p className="handoff-visual-eyebrow">Step 3 · Continue booking</p>
            <h1 className="handoff-visual-title">{destinationName}</h1>
            {highlightReason ? (
              <p className="handoff-visual-reason">{highlightReason}</p>
            ) : null}
            {tripOutline ? <p className="handoff-visual-outline">{tripOutline}</p> : null}
            <RouteTicket
              origin={handoff.origin}
              destination={handoff.destination}
              via={viaHub}
              connectionType={connectionType}
              className="handoff-visual-ticket"
            />
          </div>
        </div>

        <div className="handoff-split-panel">
          <header className="handoff-panel-head">
            <p className="results-eyebrow">Step 3 · Continue booking</p>
            <h2 className="handoff-panel-title">Continue on Vietnam Airlines</h2>
            <p className="handoff-panel-lead">
              Your route and dates go into the airline search — check live prices before you pay.
            </p>
          </header>

          <DirectBookingValueCard route={route} priority={priority} handoff />

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
              <strong>Prices and payment are on the airline site.</strong> Times and fares shown here
              are guides only — always confirm on Vietnam Airlines before you book.
            </p>
          </div>

          <footer className="handoff-panel-foot">
            <Button className="min-h-12 w-full text-base" onClick={onOpenSearch}>
              Continue on Vietnam Airlines →
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
