import type { GeoPoint } from "./localities";

export interface OsrmRouteResult {
  path: [number, number][];
  distanceKm: number;
  durationHours: number;
  source: "osrm";
}

/** Public OSRM demo — illustrative road route for hackathon demo only */
export async function fetchOsrmDrivingRoute(
  from: GeoPoint,
  to: GeoPoint,
): Promise<OsrmRouteResult | null> {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: { coordinates?: [number, number][] };
      }>;
    };

    const route = data.routes?.[0];
    const coords = route?.geometry?.coordinates;
    if (data.code !== "Ok" || !route || !coords?.length) return null;

    const path: [number, number][] = coords.map(([lng, lat]) => [lat, lng]);

    return {
      path,
      distanceKm: Math.round((route.distance ?? 0) / 100) / 10,
      durationHours: Math.round(((route.duration ?? 0) / 3600) * 10) / 10,
      source: "osrm",
    };
  } catch {
    return null;
  }
}
