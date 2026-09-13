import { useCallback, useEffect, useState } from "react";
import type { TripSummary } from "../../lib/agentWorkspace";
import {
  formatSavedWhen,
  listSavedTrips,
  removeSavedTrip,
  saveAgentTrip,
  savedTripSubtitle,
  savedTripTitle,
  type SavedAgentTrip,
} from "../../lib/savedTrips";
import { Button } from "../ui/Button";

export function SavedTripsPanel({
  trip,
  routeLabel,
  canSave,
  onRestore,
  onSaved,
}: {
  trip: TripSummary;
  routeLabel?: string;
  canSave: boolean;
  onRestore: (trip: TripSummary) => void;
  onSaved?: () => void;
}) {
  const [saved, setSaved] = useState<SavedAgentTrip[]>(() => listSavedTrips());
  const [justSaved, setJustSaved] = useState(false);

  const refresh = useCallback(() => setSaved(listSavedTrips()), []);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "veya-agent-saved-trips") refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [refresh]);

  function handleSave() {
    saveAgentTrip(trip, routeLabel);
    refresh();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2000);
    onSaved?.();
  }

  function handleRemove(id: string) {
    removeSavedTrip(id);
    refresh();
  }

  return (
    <section className="trip-panel-saved" aria-label="Saved trips">
      <div className="trip-panel-saved-head">
        <p className="trip-panel-block-label">Saved trips</p>
        {canSave ? (
          <Button
            type="button"
            variant="secondary"
            className="trip-panel-save-btn"
            onClick={handleSave}
          >
            {justSaved ? "Saved ✓" : "Save this trip"}
          </Button>
        ) : null}
      </div>

      {saved.length === 0 ? (
        <p className="trip-panel-saved-empty">
          Save here before you open Vietnam Airlines in another tab. Switch back and we’ll nudge you
          to continue.
        </p>
      ) : (
        <ul className="trip-panel-saved-list">
          {saved.map((entry) => (
            <li key={entry.id} className="trip-panel-saved-item">
              <button
                type="button"
                className="trip-panel-saved-restore"
                onClick={() => onRestore(entry.trip)}
              >
                <span className="trip-panel-saved-title">
                  {savedTripTitle(entry.trip, entry.routeLabel)}
                </span>
                <span className="trip-panel-saved-meta">
                  {savedTripSubtitle(entry.trip)} · {formatSavedWhen(entry.savedAt)}
                </span>
              </button>
              <button
                type="button"
                className="trip-panel-saved-remove"
                aria-label="Remove saved trip"
                onClick={() => handleRemove(entry.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
