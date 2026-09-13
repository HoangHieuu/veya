import { useState } from "react";
import type { DestinationCity, ExperienceHighlight, TripIntent } from "@shared/types";
import clsx from "clsx";
import {
  AGENT_CHIPS,
  filterHighlights,
  getExperienceHighlights,
  type AgentChip,
} from "../lib/experienceHighlights";
import { resolveRouteImageUrl } from "../lib/routeMedia";

export function AgentExperienceBento({
  gateway,
  highlights,
  intent,
}: {
  gateway: DestinationCity;
  highlights?: ExperienceHighlight[];
  intent?: TripIntent;
}) {
  const [chip, setChip] = useState<AgentChip | null>(null);
  const all = highlights?.length ? highlights : getExperienceHighlights(gateway);
  const visible = filterHighlights(all, chip, intent).slice(0, 4);

  return (
    <div className="agent-experience">
      <p className="results-block-label">Places nearby</p>
      <div className="agent-chips" role="group" aria-label="Refine highlights">
        {AGENT_CHIPS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={chip === opt.id}
            onClick={() => setChip((c) => (c === opt.id ? null : opt.id))}
            className={clsx("agent-chip", chip === opt.id && "agent-chip-active")}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="agent-bento">
        {visible.map((spot, i) => (
          <article
            key={spot.id}
            className={clsx("agent-bento-card", i === 0 && "agent-bento-card-featured")}
          >
            <img src={resolveRouteImageUrl(spot.imageUrl)} alt="" className="agent-bento-img" />
            <div className="agent-bento-overlay" />
            <div className="agent-bento-content">
              <p className="agent-bento-transfer">{spot.transferNote}</p>
              <h3 className="agent-bento-title">{spot.title}</h3>
              <p className="agent-bento-sub">{spot.subtitle}</p>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
