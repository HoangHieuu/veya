import type {
  AgentCenterContent,
  DestinationSuggestion,
  FareOption,
  MemberDemoProfile,
  TripSummary,
} from "@shared/types";
import { gatewayLabel, originLabel } from "../../lib/agentSession";
import { DestinationBento } from "./canvas/DestinationBento";
import { FareGrid } from "./canvas/FareGrid";
import { FlightItineraryRow } from "./canvas/FlightItineraryRow";
import { SelectedFareSummary } from "./canvas/SelectedFareSummary";

function StageHeader({
  eyebrow,
  title,
  lead,
}: {
  eyebrow: string;
  title: string;
  lead?: string;
}) {
  return (
    <header className="discovery-canvas-head">
      <div className="discovery-canvas-head-inner disc-stage-in">
        <p className="discovery-canvas-eyebrow">{eyebrow}</p>
        <h2 className="discovery-canvas-title">{title}</h2>
        {lead ? <p className="discovery-canvas-lead">{lead}</p> : null}
      </div>
    </header>
  );
}

/**
 * Centre panel. Everything here renders from the server's `centerContent`, so
 * a chat turn that changes the trip changes this view on the same round trip.
 */
export function CanvasRenderer({
  content,
  trip,
  memberProfile,
  busy,
  onSelectDestination,
  onSelectFare,
  onContinueBooking,
  onAskPolicy,
  onHandoff,
}: {
  content: AgentCenterContent;
  trip: TripSummary;
  memberProfile: MemberDemoProfile;
  busy?: boolean;
  onSelectDestination: (suggestion: DestinationSuggestion) => void;
  onSelectFare: (option: FareOption) => void;
  onContinueBooking: () => void;
  onAskPolicy: (question: string) => void;
  onHandoff: () => void;
}) {
  const routeLabel =
    trip.originCity && trip.gateway
      ? `${trip.originCity} → ${trip.gateway}`
      : undefined;

  if (content.kind === "empty") {
    return (
      <div className="discovery-canvas">
        <StageHeader
          eyebrow="Discovery"
          title="Tell me about your trip"
          lead="Where are you flying from, roughly when, and what are you going for? I'll build the route here as we talk."
        />
        <div className="discovery-canvas-body veya-scroll">
          <div className="disc-empty-hints">
            <p className="agent-canvas-muted">Try something like:</p>
            <ul>
              <li>“Melbourne, visiting family in Cà Mau, 2 adults, April”</li>
              <li>“Beach trip from Sydney, 12/04/2027 to 26/04/2027”</li>
              <li>“How much checked baggage do I get?”</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  if (content.kind === "destination_grid") {
    return (
      <div className="discovery-canvas">
        <StageHeader
          eyebrow="Discovery"
          title={
            trip.originCity
              ? `Where in Vietnam, from ${originLabel(trip.originCity)}?`
              : "Where in Vietnam?"
          }
          lead={
            trip.originCity
              ? "Pick one, or just name a province or town in chat — I'll work out which gateway serves it."
              : "Pick a gateway to start, or tell me your city and what you're going for and I'll narrow these down."
          }
        />
        <div className="discovery-canvas-body veya-scroll discovery-canvas-body-explore">
          <div className="discovery-canvas-stage disc-stage-in">
            <DestinationBento
              suggestions={content.suggestions}
              selectedId={trip.destinationLocalityId}
              disabled={busy}
              onSelect={onSelectDestination}
            />
          </div>
        </div>
      </div>
    );
  }

  if (content.kind === "destination_detail") {
    const { suggestion, locality } = content;
    return (
      <div className="discovery-canvas">
        <StageHeader
          eyebrow="Destination"
          title={locality.localityTitle}
          lead={`Vietnam Airlines flies into ${gatewayLabel(locality.gateway)} (${locality.gateway}) for this area.`}
        />
        <div className="discovery-canvas-body veya-scroll">
          <section className="agent-canvas-block">
            <p className="agent-canvas-sub">{suggestion.summary}</p>
            {locality.onwardNote ? (
              <p className="agent-decision-onward">{locality.onwardNote}</p>
            ) : null}
          </section>

          {locality.ruledOut.length > 0 ? (
            <section className="agent-canvas-block">
              <h3 className="agent-canvas-label">Why not the other gateways</h3>
              <ul className="disc-ruledout">
                {locality.ruledOut.map((entry) => (
                  <li key={entry.gateway}>
                    <strong>{gatewayLabel(entry.gateway)}</strong> — {entry.reason}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className="agent-canvas-muted">
            Tell me how many adults and your dates, and I'll price it.
          </p>
        </div>
      </div>
    );
  }

  if (content.kind === "season") {
    return (
      <div className="discovery-canvas">
        <StageHeader
          eyebrow="Season check"
          title={content.note.headline}
          lead={content.note.summary}
        />
        <div className="discovery-canvas-body veya-scroll">
          {content.note.caveats.length > 0 ? (
            <ul className="disc-season-caveats">
              {content.note.caveats.map((caveat) => (
                <li key={caveat}>{caveat}</li>
              ))}
            </ul>
          ) : null}
          <button type="button" className="vna-primary" disabled={busy} onClick={onContinueBooking}>
            Show me fares
          </button>
        </div>
      </div>
    );
  }

  if (content.kind === "hotels") {
    return (
      <div className="discovery-canvas">
        <StageHeader eyebrow="Stays" title="Where to stay" />
        <div className="discovery-canvas-body veya-scroll">
          <p className="agent-canvas-muted">
            Hotel partners are out of scope for this prototype. Say “skip hotels”
            and I'll go straight to fares.
          </p>
          <button type="button" className="vna-primary" disabled={busy} onClick={onContinueBooking}>
            Skip to fares
          </button>
        </div>
      </div>
    );
  }

  // Booking: the VNA-style availability board.
  const card = content.recommendation.cards[0];
  const travellers = trip.travellers ?? 1;

  return (
    <div className="discovery-canvas">
      <StageHeader
        eyebrow="Select your fare"
        title={`${originLabel(trip.originCity)} → ${gatewayLabel(trip.gateway)}`}
        lead={
          card
            ? `${card.route.originAirport}–${card.route.destinationAirport} · ${travellers} adult${travellers > 1 ? "s" : ""} · return`
            : undefined
        }
      />

      <div className="discovery-canvas-body veya-scroll discovery-canvas-body-offer">
        {content.selectedFare ? (
          <SelectedFareSummary
            selection={content.selectedFare}
            routeLabel={routeLabel}
            onChangeFare={() => {
              document
                .getElementById("vna-fare-grid")
                ?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}
            onAskBaggage={() =>
              onAskPolicy(
                `What is the checked baggage allowance for my ${content.selectedFare?.fare.brandLabel} ticket?`,
              )
            }
          />
        ) : null}

        {content.itineraries.length > 0 ? (
          <section className="agent-canvas-block">
            <h3 className="agent-canvas-label">Your flights</h3>
            <div className="vna-itineraries">
              {content.itineraries.map((itinerary) => (
                <FlightItineraryRow key={itinerary.direction} itinerary={itinerary} />
              ))}
            </div>
            <p className="vna-schedule-note">
              Indicative schedule for the demo — confirm live times on
              vietnamairlines.com.
            </p>
          </section>
        ) : null}

        <section className="agent-canvas-block" id="vna-fare-grid">
          <h3 className="agent-canvas-label">
            {content.selectedFare ? "Change your fare" : "Choose your fare"}
          </h3>
          <FareGrid
            options={content.fareOptions}
            selectedBrandId={content.selectedFare?.fare.brandId}
            travellers={travellers}
            busy={busy}
            onSelect={onSelectFare}
          />
        </section>

        {content.canvas.offer?.eligible ? (
          <section className="agent-canvas-block vna-offer">
            <h3 className="agent-canvas-label">Direct Decision Offer</h3>
            <p className="agent-canvas-sub">
              {content.canvas.offer.discountPct}% off the illustrative direct fare
              when you book direct — expires{" "}
              {new Date(content.canvas.offer.expiresAt).toLocaleString("en-AU", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
              .
            </p>
            {memberProfile === "guest" ? (
              <p className="agent-canvas-muted">
                Join Lotusmiles at checkout to claim it.
              </p>
            ) : null}
          </section>
        ) : null}

        {card ? (
          <div className="vna-summary-bar">
            <div>
              <p className="vna-summary-label">
                {content.selectedFare
                  ? `${content.selectedFare.fare.brandLabel} · ${travellers} adult${travellers > 1 ? "s" : ""}`
                  : "No fare selected yet"}
              </p>
              <p className="vna-summary-total">
                {content.selectedFare
                  ? new Intl.NumberFormat("en-AU", {
                      style: "currency",
                      currency: "AUD",
                      maximumFractionDigits: 0,
                    }).format(content.selectedFare.totalAud)
                  : "—"}
              </p>
            </div>
            <button
              type="button"
              className="vna-primary"
              disabled={!content.selectedFare || busy}
              onClick={onHandoff}
            >
              Continue on Vietnam Airlines
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
