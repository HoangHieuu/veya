import clsx from "clsx";
import { VeyaLogo } from "../components/VeyaLogo";
import { Button } from "../components/ui/Button";
import {
  getMemberPersona,
  getPersonaTripSeed,
  MEMBER_PROFILE_OPTIONS,
  memberInitials,
  type MemberDemoProfile,
} from "../lib/memberDemo";

export function AgentProfileScreen({
  onSelect,
  onSkip,
  onBack,
}: {
  onSelect: (profile: MemberDemoProfile) => void;
  onSkip: () => void;
  onBack: () => void;
}) {
  return (
    <div className="agent-profile-screen">
      <header className="agent-profile-bar">
        <button type="button" className="agent-profile-back" onClick={onBack}>
          ← Back
        </button>
        <VeyaLogo size="sm" />
      </header>

      <div className="agent-profile-inner">
        <p className="agent-profile-eyebrow">Before we start</p>
        <h1 className="agent-profile-title">Who are we planning for?</h1>
        <p className="agent-profile-lead">
          Each profile is a different traveller — membership, trip need, and brief are already set.
        </p>

        <div className="agent-profile-grid">
          {MEMBER_PROFILE_OPTIONS.map((profile) => {
            const persona = getMemberPersona(profile);
            const seed = getPersonaTripSeed(profile);
            const member = profile !== "guest";

            return (
              <button
                key={profile}
                type="button"
                className={clsx("agent-profile-card", `agent-profile-card-${persona.tierTone}`)}
                onClick={() => onSelect(profile)}
              >
                <div className="agent-profile-card-head">
                  <span className="agent-profile-avatar" aria-hidden>
                    {member ? memberInitials(persona.displayName) : "?"}
                  </span>
                  <div className="agent-profile-id">
                    <p className="agent-profile-name">{persona.displayName}</p>
                    <p className="agent-profile-program">{persona.programLabel}</p>
                  </div>
                  <span
                    className={clsx(
                      "agent-profile-tier",
                      `agent-profile-tier-${persona.tierTone}`,
                    )}
                  >
                    {persona.tierLabel}
                  </span>
                </div>
                <p className="agent-profile-intent">{persona.intentSummary}</p>
                <p className="agent-profile-brief">{seed.briefText}</p>
                <span className="agent-profile-cta">Plan as {persona.displayName} →</span>
              </button>
            );
          })}
        </div>

        <div className="agent-profile-skip">
          <Button variant="ghost" onClick={onSkip}>
            Skip — start with a blank trip
          </Button>
        </div>
      </div>
    </div>
  );
}
