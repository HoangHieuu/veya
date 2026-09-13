import type { RouteRecord, PriorityPreset } from "@shared/types";

function firstSentence(text: string, max = 160): string {
  const match = text.match(/^[^.!?]+[.!?]/);
  const sentence = (match?.[0] ?? text).trim();
  if (sentence.length <= max) return sentence;
  return `${sentence.slice(0, max - 1).trim()}…`;
}

function milesLine(band: NonNullable<RouteRecord["lotusmilesIndicative"]>["earnBand"]): string {
  switch (band) {
    case "high":
      return "This route often earns more Lotusmiles — check fare rules at checkout.";
    case "mid":
      return "Moderate Lotusmiles earn on this route — check fare rules at checkout.";
    default:
      return "Miles earned depend on fare class — check when you book.";
  }
}

function cardClass(compact?: boolean, handoff?: boolean): string {
  if (handoff) return "direct-value direct-value-handoff";
  if (compact) return "direct-value direct-value-compact";
  return "direct-value";
}

export function DirectBookingValueCard({
  route,
  priority,
  compact,
  handoff,
}: {
  route: RouteRecord;
  priority?: PriorityPreset;
  compact?: boolean;
  /** Tighter copy and layout on Step 3 handoff */
  handoff?: boolean;
}) {
  const miles = route.lotusmilesIndicative;
  const showMiles = Boolean(miles) || priority === "maximise_miles";
  const hasOffer = Boolean(route.promotion);
  const hasContent = hasOffer || showMiles;
  const summaryMax = handoff ? 96 : compact ? 120 : 160;

  if (!hasContent) {
    return (
      <section
        className={cardClass(compact, handoff)}
        aria-label="Vietnam Airlines booking"
      >
        <p className="direct-value-muted">
          Current fares and promotions show up when you search on Vietnam Airlines.
        </p>
      </section>
    );
  }

  if (handoff) {
    return (
      <section className={cardClass(false, true)} aria-label="Vietnam Airlines offers for this route">
        {hasOffer && route.promotion ? (
          <>
            <p className="direct-deal-title">{route.promotion.title}</p>
            <p className="direct-deal-summary direct-deal-summary-clamp">
              {firstSentence(route.promotion.summary, summaryMax)}
            </p>
          </>
        ) : showMiles && miles ? (
          <p className="direct-deal-summary">{milesLine(miles.earnBand)}</p>
        ) : null}
        <p className="direct-value-foot">Illustrative — confirm on Vietnam Airlines when you book.</p>
      </section>
    );
  }

  return (
    <section
      className={cardClass(compact, false)}
      aria-label="Vietnam Airlines offers for this route"
    >
      {hasOffer && route.promotion ? (
        <div className="direct-deal">
          <p className="direct-deal-label">On Vietnam Airlines</p>
          <p className="direct-deal-title">{route.promotion.title}</p>
          <p className="direct-deal-summary">{firstSentence(route.promotion.summary, summaryMax)}</p>
        </div>
      ) : null}

      {showMiles && miles ? <p className="direct-deal-miles">{milesLine(miles.earnBand)}</p> : null}

      <p className="direct-value-foot">Illustrative — confirm eligibility and fares when you book.</p>
    </section>
  );
}
