import type { DestinationSuggestion } from "../../../lib/agentWorkspace";
import type { LocalityResolution } from "../../../lib/agentTypes";
import type { TripSummary } from "../../../lib/agentWorkspace";
import { gatewayDisplay } from "../../../lib/agentWorkspace";
import { resolveRouteImageUrl } from "../../../lib/routeMedia";
import { Button } from "../../ui/Button";
import { LocalityMap } from "./LocalityMap";

export function DestinationDetailPanel({
  trip,
  locality,
  suggestion,
  preview,
  onConfirm,
  onBack,
}: {
  trip: TripSummary;
  locality?: LocalityResolution;
  suggestion?: DestinationSuggestion;
  preview?: boolean;
  onConfirm?: () => void;
  onBack?: () => void;
}) {
  const title = suggestion?.title ?? trip.destinationTitle ?? "Your destination";
  const subtitle = suggestion?.subtitle;
  const gateway = suggestion?.gateway ?? trip.gateway;
  const imageUrl = suggestion?.imageUrl;

  return (
    <div className="disc-detail">
      <div
        className={discHeroClass(gateway, Boolean(imageUrl))}
        style={
          imageUrl ? { backgroundImage: `url(${resolveRouteImageUrl(imageUrl)})` } : undefined
        }
      >
        <div className="disc-detail-hero-inner">
          <p className="disc-detail-eyebrow">{preview ? "Preview" : "Destination"}</p>
          <h3 className="disc-detail-title">{title}</h3>
          <p className="disc-detail-sub">
            {subtitle ?? `International gateway · ${gatewayDisplay(gateway)}`}
          </p>
        </div>
      </div>
      {locality ? (
        <>
          <p className="disc-detail-lead">
            Visiting <strong>{locality.localityTitle}</strong> — fly into{" "}
            <strong>{locality.gateway}</strong>
            {locality.onwardNote ? " then continue onward." : "."}
          </p>
          <LocalityMap resolution={locality} compact />
          {locality.onwardNote ? (
            <p className="agent-decision-onward">{locality.onwardNote}</p>
          ) : null}
        </>
      ) : (
        <p className="disc-detail-lead">
          {title} pairs with Vietnam Airlines via {gatewayDisplay(gateway)}.
        </p>
      )}
      {preview && onConfirm ? (
        <div className="disc-detail-actions">
          {onBack ? (
            <Button type="button" variant="ghost" onClick={onBack}>
              Back to suggestions
            </Button>
          ) : null}
          <Button type="button" onClick={onConfirm}>
            Choose {title}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function discHeroClass(gw?: string, hasImage?: boolean): string {
  const base = hasImage ? "disc-detail-hero disc-detail-hero-photo" : "disc-detail-hero";
  if (gw === "SGN") return `${base} disc-detail-hero-south`;
  if (gw === "DAD") return `${base} disc-detail-hero-central`;
  if (gw === "HAN") return `${base} disc-detail-hero-north`;
  return base;
}
