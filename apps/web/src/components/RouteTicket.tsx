import type { ConnectionType, DestinationCity } from "@shared/types";
import { cityLabel, transferSummary } from "@shared/routeLabels";
import clsx from "clsx";

function TicketLeg({
  code,
  end = false,
}: {
  code: string;
  end?: boolean;
}) {
  return (
    <div className={clsx("route-ticket-leg", end && "route-ticket-leg-end")}>
      <span className="route-ticket-code">{code}</span>
      <span className="route-ticket-city">{cityLabel(code)}</span>
    </div>
  );
}

export function RouteTicket({
  origin,
  destination,
  via,
  connectionType = via ? "one_stop" : "direct",
  variant = "glass",
  className,
}: {
  origin: string;
  destination: string;
  via?: string | null;
  connectionType?: ConnectionType;
  variant?: "glass" | "light";
  className?: string;
}) {
  const viaCity = (via ?? undefined) as DestinationCity | undefined;
  const note = transferSummary(connectionType, viaCity);

  return (
    <div className={clsx("route-ticket", variant === "light" && "route-ticket-light", className)}>
      <div className="route-ticket-row">
        <TicketLeg code={origin} />
        <div className="route-ticket-arrow" aria-hidden>
          <span />
        </div>
        <TicketLeg code={destination} end />
      </div>
      {note ? (
        <p className="route-ticket-via" aria-label={note}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
