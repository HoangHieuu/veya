import type { ConnectionType, DestinationCity } from "./types.js";

const CITY_LABELS: Record<string, string> = {
  SYD: "Sydney",
  MEL: "Melbourne",
  PER: "Perth",
  HAN: "Hanoi",
  SGN: "Ho Chi Minh City",
  DAD: "Da Nang",
};

export function cityLabel(code: string): string {
  return CITY_LABELS[code] ?? code;
}

/** Short line under route ticket, e.g. "1 stop · change flights in Ho Chi Minh City". */
export function transferSummary(
  connectionType: ConnectionType,
  viaHub?: DestinationCity | null,
): string | null {
  if (connectionType === "direct" || !viaHub) return null;
  const stopLabel = connectionType === "one_stop" ? "1 stop" : "2 stops";
  return `${stopLabel} · change flights in ${cityLabel(viaHub)}`;
}

/** Plain-language path including the transfer airport. */
export function routePathLabel(
  origin: string,
  destination: string,
  via?: DestinationCity | null,
): string {
  if (via) {
    return `${cityLabel(origin)} → ${cityLabel(via)} (transfer) → ${cityLabel(destination)}`;
  }
  return `${cityLabel(origin)} → ${cityLabel(destination)}`;
}

/** Scoring / results reason copy — no IATA codes. */
export function connectionReasonText(
  connectionType: ConnectionType,
  viaHub?: DestinationCity | null,
): string {
  if (connectionType === "direct") {
    return "Direct service — no transfer, one flight to your gateway.";
  }
  if (!viaHub) {
    return "Connecting itinerary — confirm transfer airport on Vietnam Airlines.";
  }
  const stopLabel = connectionType === "one_stop" ? "One stop" : "Two stops";
  return `${stopLabel} with a transfer in ${cityLabel(viaHub)} — you land there, change planes, then continue.`;
}

/** Trip outline fragment for curated copy. */
export function tripOutlineConnectionPhrase(
  connectionType: ConnectionType,
  viaHub?: DestinationCity | null,
): string {
  if (connectionType === "direct") return "a direct route";
  if (!viaHub) {
    return connectionType === "one_stop" ? "one connecting flight" : "two connecting flights";
  }
  const stopLabel = connectionType === "one_stop" ? "one stop" : "two stops";
  return `${stopLabel} with a transfer in ${cityLabel(viaHub)}`;
}
