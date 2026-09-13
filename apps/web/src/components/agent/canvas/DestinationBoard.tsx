import clsx from "clsx";
import type { DestinationCity } from "@shared/types";
import type { LocalityResolution } from "../../../lib/agentTypes";
import {
  DESTINATION_SPOTLIGHT,
  gatewayDisplay,
  type DestinationSuggestion,
  type TripSummary,
} from "../../../lib/agentWorkspace";
import { resolveRouteImageUrl } from "../../../lib/routeMedia";
import { Button } from "../../ui/Button";
import { HotelPartnerCards } from "./HotelPartnerCards";
import { LocalityMap } from "./LocalityMap";
import { RouteStrip } from "./RouteStrip";
import { SeasonPanel } from "./SeasonPanel";

export function DestinationBoard({
  trip,
  locality,
  suggestion,
  preview,
  bookingReady,
  onConfirm,
  onBack,
  onSkipHotels,
}: {
  trip: TripSummary;
  locality?: LocalityResolution;
  suggestion?: DestinationSuggestion;
  preview?: boolean;
  bookingReady?: boolean;
  onConfirm?: () => void;
  onBack?: () => void;
  onSkipHotels?: () => void;
}) {
  const meta = resolveDestinationMeta(trip, suggestion);
  const origin = trip.origin ?? "SYD";
  const gateway = (meta.gateway ?? locality?.gateway ?? "SGN") as DestinationCity;

  return (
    <div className={clsx("disc-dest-board", preview && "disc-dest-board-preview")}>
      <article className="disc-dest-card">
        <span
          className="disc-dest-card-bg"
          style={
            meta.imageUrl
              ? { backgroundImage: `url(${resolveRouteImageUrl(meta.imageUrl)})` }
              : undefined
          }
          aria-hidden
        />
        <span className="disc-dest-card-scrim" aria-hidden />
        <div className="disc-dest-card-body">
          {suggestion?.spotlight ? (
            <span className="disc-dest-card-badge">VNA spotlight</span>
          ) : null}
          <h3 className="disc-dest-card-title">{meta.title}</h3>
          <p className="disc-dest-card-sub">{meta.subtitle}</p>
          <p className="disc-dest-card-gw">Gateway · {gatewayDisplay(gateway)}</p>
        </div>
      </article>

      <div className="disc-dest-main">
        <RouteStrip origin={origin} gateway={gateway} />

        <div className="disc-dest-sections">
          {locality ? (
            <section className="disc-dest-section">
              <p className="disc-dest-section-label">Onward from gateway</p>
              <LocalityMap resolution={locality} compact />
              {locality.onwardNote ? (
                <p className="agent-decision-onward">{locality.onwardNote}</p>
              ) : null}
            </section>
          ) : null}

          {trip.monthHint ? (
            <SeasonPanel month={trip.monthHint} destination={meta.title} />
          ) : null}

          <HotelPartnerCards trip={trip} onSkip={!bookingReady ? onSkipHotels : undefined} />
        </div>

        {preview && onConfirm ? (
          <div className="disc-dest-actions">
            {onBack ? (
              <Button type="button" variant="ghost" onClick={onBack}>
                Back to suggestions
              </Button>
            ) : null}
            <Button type="button" onClick={onConfirm}>
              Choose {meta.title}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function resolveDestinationMeta(trip: TripSummary, suggestion?: DestinationSuggestion) {
  const id = suggestion?.id ?? trip.destinationLocalityId;
  const spotlight = id ? DESTINATION_SPOTLIGHT.find((s) => s.id === id) : undefined;
  const gateway = suggestion?.gateway ?? trip.gateway ?? spotlight?.gateway;

  return {
    title: suggestion?.title ?? trip.destinationTitle ?? "Your destination",
    subtitle:
      suggestion?.subtitle ??
      spotlight?.subtitle ??
      (gateway ? `International gateway · ${gatewayDisplay(gateway)}` : "Vietnam visit"),
    imageUrl: suggestion?.imageUrl ?? spotlight?.imageUrl,
    gateway,
  };
}
