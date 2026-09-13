import clsx from "clsx";
import { getBentoSuggestions, type BentoDestination } from "../../../lib/agentWorkspace";
import { resolveRouteImageUrl } from "../../../lib/routeMedia";
import type { OriginCity, TravelStyle } from "@shared/types";

export function SuggestedDestinations({
  origin,
  vibe,
  previewId,
  fill,
  onPreview,
}: {
  origin?: OriginCity;
  vibe?: TravelStyle;
  previewId?: string;
  fill?: boolean;
  onPreview: (s: BentoDestination) => void;
}) {
  const { layout, tiles } = getBentoSuggestions(origin, vibe);

  return (
    <div className={clsx("disc-bento-wrap", fill && "disc-bento-wrap-fill")}>
      <div className={clsx("disc-bento-grid", `disc-bento-grid-${layout}`)}>
        {tiles.map((s) => (
          <button
            key={s.id}
            type="button"
            className={clsx(
              "disc-bento-card",
              `disc-bento-${s.shape}`,
              `disc-bento-slot-${s.slot}`,
              previewId === s.id && "disc-bento-card-preview",
            )}
            onClick={() => onPreview(s)}
          >
            <span
              className="disc-bento-bg"
              style={{ backgroundImage: `url(${heroImage(s.imageUrl, s.shape)})` }}
              aria-hidden
            />
            <span className="disc-bento-scrim" aria-hidden />
            <span className="disc-bento-content">
              {s.spotlight ? <span className="disc-bento-badge">VNA spotlight</span> : null}
              <span className="disc-bento-title">{s.title}</span>
              <span className="disc-bento-sub">{s.subtitle}</span>
              <span className="disc-bento-gw">Fly into {s.gateway}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function heroImage(url: string, _shape: BentoDestination["shape"]): string {
  return resolveRouteImageUrl(url);
}
