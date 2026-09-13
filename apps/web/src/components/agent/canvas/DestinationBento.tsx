import clsx from "clsx";
import type { DestinationSuggestion } from "@shared/types";

type BentoSlot = "p1" | "l1" | "l2" | "l3";

/**
 * Slot plan for the opening bento: one tall portrait tile beside a stack of
 * landscape tiles. Four suggestions fill the taller variant; anything beyond
 * that is dropped rather than squeezed into a grid it was not designed for.
 */
const SLOTS: BentoSlot[] = ["p1", "l1", "l2", "l3"];

function shapeFor(slot: BentoSlot): "portrait" | "landscape" {
  return slot === "p1" ? "portrait" : "landscape";
}

/** Unsplash serves by width; local /assets files ignore the hint. */
function heroImage(url: string, shape: "portrait" | "landscape"): string {
  const width = shape === "landscape" ? 1600 : 900;
  return url.includes("unsplash.com") ? url.replace(/w=\d+/, `w=${width}`) : url;
}

export function DestinationBento({
  suggestions,
  selectedId,
  disabled,
  onSelect,
}: {
  suggestions: DestinationSuggestion[];
  selectedId?: string;
  disabled?: boolean;
  onSelect: (suggestion: DestinationSuggestion) => void;
}) {
  const tiles = suggestions.slice(0, SLOTS.length).map((suggestion, index) => ({
    suggestion,
    slot: SLOTS[index],
    shape: shapeFor(SLOTS[index]),
  }));

  if (tiles.length === 0) {
    return <p className="agent-canvas-muted">No destinations are available yet.</p>;
  }

  return (
    <div className="disc-bento-wrap disc-bento-wrap-fill">
      <div
        className={clsx(
          "disc-bento-grid",
          tiles.length > 3 ? "disc-bento-grid-sidebar4" : "disc-bento-grid-sidebar",
        )}
      >
        {tiles.map(({ suggestion, slot, shape }) => (
          <button
            key={suggestion.localityId}
            type="button"
            disabled={disabled}
            className={clsx(
              "disc-bento-card",
              `disc-bento-${shape}`,
              `disc-bento-slot-${slot}`,
              selectedId === suggestion.localityId && "disc-bento-card-preview",
            )}
            onClick={() => onSelect(suggestion)}
          >
            {suggestion.image ? (
              <span
                className="disc-bento-bg"
                style={{ backgroundImage: `url(${heroImage(suggestion.image.url, shape)})` }}
                aria-hidden
              />
            ) : null}
            <span className="disc-bento-scrim" aria-hidden />
            <span className="disc-bento-content">
              {suggestion.promoted ? (
                <span className="disc-bento-badge">VNA spotlight</span>
              ) : null}
              <span className="disc-bento-title">{suggestion.title}</span>
              <span className="disc-bento-sub">{suggestion.summary}</span>
              <span className="disc-bento-gw">Fly into {suggestion.gateway}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
