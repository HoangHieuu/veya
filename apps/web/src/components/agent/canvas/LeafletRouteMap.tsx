import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "../../../lib/geo/localities";
import { fetchOsrmDrivingRoute } from "../../../lib/geo/osrmRoute";

function renderMap(
  el: HTMLDivElement,
  gateway: GeoPoint,
  locality: GeoPoint,
  route: [number, number][],
): L.Map {
  const map = L.map(el, {
    scrollWheelZoom: false,
    dragging: true,
    zoomControl: true,
    attributionControl: true,
  });

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 14,
  }).addTo(map);

  const line = L.polyline(route, {
    color: "#c9a227",
    weight: 4,
    opacity: 0.88,
    dashArray: route.length > 20 ? undefined : "10 8",
  }).addTo(map);

  L.circleMarker([gateway.lat, gateway.lng], {
    radius: 9,
    fillColor: "#006885",
    color: "#fff",
    weight: 2,
    fillOpacity: 1,
  })
    .bindPopup(
      `<strong>${gateway.label}</strong><br/>${gateway.sublabel ?? "VNA gateway"}`,
    )
    .addTo(map);

  L.circleMarker([locality.lat, locality.lng], {
    radius: 8,
    fillColor: "#c9a227",
    color: "#fff",
    weight: 2,
    fillOpacity: 1,
  })
    .bindPopup(
      `<strong>${locality.label}</strong><br/>${locality.sublabel ?? "Your destination"}`,
    )
    .addTo(map);

  map.fitBounds(line.getBounds(), { padding: [28, 28], maxZoom: 9 });

  return map;
}

export function LeafletRouteMap({
  gateway,
  locality,
  fallbackRoute,
  useOsrm = false,
  onRouteMeta,
}: {
  gateway: GeoPoint;
  locality: GeoPoint;
  fallbackRoute: [number, number][];
  useOsrm?: boolean;
  onRouteMeta?: (meta: { distanceKm: number; durationHours: number; source: string }) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [loading, setLoading] = useState(useOsrm);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;

    async function init() {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      setLoading(useOsrm);

      let route = fallbackRoute;
      let source = "illustrative";

      if (useOsrm) {
        const osrm = await fetchOsrmDrivingRoute(gateway, locality);
        if (cancelled) return;
        if (osrm) {
          route = osrm.path;
          source = osrm.source;
          onRouteMeta?.({
            distanceKm: osrm.distanceKm,
            durationHours: osrm.durationHours,
            source: osrm.source,
          });
        } else {
          onRouteMeta?.({
            distanceKm: 0,
            durationHours: 0,
            source: "fallback",
          });
        }
      }

      if (cancelled || !hostRef.current) return;

      mapRef.current = renderMap(hostRef.current, gateway, locality, route);
      setLoading(false);

      if (!useOsrm) {
        onRouteMeta?.({ distanceKm: 0, durationHours: 0, source });
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [gateway, locality, fallbackRoute, useOsrm, onRouteMeta]);

  return (
    <div className="leaflet-route-wrap">
      {loading ? <div className="leaflet-route-loading">Loading road route…</div> : null}
      <div
        className="leaflet-route-map"
        style={{ height: 220 }}
        ref={hostRef}
        role="img"
        aria-label={`Map from ${gateway.label} to ${locality.label}`}
      />
    </div>
  );
}
