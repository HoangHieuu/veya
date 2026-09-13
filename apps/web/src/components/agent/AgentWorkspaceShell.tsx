import type { ReactNode } from "react";
import { VeyaLogo } from "../VeyaLogo";

export function AgentWorkspaceShell({
  chat,
  discovery,
  tripPanel,
  onHome,
}: {
  chat: ReactNode;
  discovery: ReactNode;
  tripPanel: ReactNode;
  onHome: () => void;
}) {
  return (
    <div className="agent-shell agent-workspace">
      <header className="agent-shell-bar">
        <button type="button" className="agent-shell-brand" onClick={onHome}>
          <VeyaLogo size="sm" />
          <span className="agent-shell-vna">on Vietnam Airlines</span>
        </button>
      </header>
      <div className="agent-workspace-grid">
        <div className="agent-workspace-chat">{chat}</div>
        <div className="agent-workspace-discovery">{discovery}</div>
        <div className="agent-workspace-trip">{tripPanel}</div>
      </div>
    </div>
  );
}
