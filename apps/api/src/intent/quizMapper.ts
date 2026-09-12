import type {
  PriorityPreset,
  QuizAnswers,
  TripIntent,
  TravelStyle,
} from "../../../../shared/types.js";
import {
  COMPANION_TRAVEL_STYLES,
  DEFAULT_TRIP_DURATION_DAYS,
  PRIORITY_MAX_STOPS,
  QUIZ_MAX_TRAVEL_STYLES,
} from "./constants.js";
import { resolveQuizDateWindow } from "./dateWindow.js";

function expandTravelStyles(style: TravelStyle): TravelStyle[] {
  return COMPANION_TRAVEL_STYLES[style].slice(0, QUIZ_MAX_TRAVEL_STYLES);
}

function buildRawSummary(quiz: QuizAnswers, priority: PriorityPreset): string {
  return [
    `${quiz.travelStyle} trip from ${quiz.originCity}`,
    `${quiz.travellers} traveller${quiz.travellers === 1 ? "" : "s"}`,
    `budget ${quiz.budgetBand}`,
    `priority ${priority}`,
    `dates ${quiz.dateFlexibility}`,
  ].join("; ");
}

export function mapQuizToTripIntent(
  quiz: QuizAnswers,
  options: {
    now?: Date;
    priorityOverride?: PriorityPreset;
  } = {},
): TripIntent {
  const now = options.now ?? new Date();
  const priority = options.priorityOverride ?? quiz.priority;
  const { dateWindow, tripDurationDays, missingDateFields } =
    resolveQuizDateWindow(quiz, now, DEFAULT_TRIP_DURATION_DAYS);

  return {
    originCity: quiz.originCity,
    travelStyles: expandTravelStyles(quiz.travelStyle),
    budgetBand: quiz.budgetBand,
    travellers: quiz.travellers,
    priority,
    dateWindow,
    tripDurationDays,
    goal: "discover_destination",
    constraints: {
      maxStops: PRIORITY_MAX_STOPS[priority],
    },
    rawSummary: buildRawSummary(quiz, priority),
    parseConfidence: 1,
    missingFields: missingDateFields,
  };
}
