import clsx from "clsx";
import type { AgentCanvasState } from "../../lib/agentTypes";
import {
  gatewayDisplay,
  originDisplay,
  type TripSummary,
  vibeDisplay,
} from "../../lib/agentWorkspace";
import { connectionLabel, durationLabel } from "../../lib/labels";
import { RouteTicket } from "../RouteTicket";
import { Badge } from "../ui/Badge";
import { SavedTripsPanel } from "./SavedTripsPanel";
import { TripProfileCard } from "./TripProfileCard";

function Row({ label, value, filled }: { label: string; value: string; filled?: boolean }) {
  return (
    <div className={clsx("trip-panel-row", filled && "trip-panel-row-filled")}>
      <span className="trip-panel-label">{label}</span>
      <span className="trip-panel-value">{value}</span>
    </div>
  );
}

export function TripPanel({
  trip,
  canvas,
  onRestoreTrip,
  onTripSaved,
}: {
  trip: TripSummary;
  canvas?: AgentCanvasState;
  onRestoreTrip: (trip: TripSummary) => void;
  onTripSaved?: () => void;
}) {
  const card = canvas?.response.cards[0];
  const route = card?.route;
  const routeLabel = route
    ? `${route.originAirport} → ${route.destinationAirport}`
    : trip.origin && trip.gateway
      ? `${trip.origin} → ${trip.gateway}`
      : undefined;
  const canSave = Boolean(trip.origin || trip.destinationTitle);

  return (
    <aside className="trip-panel veya-scroll">
      <header className="trip-panel-head">
        <p className="trip-panel-eyebrow">Your trip</p>
        <h2 className="trip-panel-title">Summary</h2>
      </header>

      <SavedTripsPanel
        trip={trip}
        routeLabel={routeLabel}
        canSave={canSave}
        onRestore={onRestoreTrip}
        onSaved={onTripSaved}
      />

      <div className="trip-panel-block trip-panel-profile">
        <p className="trip-panel-block-label">Customer</p>
        <TripProfileCard profile={trip.memberProfile} origin={trip.origin} />
      </div>

      <div className="trip-panel-fields">
        <Row label="From" value={originDisplay(trip.origin)} filled={Boolean(trip.origin)} />
        <Row label="Vibe" value={vibeDisplay(trip.travelStyle)} filled={Boolean(trip.travelStyle)} />
        <Row
          label="Destination"
          value={trip.destinationTitle ?? "—"}
          filled={Boolean(trip.destinationTitle)}
        />
        <Row label="Gateway" value={gatewayDisplay(trip.gateway)} filled={Boolean(trip.gateway)} />
        <Row
          label="Adults"
          value={trip.travellers ? String(trip.travellers) : "—"}
          filled={trip.travellers > 0}
        />
        <Row label="When" value={trip.monthHint ?? "—"} filled={Boolean(trip.monthHint)} />
      </div>

      {route ? (
        <section className="trip-panel-flights" aria-label="Recommended flight">
          <p className="trip-panel-block-label">Recommended route</p>
          <RouteTicket
            variant="light"
            className="trip-panel-route-ticket"
            origin={route.originAirport}
            destination={route.destinationAirport}
            via={route.viaHub}
            connectionType={route.connectionType}
          />
          <div className="trip-panel-route-badges">
            <Badge tone="teal">{connectionLabel(route.connectionType)}</Badge>
            <Badge tone="neutral">{durationLabel(route.typicalDurationHours)}</Badge>
          </div>
        </section>
      ) : trip.origin && trip.gateway ? (
        <section className="trip-panel-flights" aria-label="Gateway route">
          <p className="trip-panel-block-label">Gateway route</p>
          <RouteTicket
            variant="light"
            className="trip-panel-route-ticket"
            origin={trip.origin}
            destination={trip.gateway}
          />
        </section>
      ) : null}
    </aside>
  );
}
