import clsx from "clsx";
import type {
  AgentCenterContent,
  AgentTurnResponse,
  DiscoveryStage,
  TripSummary,
} from "@shared/types";
import {
  formatAud,
  formatTripDate,
  gatewayLabel,
  originLabel,
} from "../../lib/agentSession";
import { connectionLabel, durationLabel } from "../../lib/labels";
import { RouteTicket } from "../RouteTicket";
import { Badge } from "../ui/Badge";
import { SavedTripsPanel } from "./SavedTripsPanel";
import { TripProfileCard } from "./TripProfileCard";

const STAGE_LABEL: Record<DiscoveryStage, string> = {
  pick_origin: "Choosing origin",
  suggested_destinations: "Exploring destinations",
  destination_detail: "Checking the destination",
  season: "Season check",
  hotels: "Stays",
  booking: "Selecting a fare",
};

const VIBE_LABEL: Record<string, string> = {
  vfr: "Visiting family",
  beach_relaxation: "Beach & relax",
  food_culture: "Food & culture",
  education: "Education",
  family: "Family",
  mixed: "Comparing options",
};

function Row({
  label,
  value,
  filled,
}: {
  label: string;
  value: string;
  filled?: boolean;
}) {
  return (
    <div className={clsx("trip-panel-row", filled && "trip-panel-row-filled")}>
      <span className="trip-panel-label">{label}</span>
      <span className="trip-panel-value">{value}</span>
    </div>
  );
}

/** Right rail: the live trip as the server currently understands it. */
export function TripPanel({
  trip,
  stage,
  centerContent,
  meta,
  onRestoreTrip,
  onTripSaved,
}: {
  trip: TripSummary;
  stage: DiscoveryStage;
  centerContent: AgentCenterContent;
  meta?: AgentTurnResponse["meta"];
  onRestoreTrip: (trip: TripSummary) => void;
  onTripSaved?: () => void;
}) {
  const card =
    centerContent.kind === "booking"
      ? centerContent.recommendation.cards[0]
      : undefined;
  const route = card?.route;
  const selectedFare =
    centerContent.kind === "booking" ? centerContent.selectedFare : undefined;

  return (
    <aside className="trip-panel veya-scroll">
      <header className="trip-panel-head">
        <p className="trip-panel-eyebrow">Your trip</p>
        <h2 className="trip-panel-title">Summary</h2>
        <span className="trip-panel-stage">{STAGE_LABEL[stage]}</span>
      </header>

      <SavedTripsPanel
        trip={trip}
        routeLabel={
          trip.originCity && trip.gateway
            ? `${trip.originCity} → ${trip.gateway}`
            : undefined
        }
        canSave={Boolean(trip.originCity ?? trip.destinationTitle)}
        onRestore={onRestoreTrip}
        onSaved={onTripSaved}
      />

      <div className="trip-panel-block trip-panel-profile">
        <p className="trip-panel-block-label">Customer</p>
        <TripProfileCard profile={trip.memberProfile} origin={trip.originCity} />
      </div>

      <div className="trip-panel-fields">
        <Row
          label="From"
          value={trip.originCity ? `${originLabel(trip.originCity)} (${trip.originCity})` : "—"}
          filled={Boolean(trip.originCity)}
        />
        <Row
          label="Vibe"
          value={trip.travelStyle ? (VIBE_LABEL[trip.travelStyle] ?? trip.travelStyle) : "—"}
          filled={Boolean(trip.travelStyle)}
        />
        <Row
          label="Destination"
          value={trip.destinationTitle ?? "—"}
          filled={Boolean(trip.destinationTitle)}
        />
        <Row
          label="Gateway"
          value={trip.gateway ? `${gatewayLabel(trip.gateway)} (${trip.gateway})` : "—"}
          filled={Boolean(trip.gateway)}
        />
        <Row
          label="Adults"
          value={trip.travellers ? String(trip.travellers) : "—"}
          filled={Boolean(trip.travellers)}
        />
        <Row
          label="Depart"
          value={trip.departDate ? formatTripDate(trip.departDate) : (trip.departMonth ?? "—")}
          filled={Boolean(trip.departDate ?? trip.departMonth)}
        />
        <Row
          label="Return"
          value={formatTripDate(trip.returnDate)}
          filled={Boolean(trip.returnDate)}
        />
      </div>

      {selectedFare ? (
        <section className="trip-panel-block trip-panel-fare" aria-label="Selected fare">
          <p className="trip-panel-block-label">Fare selected</p>
          <p className="trip-panel-fare-brand">{selectedFare.fare.brandLabel}</p>
          <p className="trip-panel-fare-cabin">{selectedFare.fare.cabinLabel}</p>
          <p className="trip-panel-fare-total">
            {formatAud(selectedFare.totalAud)}
            <span> total · {selectedFare.travellers} adult{selectedFare.travellers > 1 ? "s" : ""}</span>
          </p>
          <p className="trip-panel-fare-bag">{selectedFare.fare.checkedBaggage} checked</p>
        </section>
      ) : null}

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
      ) : trip.originCity && trip.gateway ? (
        <section className="trip-panel-flights" aria-label="Gateway route">
          <p className="trip-panel-block-label">Gateway route</p>
          <RouteTicket
            variant="light"
            className="trip-panel-route-ticket"
            origin={trip.originCity}
            destination={trip.gateway}
          />
        </section>
      ) : null}

      {meta ? (
        <p className="trip-panel-meta">
          Dataset {meta.datasetVersion}
          {meta.usedIllustrativeData ? " · includes illustrative data" : ""}
        </p>
      ) : null}
    </aside>
  );
}
