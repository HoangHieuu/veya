import type { FlightItineraryView } from "@shared/types";
import { formatTripDate, gatewayLabel, originLabel } from "../../../lib/agentSession";

function cityLabel(code: string): string {
  const gateway = gatewayLabel(code);
  return gateway === code ? originLabel(code) : gateway;
}

/**
 * One direction of the itinerary, laid out like the flight rows on the
 * Vietnam Airlines availability page: times at the ends, duration and stops
 * on the connector between them.
 */
export function FlightItineraryRow({
  itinerary,
}: {
  itinerary: FlightItineraryView;
}) {
  const isDirect = itinerary.connectionType === "direct";

  return (
    <article className="vna-itinerary">
      <header className="vna-itinerary-head">
        <span className="vna-itinerary-dir">
          {itinerary.direction === "outbound" ? "Departing" : "Returning"}
        </span>
        <span className="vna-itinerary-date">{formatTripDate(itinerary.date)}</span>
      </header>

      <div className="vna-itinerary-body">
        <div className="vna-itinerary-end">
          <span className="vna-itinerary-time">{itinerary.departTime}</span>
          <span className="vna-itinerary-code">{itinerary.originAirport}</span>
          <span className="vna-itinerary-city">{cityLabel(itinerary.originAirport)}</span>
        </div>

        <div className="vna-itinerary-mid">
          <span className="vna-itinerary-duration">{itinerary.durationLabel}</span>
          <div className={`vna-itinerary-line${isDirect ? "" : " vna-itinerary-line-stop"}`}>
            <span className="vna-itinerary-dot" aria-hidden />
            {!isDirect ? <span className="vna-itinerary-stopdot" aria-hidden /> : null}
            <span className="vna-itinerary-dot vna-itinerary-dot-end" aria-hidden />
          </div>
          <span className="vna-itinerary-stops">{itinerary.stopsLabel}</span>
        </div>

        <div className="vna-itinerary-end vna-itinerary-end-right">
          <span className="vna-itinerary-time">{itinerary.arriveTime}</span>
          <span className="vna-itinerary-code">{itinerary.destinationAirport}</span>
          <span className="vna-itinerary-city">
            {cityLabel(itinerary.destinationAirport)}
          </span>
        </div>
      </div>

      <ul className="vna-itinerary-segments">
        {itinerary.segments.map((segment) => (
          <li key={`${segment.flightNumber}-${segment.departTime}`}>
            <span className="vna-segment-flight">{segment.flightNumber}</span>
            <span className="vna-segment-leg">
              {segment.departAirport} {segment.departTime} → {segment.arriveAirport}{" "}
              {segment.arriveTime}
            </span>
            <span className="vna-segment-duration">{segment.durationLabel}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}
