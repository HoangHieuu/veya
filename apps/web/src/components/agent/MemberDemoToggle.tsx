import clsx from "clsx";
import type { MemberDemoProfile } from "../../lib/memberDemo";
import { MEMBER_LABELS } from "../../lib/memberDemo";

const OPTIONS: MemberDemoProfile[] = [
  "guest",
  "lotusmiles_member",
  "lotustudents_verified",
];

export function MemberDemoToggle({
  value,
  onChange,
}: {
  value: MemberDemoProfile;
  onChange: (v: MemberDemoProfile) => void;
}) {
  return (
    <div className="agent-member-toggle" role="group" aria-label="Demo member profile">
      <span className="agent-member-toggle-label">Preview as</span>
      <div className="agent-member-toggle-options">
        {OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={clsx("agent-member-opt", value === opt && "agent-member-opt-active")}
            onClick={() => onChange(opt)}
          >
            {MEMBER_LABELS[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}
