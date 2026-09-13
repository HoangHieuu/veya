import { useEffect, useState } from "react";
import type { OfferQuote } from "../../../lib/agentTypes";
import { formatMiles, isMember, MEMBER_LABELS, type MemberDemoProfile } from "../../../lib/memberDemo";

function useCountdown(expiresAt: string): string {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setLabel("Expired");
        return;
      }
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setLabel(`${h}h ${m}m left`);
    }
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  return label;
}

export function OfferBlock({
  offer,
  memberProfile,
}: {
  offer: OfferQuote;
  memberProfile: MemberDemoProfile;
}) {
  const countdown = useCountdown(offer.expiresAt);
  const unlocked = isMember(memberProfile);

  if (!offer.eligible) {
    return (
      <section className="agent-canvas-block agent-offer agent-offer-ineligible">
        <h3 className="agent-canvas-label">Bonus Lotusmiles offer</h3>
        <p className="agent-canvas-muted">{offer.ineligibleReason}</p>
      </section>
    );
  }

  return (
    <section className="agent-canvas-block agent-offer" aria-label="Bonus Lotusmiles offer">
      <div className="agent-offer-head">
        <h3 className="agent-canvas-label">Bonus Lotusmiles offer</h3>
        <span className="agent-offer-badge">Discovery mode</span>
      </div>
      <p className="agent-offer-sub">
        Stay on Vietnam Airlines to decide — book direct within 24 hours for extra Lotusmiles
        (illustrative).
      </p>

      <div className="agent-offer-prices">
        <div className="agent-offer-row">
          <span className="agent-offer-tier">Standard earn on route</span>
          <span className="agent-offer-base">{formatMiles(offer.baseMiles)} miles</span>
        </div>
        <div className="agent-offer-row agent-offer-row-highlight">
          <span className="agent-offer-tier">
            {unlocked ? `${MEMBER_LABELS[memberProfile]} bonus` : "Member bonus"}
          </span>
          {unlocked ? (
            <span className="agent-offer-deal">
              +{formatMiles(offer.bonusMiles)} <em>bonus miles</em>
            </span>
          ) : (
            <span className="agent-offer-locked">Sign in to claim bonus miles</span>
          )}
        </div>
        {unlocked ? (
          <div className="agent-offer-row agent-offer-row-total">
            <span className="agent-offer-tier">Total if booked today</span>
            <span className="agent-offer-total">{formatMiles(offer.totalMiles)} miles</span>
          </div>
        ) : null}
      </div>

      <p className="agent-offer-countdown">
        Bonus expires · <strong>{countdown}</strong>
      </p>
      <p className="agent-offer-disclaimer">
        Illustrative earn rates — bonus credited after travel per Lotusmiles program rules. Confirm
        at checkout on vietnamairlines.com.
      </p>
    </section>
  );
}
