import type { QuizAnswers, TripIntent } from "../../../../shared/types.js";

export type DateFlexibility = TripIntent["dateWindow"]["flexibility"];

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
}

export function formatIsoDateUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysUtc(isoDate: string, days: number): string {
  if (!isIsoDate(isoDate)) {
    throw new Error(`Invalid ISO date: ${isoDate}`);
  }
  const [year, month, day] = isoDate.split("-").map(Number);
  const utc = Date.UTC(year, month - 1, day);
  return formatIsoDateUtc(new Date(utc + days * 86_400_000));
}

export function daysBetweenUtc(startIso: string, endIso: string): number {
  if (!isIsoDate(startIso) || !isIsoDate(endIso)) {
    throw new Error(`Invalid ISO date range: ${startIso} → ${endIso}`);
  }
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.round((endMs - startMs) / 86_400_000);
}

/** Invariant for Person D handoff: end = start + tripDurationDays (UTC). */
export function buildDateWindow(
  start: string,
  tripDurationDays: number,
  flexibility: DateFlexibility,
): TripIntent["dateWindow"] {
  return {
    start,
    end: addDaysUtc(start, tripDurationDays),
    flexibility,
  };
}

export function resolveQuizDateWindow(
  quiz: Pick<
    QuizAnswers,
    "dateFlexibility" | "departAfter" | "departBefore"
  >,
  now: Date,
  defaultDurationDays: number,
): {
  dateWindow: TripIntent["dateWindow"];
  tripDurationDays: number;
  missingDateFields: string[];
} {
  const flexibility = quiz.dateFlexibility;
  const missingDateFields: string[] = [];
  const after =
    quiz.departAfter && isIsoDate(quiz.departAfter) ? quiz.departAfter : null;
  const before =
    quiz.departBefore && isIsoDate(quiz.departBefore)
      ? quiz.departBefore
      : null;

  if (quiz.departAfter && !after) missingDateFields.push("departAfter");
  if (quiz.departBefore && !before) missingDateFields.push("departBefore");

  if (after && before) {
    const span = daysBetweenUtc(after, before);
    if (span <= 0) {
      missingDateFields.push("departAfter", "departBefore");
      const start = formatIsoDateUtc(now);
      return {
        dateWindow: buildDateWindow(start, defaultDurationDays, flexibility),
        tripDurationDays: defaultDurationDays,
        missingDateFields,
      };
    }
    return {
      dateWindow: buildDateWindow(after, span, flexibility),
      tripDurationDays: span,
      missingDateFields,
    };
  }

  if (after) {
    if (!before) missingDateFields.push("departBefore");
    return {
      dateWindow: buildDateWindow(after, defaultDurationDays, flexibility),
      tripDurationDays: defaultDurationDays,
      missingDateFields,
    };
  }

  if (before) {
    missingDateFields.push("departAfter");
    const start = addDaysUtc(before, -defaultDurationDays);
    return {
      dateWindow: buildDateWindow(start, defaultDurationDays, flexibility),
      tripDurationDays: defaultDurationDays,
      missingDateFields,
    };
  }

  missingDateFields.push("departAfter", "departBefore");
  const start = formatIsoDateUtc(now);
  return {
    dateWindow: buildDateWindow(start, defaultDurationDays, flexibility),
    tripDurationDays: defaultDurationDays,
    missingDateFields,
  };
}
