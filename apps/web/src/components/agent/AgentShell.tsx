import type { ReactNode } from "react";
import { VeyaLogo } from "../VeyaLogo";
import { MemberDemoToggle } from "./MemberDemoToggle";
import type { MemberDemoProfile } from "../../lib/memberDemo";

export function AgentShell({
  chat,
  canvas,
  memberProfile,
  onMemberChange,
  onHome,
}: {
  chat: ReactNode;
  canvas: ReactNode;
  memberProfile: MemberDemoProfile;
  onMemberChange: (p: MemberDemoProfile) => void;
  onHome: () => void;
}) {
  return (
    <div className="agent-shell">
      <header className="agent-shell-bar">
        <button type="button" className="agent-shell-brand" onClick={onHome}>
          <VeyaLogo size="sm" />
          <span className="agent-shell-vna">on Vietnam Airlines</span>
        </button>
        <MemberDemoToggle value={memberProfile} onChange={onMemberChange} />
      </header>
      <div className="agent-shell-grid">
        <div className="agent-shell-chat">{chat}</div>
        <div className="agent-shell-canvas">{canvas}</div>
      </div>
    </div>
  );
}
