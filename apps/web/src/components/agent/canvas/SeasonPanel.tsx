import { SEASON_NOTES } from "../../../lib/agentWorkspace";

export function SeasonPanel({ month, destination }: { month: string; destination?: string }) {
  const note =
    SEASON_NOTES[month] ??
    "Illustrative season note — confirm weather before you fly.";

  return (
    <div className="disc-season">
      <p className="disc-season-eyebrow">Season & weather</p>
      <h3 className="disc-season-title">
        {month}
        {destination ? ` · ${destination}` : ""}
      </h3>
      <p className="disc-season-note">{note}</p>
      <p className="disc-season-disclaimer">Illustrative — not a live forecast.</p>
    </div>
  );
}
