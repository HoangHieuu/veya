import type { AgentCanvasState } from "../../../lib/agentTypes";
import type { MemberDemoProfile } from "../../../lib/memberDemo";
import { isMember } from "../../../lib/memberDemo";
import { gatewayInfo } from "../../../lib/labels";
import { CanvasRouteCard } from "./CanvasRouteCard";
import { EnrollmentCard } from "./EnrollmentCard";
import { HandoffCTA } from "./HandoffCTA";
import { OfferBlock } from "./OfferBlock";

export function BookingStage({
  canvas,
  memberProfile,
  onHandoff,
  onOpenPolicy,
  variant = "full",
}: {
  canvas: AgentCanvasState;
  memberProfile: MemberDemoProfile;
  onHandoff: () => void;
  onOpenPolicy?: () => void;
  variant?: "full" | "offer";
}) {
  const { response, discoveryMode, offer } = canvas;
  const card = response.cards[0];

  if (!card) {
    return <p className="agent-canvas-muted">No routes yet.</p>;
  }

  const gw = gatewayInfo(card.route.destinationCity);
  const offerOnly = variant === "offer";

  return (
    <div className="disc-booking">
      {!offerOnly ? (
        <>
          <header className="disc-booking-head">
            <div>
              <p className="agent-canvas-eyebrow">Book direct</p>
              <h2 className="disc-booking-title">{gw.title}</h2>
              <p className="agent-canvas-sub">{gw.subtitle}</p>
            </div>
            {discoveryMode === "discovery" ? (
              <span className="agent-mode-badge agent-mode-discovery">Direct offer</span>
            ) : null}
          </header>

          <section className="agent-canvas-block">
            <h3 className="agent-canvas-label">Flights</h3>
            <CanvasRouteCard card={card} intent={response.intent} />
          </section>
        </>
      ) : null}

      {offer ? <OfferBlock offer={offer} memberProfile={memberProfile} /> : null}
      {!isMember(memberProfile) && offer?.eligible ? <EnrollmentCard /> : null}

      {onOpenPolicy && offer?.eligible ? (
        <button type="button" className="disc-booking-policy-link" onClick={onOpenPolicy}>
          View offer terms
        </button>
      ) : null}

      <HandoffCTA
        handoff={card.handoff}
        destinationName={card.route.destinationName}
        onContinue={onHandoff}
      />
    </div>
  );
}
