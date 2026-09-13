import type { HandOffParams, RouteRecord, TripIntent } from "../../../shared/types.js";

export function buildHandoffParams(
  intent: TripIntent,
  route: RouteRecord,
): HandOffParams {
  const departDate = intent.dateWindow.start;
  const returnDate = addUtcDays(departDate, intent.tripDurationDays);
  const params = new URLSearchParams({
    origin: route.originAirport,
    destination: route.destinationAirport,
    departDate,
    returnDate,
    adults: String(intent.travellers),
    destinationName: route.destinationName,
    connection: route.connectionType,
    duration: String(route.typicalDurationHours),
  });
  if (route.viaHub) {
    params.set("via", route.viaHub);
  }
  if (route.promotion?.title) {
    params.set("promo", route.promotion.title);
  }

  return {
    origin: route.originAirport,
    destination: route.destinationAirport,
    departDate,
    returnDate,
    adults: intent.travellers,
    searchUrl: `/handoff-mock.html?${params.toString()}`,
  };
}

export function addUtcDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
