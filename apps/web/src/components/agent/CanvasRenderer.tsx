import type { AgentCanvasState } from "../../lib/agentTypes";
import type { MemberDemoProfile } from "../../lib/memberDemo";
import { isMember } from "../../lib/memberDemo";
import { GATEWAY_GEO, isSameHub, resolveLocalityGeo } from "../../lib/geo/localities";
import { gatewayInfo } from "../../lib/labels";
import { CanvasRouteCard } from "./canvas/CanvasRouteCard";
import { EnrollmentCard } from "./canvas/EnrollmentCard";
import { HandoffCTA } from "./canvas/HandoffCTA";
import { LocalityMap } from "./canvas/LocalityMap";
import { OfferBlock } from "./canvas/OfferBlock";

/** Right canvas: destination context + flights & offers only */
export function CanvasRenderer({
  canvas,
  memberProfile,
  onHandoff,
}: {
  canvas: AgentCanvasState;
  memberProfile: MemberDemoProfile;
  onHandoff: (cardIndex: number) => void;
}) {
  const { response, discoveryMode, locality, offer } = canvas;
  const card = response.cards[0];

  if (!card) {
    return (
      <div className="agent-canvas agent-canvas-empty">
        <p className="agent-canvas-muted">No routes yet.</p>
      </div>
    );
  }

  const gw = gatewayInfo(card.route.destinationCity);

  return (
    <div className="agent-canvas">
      <header className="agent-canvas-header">
        <div>
          <p className="agent-canvas-eyebrow">Canvas · destination & flights</p>
          <h2 className="agent-canvas-title">{gw.title}</h2>
          <p className="agent-canvas-sub">{gw.subtitle}</p>
        </div>
        {discoveryMode === "discovery" ? (
          <span className="agent-mode-badge agent-mode-discovery">Direct offer</span>
        ) : null}
      </header>

      <div className="agent-canvas-layout">
        <div className="agent-canvas-main">
          <section className="agent-canvas-block agent-dest-block">
            <h3 className="agent-canvas-label">Destination</h3>
            {locality ? (
              <>
                <p className="agent-dest-lead">
                  {(() => {
                    const gwGeo = GATEWAY_GEO[locality.gateway];
                    const locGeo = resolveLocalityGeo(
                      locality.localityId,
                      locality.localityTitle,
                      locality.gateway,
                    );
                    if (isSameHub(gwGeo, locGeo)) {
                      return (
                        <>
                          Your trip centres on <strong>{locality.localityTitle}</strong> — fly
                          direct into <strong>{card.route.destinationAirport}</strong>.
                        </>
                      );
                    }
                    return (
                      <>
                        Visiting <strong>{locality.localityTitle}</strong> — international flights
                        land at <strong>{card.route.destinationAirport}</strong>, not the province
                        directly.
                      </>
                    );
                  })()}
                </p>
                <LocalityMap resolution={locality} compact />
                {locality.onwardNote ? (
                  <p className="agent-decision-onward">{locality.onwardNote}</p>
                ) : null}
              </>
            ) : (
              <p className="agent-dest-lead">
                {card.route.destinationName} is your recommended VNA gateway for this trip.
              </p>
            )}
            <p className="agent-canvas-muted">{card.tripOutline}</p>
          </section>

          <section className="agent-canvas-block agent-flights-block">
            <h3 className="agent-canvas-label">Flights</h3>
            <CanvasRouteCard card={card} intent={response.intent} />
          </section>
        </div>

        <aside className="agent-canvas-aside">
          {offer ? (
            <OfferBlock offer={offer} memberProfile={memberProfile} />
          ) : null}
          {!isMember(memberProfile) && offer?.eligible ? <EnrollmentCard /> : null}
          <HandoffCTA
            handoff={card.handoff}
            destinationName={card.route.destinationName}
            onContinue={() => onHandoff(0)}
          />
        </aside>
      </div>
    </div>
  );
}
