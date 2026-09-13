import {
  getHotelSuggestionsForTrip,
  type TripSummary,
} from "../../../lib/agentWorkspace";

export function HotelPartnerCards({
  trip,
  onSkip,
}: {
  trip: TripSummary;
  onSkip?: () => void;
}) {
  const panel = getHotelSuggestionsForTrip(trip);

  return (
    <div className="disc-hotels">
      <p className="disc-hotels-eyebrow">{panel.eyebrow}</p>
      <div className="disc-hotels-grid">
        {panel.hotels.map((h) => (
          <div key={h.id} className="disc-hotel-card">
            <span className="disc-hotel-tag">{h.area}</span>
            <p className="disc-hotel-name">{h.name}</p>
            <p className="disc-hotel-note">{h.note}</p>
          </div>
        ))}
      </div>
      {onSkip ? (
        <button type="button" className="disc-hotels-skip" onClick={onSkip}>
          Skip hotels → see flights
        </button>
      ) : null}
    </div>
  );
}
