import type { AgentCanvasState } from "../../lib/agentTypes";
import type { LocalityResolution } from "../../lib/agentTypes";
import type { MemberDemoProfile } from "../../lib/memberDemo";
import {
  deriveStage,
  localityFromSuggestion,
  type BentoDestination,
  type DiscoveryStage,
  type PolicyOverlayId,
  type TripSummary,
} from "../../lib/agentWorkspace";
import { BookingStage } from "./canvas/BookingStage";
import { DestinationBoard } from "./canvas/DestinationBoard";
import { PolicyOverlay } from "./canvas/PolicyOverlay";
import { SuggestedDestinations } from "./canvas/SuggestedDestinations";

type CenterView = "explore" | "destination" | "offer";

export function DiscoveryCanvas({
  trip,
  bookingReady,
  canvas,
  memberProfile,
  locality,
  policyOverlay,
  previewDestination,
  onPreviewDestination,
  onConfirmDestination,
  onClearPreview,
  onSkipHotels,
  onClosePolicy,
  onHandoff,
  onOpenPolicy,
  showOfferView,
  onContinueToOffer,
  onBackToTripSummary,
}: {
  trip: TripSummary;
  bookingReady: boolean;
  showOfferView: boolean;
  onContinueToOffer?: () => void;
  onBackToTripSummary?: () => void;
  canvas?: AgentCanvasState;
  memberProfile: MemberDemoProfile;
  locality?: LocalityResolution;
  policyOverlay?: PolicyOverlayId | null;
  previewDestination?: BentoDestination | null;
  onPreviewDestination: (s: BentoDestination) => void;
  onConfirmDestination: (s: BentoDestination) => void;
  onClearPreview: () => void;
  onSkipHotels: () => void;
  onClosePolicy: () => void;
  onHandoff?: () => void;
  onOpenPolicy?: () => void;
}) {
  const stage: DiscoveryStage = deriveStage(trip, false);
  const hasDestination = Boolean(trip.destinationTitle) && stage !== "suggested_destinations";
  const showBooking = Boolean(showOfferView && bookingReady && canvas && onHandoff);
  const centerView: CenterView = showBooking ? "offer" : hasDestination ? "destination" : "explore";
  const title = stageTitle(stage, trip, showBooking);
  const lead = stageLead(stage, trip, showBooking, bookingReady && !showOfferView);

  return (
    <div className="discovery-canvas">
      <header className="discovery-canvas-head">
        <div key={centerView} className="discovery-canvas-head-inner disc-stage-in">
          <p className="discovery-canvas-eyebrow">Discovery</p>
          <h2 className="discovery-canvas-title">{title}</h2>
          {lead ? <p className="discovery-canvas-lead">{lead}</p> : null}
        </div>
      </header>

      <div
        className={[
          "discovery-canvas-body veya-scroll",
          centerView === "explore" && "discovery-canvas-body-explore",
          centerView === "destination" && "discovery-canvas-body-destination",
          centerView === "offer" && "discovery-canvas-body-offer",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div key={centerView} className="discovery-canvas-stage disc-stage-in">
          {centerView === "offer" && canvas && onHandoff ? (
            <>
              {onBackToTripSummary ? (
                <button
                  type="button"
                  className="disc-offer-back"
                  onClick={onBackToTripSummary}
                >
                  ← Back to trip summary
                </button>
              ) : null}
              <BookingStage
                variant="offer"
                canvas={canvas}
                memberProfile={memberProfile}
                onHandoff={onHandoff}
                onOpenPolicy={onOpenPolicy}
              />
            </>
          ) : null}

          {centerView === "explore" ? (
            <SuggestedDestinations
              origin={trip.origin}
              vibe={trip.travelStyle}
              previewId={previewDestination?.id}
              fill
              onPreview={onPreviewDestination}
            />
          ) : null}

          {centerView === "destination" ? (
            <DestinationBoard
              trip={trip}
              locality={locality}
              bookingReady={bookingReady}
              onSkipHotels={onSkipHotels}
              onContinueToOffer={bookingReady ? onContinueToOffer : undefined}
            />
          ) : null}
        </div>

        {previewDestination ? (
          <div
            key={previewDestination.id}
            className="disc-preview-overlay disc-preview-overlay-in"
            role="dialog"
            aria-modal="true"
            aria-label="Destination preview"
          >
            <button
              type="button"
              className="disc-preview-backdrop"
              aria-label="Close preview"
              onClick={onClearPreview}
            />
            <div className="disc-preview-modal veya-scroll disc-preview-modal-in">
              <DestinationBoard
                trip={trip}
                locality={localityFromSuggestion(previewDestination)}
                suggestion={previewDestination}
                preview
                onConfirm={() => onConfirmDestination(previewDestination)}
                onBack={onClearPreview}
              />
            </div>
          </div>
        ) : null}
      </div>

      {policyOverlay ? (
        <PolicyOverlay policyId={policyOverlay} onClose={onClosePolicy} />
      ) : null}
    </div>
  );
}

function stageTitle(stage: DiscoveryStage, trip: TripSummary, booking: boolean | undefined): string {
  if (booking) return "Your bonus miles offer";
  if (stage === "suggested_destinations") {
    return trip.origin ? "Suggested for you" : "Explore Vietnam";
  }
  return trip.destinationTitle ?? "Your destination";
}

function stageLead(
  stage: DiscoveryStage,
  trip: TripSummary,
  booking: boolean | undefined,
  tripSummaryReady?: boolean,
): string {
  if (booking) {
    return "Review the limited-time bonus Lotusmiles and continue on Vietnam Airlines when ready.";
  }
  if (tripSummaryReady) {
    return "Review map, season, and hotels — continue to your offer when you're ready.";
  }
  if (stage === "suggested_destinations") {
    if (!trip.origin) {
      return "Vietnam Airlines spotlight — tap a place to explore. Departure city goes in the chat.";
    }
    return trip.travelStyle
      ? "Picked for your vibe — tap to preview, then confirm when ready."
      : "Routes promoted for your origin — tap to preview, then confirm when ready.";
  }
  return "";
}
