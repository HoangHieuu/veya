import type { RankedCard } from "@shared/types";
import clsx from "clsx";
import { gatewayInfo } from "../lib/labels";

export function GatewayAlternatives({
  cards,
  selectedId,
  onSelect,
}: {
  cards: RankedCard[];
  selectedId: string;
  onSelect: (routeId: string) => void;
}) {
  if (cards.length <= 1) return null;

  return (
    <div className="results-alternates">
      <p className="results-alternates-label">Also consider</p>
      <div className="results-alternate-pills" role="tablist" aria-label="Other routes">
        {cards.map((card) => {
          const gw = gatewayInfo(card.route.destinationCity);
          const selected = card.routeId === selectedId;
          return (
            <button
              key={card.routeId}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onSelect(card.routeId)}
              className={clsx("results-alternate-pill", selected && "results-alternate-pill-active")}
            >
              {card.rank === 1 ? <span className="results-alternate-star">★</span> : null}
              {gw.title}
              <span className="results-alternate-rank">#{card.rank}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
