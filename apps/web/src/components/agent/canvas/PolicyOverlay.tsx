import type { PolicyOverlayId } from "../../../lib/agentWorkspace";
import { POLICY_SNIPPETS } from "../../../lib/agentWorkspace";

export function PolicyOverlay({
  policyId,
  onClose,
}: {
  policyId: PolicyOverlayId;
  onClose: () => void;
}) {
  const policy = POLICY_SNIPPETS[policyId];

  return (
    <div className="policy-overlay" role="dialog" aria-modal="true" aria-labelledby="policy-title">
      <button type="button" className="policy-overlay-backdrop" aria-label="Close" onClick={onClose} />
      <div className="policy-overlay-card">
        <header className="policy-overlay-head">
          <h2 id="policy-title">{policy.title}</h2>
          <button type="button" className="policy-overlay-close" onClick={onClose}>
            ×
          </button>
        </header>
        <ul className="policy-overlay-list">
          {policy.bullets.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
