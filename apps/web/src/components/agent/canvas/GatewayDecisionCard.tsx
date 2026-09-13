import type { LocalityResolution } from "../../../lib/agentTypes";
import { gatewayInfo } from "../../../lib/labels";
import { LocalityMap } from "./LocalityMap";

export function GatewayDecisionCard({
  resolution,
}: {
  resolution: LocalityResolution;
}) {
  const gw = gatewayInfo(resolution.gateway);

  return (
    <section className="agent-decision-card" aria-label="Gateway decision">
      <h3 className="agent-canvas-label">Where to fly in</h3>
      <p className="agent-decision-lead">
        Your destination is <strong>{resolution.localityTitle}</strong> — VNA flies international
        to <strong>{gw.title}</strong>, not the province directly.
      </p>
      <div className="agent-decision-grid">
        <LocalityMap resolution={resolution} compact />
        <ul className="agent-decision-ruled">
          {resolution.ruledOut.map((item) => (
            <li key={item.gateway}>
              <span className="agent-decision-ruled-code">{item.gateway}</span>
              {item.reason}
            </li>
          ))}
        </ul>
      </div>
      {resolution.onwardNote ? (
        <p className="agent-decision-onward">{resolution.onwardNote}</p>
      ) : null}
    </section>
  );
}
