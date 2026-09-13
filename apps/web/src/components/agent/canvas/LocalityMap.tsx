import { useMemo, useState } from "react";
import type { LocalityResolution } from "../../../lib/agentTypes";
import {
  buildFallbackRoute,
  GATEWAY_GEO,
  isIslandLocality,
  isSameHub,
  resolveLocalityGeo,
} from "../../../lib/geo/localities";
import { LeafletRouteMap, type RouteMapMeta } from "./LeafletRouteMap";

export function LocalityMap({
  resolution,
  compact,
}: {
  resolution: LocalityResolution;
  compact?: boolean;
}) {
  const gateway = GATEWAY_GEO[resolution.gateway];
  const locality = useMemo(
    () =>
      resolveLocalityGeo(
        resolution.localityId,
        resolution.localityTitle,
        resolution.gateway,
      ),
    [resolution.localityId, resolution.localityTitle, resolution.gateway],
  );
  const fallbackRoute = useMemo(
    () => buildFallbackRoute(gateway, locality, resolution.localityId),
    [
      gateway.lat,
      gateway.lng,
      locality.lat,
      locality.lng,
      resolution.localityId,
    ],
  );
  const sameHub = isSameHub(gateway, locality);
  const island = isIslandLocality(resolution.localityId, resolution.localityTitle);
  const [routeMeta, setRouteMeta] = useState<RouteMapMeta | null>(null);

  return (
    <div className={compact ? "agent-map-compact" : "agent-map-wrap"}>
      <LeafletRouteMap
        gateway={gateway}
        locality={locality}
        fallbackRoute={fallbackRoute}
        useOsrm={!sameHub && !island}
        hubMode={sameHub}
        islandMode={island}
        height={compact ? 168 : 220}
        onRouteMeta={setRouteMeta}
      />

      {!sameHub ? (
        <div className="agent-map-legend">
          <span>
            <i className="agent-map-dot agent-map-dot-gw" /> {gateway.label} · fly in
          </span>
          <span>
            <i className="agent-map-dot agent-map-dot-loc" /> {locality.label} · visit
          </span>
        </div>
      ) : null}

      {island ? (
        <p className="route-diagram-stats route-diagram-stats-muted">
          Island destination — connect via domestic flight from {gateway.label}
        </p>
      ) : routeMeta?.source === "osrm" && routeMeta.distanceKm > 0 ? (
        <div className="route-diagram-stats">
          <span>~{routeMeta.distanceKm} km</span>
          <span aria-hidden>·</span>
          <span>~{routeMeta.durationHours} h drive (OpenStreetMap route)</span>
        </div>
      ) : null}
    </div>
  );
}
