import type { PriorityPreset, RankedCard, TripIntent } from "@shared/types";
import { AgentExperienceBento } from "./AgentExperienceBento";
import { DirectBookingValueCard } from "./DirectBookingValueCard";
import { RouteTicket } from "./RouteTicket";
import { Badge } from "./ui/Badge";
import { Button } from "./ui/Button";
import { buildAgentIntro } from "../lib/experienceHighlights";
import { resolveRouteImageUrl } from "../lib/routeMedia";
import {
  connectionLabel,
  durationLabel,
  fareBandLabel,
  gatewayInfo,
} from "../lib/labels";

function agentMessage(card: RankedCard, intent: TripIntent): string {
  if (card.rank === 1) return buildAgentIntro(intent, card);
  const gw = gatewayInfo(card.route.destinationCity);
  const topReason = card.score.reasons[0];
  return `Another option: ${gw.title} — ${topReason ?? gw.vibe}`;
}

export function RecommendedGatewayPanel({
  card,
  intent,
  activePriority,
  showScores,
  saving,
  onSearch,
  onSave,
}: {
  card: RankedCard;
  intent: TripIntent;
  activePriority?: PriorityPreset;
  showScores?: boolean;
  saving?: boolean;
  onSearch: () => void;
  onSave: () => void;
}) {
  const { route, score, tripOutline } = card;
  const gw = gatewayInfo(route.destinationCity);

  return (
    <article className="results-ai-panel anim-rise" aria-label="Route recommendation">
      <div className="results-ai-grid">
        <div className="results-ai-col results-ai-col-main">
          <div className="results-ai-hero">
            <img src={resolveRouteImageUrl(route.backgroundImage.url)} alt="" />
            <div className="results-ai-hero-overlay" />
            <div className="results-ai-hero-caption">
              {card.rank === 1 ? <span className="results-ai-match">Best match</span> : null}
              <p className="results-ai-gateway">{gw.subtitle}</p>
              <h2 className="results-ai-title">{gw.title}</h2>
            </div>
          </div>

          <div className="results-ai-body results-ai-body-main">
            <div className="agent-bubble">
              <span className="agent-bubble-avatar" aria-hidden>
                V
              </span>
              <p>{agentMessage(card, intent)}</p>
            </div>

            <RouteTicket
              variant="light"
              className="results-ai-ticket"
              origin={route.originAirport}
              destination={route.destinationAirport}
              via={route.viaHub}
              connectionType={route.connectionType}
            />

            <div className="results-ai-badges">
              <Badge tone="teal">{connectionLabel(route.connectionType)}</Badge>
              <Badge tone="neutral">{durationLabel(route.typicalDurationHours)}</Badge>
              <Badge tone="neutral">{fareBandLabel(route.indicativeFareBand)}</Badge>
              {route.dataConfidence === "illustrative" ? (
                <Badge tone="warn">Illustrative</Badge>
              ) : null}
            </div>

            <section className="results-ai-section">
              <h3 className="results-block-label">Why this fits</h3>
              <ul className="results-ai-reasons">
                {score.reasons.slice(0, 3).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>

            <section className="results-ai-section">
              <h3 className="results-block-label">Trip sketch</h3>
              <p className="results-ai-sketch">{tripOutline}</p>
            </section>

            <DirectBookingValueCard route={route} priority={activePriority} compact />
          </div>
        </div>

        <div className="results-ai-col results-ai-col-side">
          <div className="results-ai-body results-ai-body-side">
            <AgentExperienceBento
              gateway={route.destinationCity}
              highlights={card.experienceHighlights}
              intent={intent}
            />

            {showScores ? (
              <p className="results-ai-score">Score {score.weightedTotal}/100</p>
            ) : null}

            <footer className="results-ai-foot">
              <Button className="min-h-11 w-full text-base" onClick={onSearch}>
                Continue with {gw.title} →
              </Button>
              <Button variant="secondary" className="min-h-11 w-full" disabled={saving} onClick={onSave}>
                {saving ? "Saving…" : "Save trip"}
              </Button>
            </footer>
          </div>
        </div>
      </div>
    </article>
  );
}
