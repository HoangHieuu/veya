import type { RankedCard, TripIntent } from "@shared/types";
import { RouteTicket } from "../../RouteTicket";
import { Badge } from "../../ui/Badge";
import { buildAgentIntro } from "../../../lib/experienceHighlights";
import {
  connectionLabel,
  durationLabel,
  gatewayInfo,
} from "../../../lib/labels";

export function CanvasRouteCard({
  card,
  intent,
}: {
  card: RankedCard;
  intent: TripIntent;
}) {
  const { route } = card;
  const gw = gatewayInfo(route.destinationCity);

  return (
    <div className="agent-route-card-inner" aria-label={`Route ${gw.title}`}>
      <p className="agent-route-intro">{buildAgentIntro(intent, card)}</p>

      <RouteTicket
        variant="light"
        className="agent-route-ticket"
        origin={route.originAirport}
        destination={route.destinationAirport}
        via={route.viaHub}
        connectionType={route.connectionType}
      />

      <div className="agent-route-badges">
        <Badge tone="teal">{connectionLabel(route.connectionType)}</Badge>
        <Badge tone="neutral">{durationLabel(route.typicalDurationHours)}</Badge>
      </div>
    </div>
  );
}
