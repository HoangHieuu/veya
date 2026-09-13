import clsx from "clsx";
import type { OriginCity } from "@shared/types";
import {
  formatMiles,
  getMemberPersona,
  isMember,
  memberInitials,
  type MemberDemoProfile,
} from "../../lib/memberDemo";
import { cityLabel } from "../../lib/labels";

export function TripProfileCard({
  profile,
  origin,
}: {
  profile: MemberDemoProfile;
  origin?: OriginCity;
}) {
  const persona = getMemberPersona(profile);
  const member = isMember(profile);

  return (
    <div className={clsx("trip-profile-card", `trip-profile-card-${persona.tierTone}`)}>
      <div className="trip-profile-head">
        <span className="trip-profile-avatar" aria-hidden>
          {member ? memberInitials(persona.displayName) : "?"}
        </span>
        <div className="trip-profile-id">
          <p className="trip-profile-name">{persona.displayName}</p>
          <p className="trip-profile-program">{persona.programLabel}</p>
        </div>
        <span className={clsx("trip-profile-tier", `trip-profile-tier-${persona.tierTone}`)}>
          {persona.tierLabel}
        </span>
      </div>

      <p className="trip-profile-intent">{persona.intentSummary}</p>

      <dl className="trip-profile-meta">
        {persona.memberId ? (
          <div className="trip-profile-meta-row">
            <dt>Member no.</dt>
            <dd>{persona.memberId}</dd>
          </div>
        ) : null}
        {persona.milesBalance != null ? (
          <div className="trip-profile-meta-row">
            <dt>Miles balance</dt>
            <dd>{formatMiles(persona.milesBalance)}</dd>
          </div>
        ) : null}
        {origin ? (
          <div className="trip-profile-meta-row">
            <dt>Home city</dt>
            <dd>{cityLabel(origin)}</dd>
          </div>
        ) : null}
        {persona.since ? (
          <div className="trip-profile-meta-row">
            <dt>Status</dt>
            <dd>{persona.since}</dd>
          </div>
        ) : null}
      </dl>

      {persona.note ? <p className="trip-profile-note">{persona.note}</p> : null}
    </div>
  );
}
