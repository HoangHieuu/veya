import type { RuledOutGateway } from "../../../lib/agentTypes";
import { gatewayInfo } from "../../../lib/labels";

export function RuledOutGateways({ items }: { items: RuledOutGateway[] }) {
  if (!items.length) return null;

  return (
    <section className="agent-canvas-block agent-ruled-out" aria-label="Ruled out gateways">
      <h3 className="agent-canvas-label">Why not these gateways?</h3>
      <ul className="agent-ruled-list">
        {items.map((item) => (
          <li key={item.gateway}>
            <span className="agent-ruled-code">{item.gateway}</span>
            <span>{gatewayInfo(item.gateway).title}</span>
            <p>{item.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
