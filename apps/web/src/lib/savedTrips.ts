import type { TripSummary } from "./agentWorkspace";

const STORAGE_KEY = "veya-agent-saved-trips";
const MAX_SAVED = 5;

export interface SavedAgentTrip {
  id: string;
  savedAt: string;
  trip: TripSummary;
  routeLabel?: string;
}

function readAll(): SavedAgentTrip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedAgentTrip[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(trips: SavedAgentTrip[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export function listSavedTrips(): SavedAgentTrip[] {
  return readAll().sort(
    (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
  );
}

export function saveAgentTrip(trip: TripSummary, routeLabel?: string): SavedAgentTrip {
  const entry: SavedAgentTrip = {
    id: `save-${Date.now()}`,
    savedAt: new Date().toISOString(),
    trip: { ...trip },
    routeLabel,
  };

  const existing = readAll().filter(
    (s) =>
      !(
        s.trip.origin === trip.origin &&
        s.trip.destinationTitle === trip.destinationTitle &&
        s.trip.monthHint === trip.monthHint &&
        s.trip.memberProfile === trip.memberProfile
      ),
  );

  writeAll([entry, ...existing].slice(0, MAX_SAVED));
  return entry;
}

export function removeSavedTrip(id: string) {
  writeAll(readAll().filter((s) => s.id !== id));
}

export function savedTripTitle(trip: TripSummary, routeLabel?: string): string {
  if (routeLabel) return routeLabel;
  if (trip.destinationTitle && trip.origin) {
    return `${trip.origin} → ${trip.destinationTitle}`;
  }
  if (trip.destinationTitle) return trip.destinationTitle;
  if (trip.origin) return `From ${trip.origin}`;
  return "Trip draft";
}

export function savedTripSubtitle(trip: TripSummary): string {
  const parts: string[] = [];
  if (trip.monthHint) parts.push(trip.monthHint);
  if (trip.travellers) parts.push(`${trip.travellers} adult${trip.travellers > 1 ? "s" : ""}`);
  return parts.join(" · ") || "In progress";
}

export function formatSavedWhen(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "Just now";
  if (ms < 3600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3600_000)}h ago`;
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}
