import type { OriginCity, DestinationCity } from "@shared/types";
import { RouteTicket } from "../../RouteTicket";

/** Minimal gateway route for discovery centre — SYD → SGN only */
export function RouteStrip({
  origin,
  gateway,
}: {
  origin: OriginCity;
  gateway: DestinationCity;
}) {
  return (
    <div className="disc-route-strip">
      <p className="disc-route-strip-label">Fly into Vietnam</p>
      <RouteTicket
        origin={origin}
        destination={gateway}
        variant="light"
        className="disc-route-strip-ticket"
      />
    </div>
  );
}
