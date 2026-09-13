import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { GeoPoint } from "../../../lib/geo/localities";
import { fetchOsrmDrivingRoute } from "../../../lib/geo/osrmRoute";

export interface RouteMapMeta {
  distanceKm: number;
  durationHours: number;
  source: "osrm" | "geodesic" | "fallback" | "hub";
}

const TILE_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

function attachTiles(map: L.Map): L.TileLayer {
  return L.tileLayer(TILE_URL, {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 14,
    subdomains: "abc",
  }).addTo(map);
}

function refreshMapSize(map: L.Map): void {
  requestAnimationFrame(() => {
    map.invalidateSize({ pan: false });
    window.setTimeout(() => map.invalidateSize({ pan: false }), 450);
    window.setTimeout(() => map.invalidateSize({ pan: false }), 900);
  });
}

function renderHubMap(el: HTMLDivElement, locality: GeoPoint): L.Map {
  const map = L.map(el, {
    scrollWheelZoom: false,
    dragging: true,
    zoomControl: true,
    attributionControl: true,
  });

  attachTiles(map);

  L.circleMarker([locality.lat, locality.lng], {
    radius: 10,
    fillColor: "#006885",
    color: "#fff",
    weight: 2,
    fillOpacity: 1,
  })
    .bindPopup(
      `<strong>${locality.label}</strong><br/>${locality.sublabel ?? "Fly in direct"}`,
    )
    .addTo(map);

  map.setView([locality.lat, locality.lng], 11);
  refreshMapSize(map);
  return map;
}

function renderRouteMap(
  el: HTMLDivElement,
  gateway: GeoPoint,
  locality: GeoPoint,
  route: [number, number][],
  dashed: boolean,
): L.Map {
  const map = L.map(el, {
    scrollWheelZoom: false,
    dragging: true,
    zoomControl: true,
    attributionControl: true,
  });

  attachTiles(map);

  const line = L.polyline(route, {
    color: "#c9a227",
    weight: 4,
    opacity: 0.88,
    dashArray: dashed ? "10 8" : undefined,
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
  refreshMapSize(map);
  return map;
}

export function LeafletRouteMap({
  gateway,
  locality,
  fallbackRoute,
  useOsrm = false,
  hubMode = false,
  islandMode = false,
  height = 220,
  onRouteMeta,
}: {
  gateway: GeoPoint;
  locality: GeoPoint;
  fallbackRoute: [number, number][];
  useOsrm?: boolean;
  hubMode?: boolean;
  islandMode?: boolean;
  height?: number;
  onRouteMeta?: (meta: RouteMapMeta) => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const onRouteMetaRef = useRef(onRouteMeta);
  onRouteMetaRef.current = onRouteMeta;

  const [loading, setLoading] = useState(!hubMode && (useOsrm || islandMode));

  const gwKey = `${gateway.lat},${gateway.lng}`;
  const locKey = `${locality.lat},${locality.lng}`;
  const routeKey = fallbackRoute.map((p) => p.join(",")).join("|");

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;

    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;

    async function init() {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      if (hubMode) {
        if (cancelled || !hostRef.current) return;
        mapRef.current = renderHubMap(hostRef.current, locality);
        setLoading(false);
        onRouteMetaRef.current?.({ distanceKm: 0, durationHours: 0, source: "hub" });
        if (mapRef.current && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            mapRef.current?.invalidateSize({ pan: false });
          });
          resizeObserver.observe(hostRef.current);
        }
        return;
      }

      setLoading(useOsrm);

      let route = fallbackRoute;
      let meta: RouteMapMeta = { distanceKm: 0, durationHours: 0, source: "fallback" };

      if (islandMode) {
        route = [
          [gateway.lat, gateway.lng],
          [locality.lat, locality.lng],
        ];
        meta = { distanceKm: 0, durationHours: 0, source: "geodesic" };
      } else if (useOsrm) {
        const osrm = await fetchOsrmDrivingRoute(gateway, locality);
        if (cancelled) return;
        if (osrm) {
          route = osrm.path;
          meta = {
            distanceKm: osrm.distanceKm,
            durationHours: osrm.durationHours,
            source: "osrm",
          };
        }
      }

      if (cancelled || !hostRef.current) return;

      mapRef.current = renderRouteMap(
        hostRef.current,
        gateway,
        locality,
        route,
        islandMode || meta.source === "fallback",
      );
      setLoading(false);
      onRouteMetaRef.current?.(meta);

      if (mapRef.current && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          mapRef.current?.invalidateSize({ pan: false });
        });
        resizeObserver.observe(hostRef.current);
      }
    }

    void init();

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [gwKey, locKey, routeKey, useOsrm, hubMode, islandMode]);

  return (
    <div className="leaflet-route-wrap">
      {loading ? <div className="leaflet-route-loading">Loading map…</div> : null}
      <div
        className="leaflet-route-map"
        style={{ height }}
        ref={hostRef}
        role="img"
        aria-label={
          hubMode
            ? `${locality.label} on map`
            : `Map from ${gateway.label} to ${locality.label}`
        }
      />
    </div>
  );
}
