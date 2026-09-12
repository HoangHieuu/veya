import clsx from "clsx";
import { cityLabel } from "../lib/labels";

export function RouteTicket({
  origin,
  destination,
  via,
  variant = "glass",
  className,
}: {
  origin: string;
  destination: string;
  via?: string | null;
  variant?: "glass" | "light";
  className?: string;
}) {
  return (
    <div className={clsx("route-ticket", variant === "light" && "route-ticket-light", className)}>
      <div className="route-ticket-row">
        <div className="route-ticket-leg">
          <span className="route-ticket-code">{origin}</span>
          <span className="route-ticket-city">{cityLabel(origin)}</span>
        </div>
        <div className="route-ticket-arrow" aria-hidden>
          <span />
        </div>
        <div className="route-ticket-leg route-ticket-leg-end">
          <span className="route-ticket-code">{destination}</span>
          <span className="route-ticket-city">{cityLabel(destination)}</span>
        </div>
      </div>
      {via ? (
        <p className="route-ticket-via" aria-label={`Connection via ${cityLabel(via)}`}>
          via {via}
        </p>
      ) : null}
    </div>
  );
}
