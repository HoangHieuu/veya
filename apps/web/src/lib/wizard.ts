import type {

  BudgetBand,

  OriginCity,

  PriorityPreset,

  QuizAnswers,

  RecommendRequest,

  TravelStyle,

} from "@shared/types";

import {

  budgetLabel,

  cityLabel,

  dateFlexLabel,

  priorityLabel,

  travelStyleLabel,

} from "./labels";



export type WizardStepId = "origin" | "vibe" | "details";



export const WIZARD_STEPS: {

  id: WizardStepId;

  title: string;

  subtitle: string;

}[] = [

  {

    id: "origin",

    title: "Where will you fly from?",

    subtitle: "Sydney, Melbourne, or Perth — one tap.",

  },

  {

    id: "vibe",

    title: "What kind of trip?",

    subtitle: "We'll match Hanoi, Saigon, or Da Nang — and nearby spots.",

  },

  {

    id: "details",

    title: "When & who's going?",

    subtitle: "Rough is fine. Live prices come later on VNA.",

  },

];



export interface TripWizardState {

  stepIndex: number;

  furthestStep: number;

  originCity: OriginCity;

  travellers: number;

  dateFlexibility?: QuizAnswers["dateFlexibility"];

  dateDescribe?: string;

  travelStyle?: TravelStyle;

  vibeDescribe?: string;

  budgetBand?: QuizAnswers["budgetBand"];

  priority?: PriorityPreset;

  extraNotes?: string;

  showAdvanced?: boolean;

}



export const initialWizardState: TripWizardState = {

  stepIndex: 0,

  furthestStep: 0,

  originCity: "SYD",

  travellers: 2,

  dateFlexibility: "flexible_±3",

};



function hasText(value?: string): boolean {

  return Boolean(value?.trim());

}



export type DemoPersona = "olivia" | "vfr" | "student";



export function inferPriorityFromStyle(style: TravelStyle): PriorityPreset {

  switch (style) {

    case "beach_relaxation":

      return "lowest_hassle";

    case "family":

    case "vfr":

      return "best_for_family";

    case "food_culture":

    case "education":

      return "food_and_culture";

    default:

      return "lowest_hassle";

  }

}



export function inferBudgetFromStyle(

  style: TravelStyle,

  origin: OriginCity,

): BudgetBand {

  if (style === "education" || origin === "PER") return "budget";

  return "standard";

}



export function withWizardDefaults(w: TripWizardState): TripWizardState {

  const travelStyle = w.travelStyle;

  return {

    ...w,

    dateFlexibility: w.dateFlexibility ?? "flexible_±3",

    budgetBand:

      w.budgetBand ??

      (travelStyle ? inferBudgetFromStyle(travelStyle, w.originCity) : "standard"),

    priority:

      w.priority ??

      (travelStyle ? inferPriorityFromStyle(travelStyle) : "lowest_hassle"),

  };

}



export function oliviaWizardState(): TripWizardState {

  return withWizardDefaults({

    stepIndex: WIZARD_STEPS.length - 1,

    furthestStep: WIZARD_STEPS.length - 1,

    originCity: "SYD",

    travellers: 2,

    dateFlexibility: "flexible_±3",

    dateDescribe: "8–10 days in mid-November",

    travelStyle: "beach_relaxation",

    vibeDescribe: "Beach-and-food trip with a friend — low hassle, few connections.",

    budgetBand: "standard",

    priority: "lowest_hassle",

  });

}



export function vfrWizardState(): TripWizardState {

  return withWizardDefaults({

    stepIndex: WIZARD_STEPS.length - 1,

    furthestStep: WIZARD_STEPS.length - 1,

    originCity: "MEL",

    travellers: 4,

    dateFlexibility: "flexible_±3",

    dateDescribe: "Visiting family in Hanoi, ±3 days flexible",

    travelStyle: "vfr",

    vibeDescribe: "Family visit with kids — one stop max, prefer direct if possible.",

    budgetBand: "standard",

    priority: "best_for_family",

    extraNotes: "Need stroller-friendly airports where possible.",

  });

}



export function studentWizardState(): TripWizardState {

  return withWizardDefaults({

    stepIndex: WIZARD_STEPS.length - 1,

    furthestStep: WIZARD_STEPS.length - 1,

    originCity: "PER",

    travellers: 1,

    dateFlexibility: "flexible_month",

    dateDescribe: "Long weekend in the next month",

    travelStyle: "food_culture",

    vibeDescribe: "Food-focused solo trip, budget-conscious, happy with one stop.",

    budgetBand: "budget",

    priority: "food_and_culture",

  });

}



export function demoWizardState(persona: DemoPersona): TripWizardState {

  switch (persona) {

    case "vfr":

      return vfrWizardState();

    case "student":

      return studentWizardState();

    default:

      return oliviaWizardState();

  }

}



export function canCompleteStep(w: TripWizardState, stepId: WizardStepId): boolean {

  switch (stepId) {

    case "origin":

      return Boolean(w.originCity);

    case "vibe":

      return Boolean(w.travelStyle) || hasText(w.vibeDescribe);

    case "details":

      return (Boolean(w.dateFlexibility) || hasText(w.dateDescribe)) && w.travellers >= 1;

    default:

      return false;

  }

}



export function canAdvanceWizard(w: TripWizardState): boolean {

  const step = WIZARD_STEPS[w.stepIndex]?.id;

  return step ? canCompleteStep(w, step) : false;

}



export function wizardStepSummary(

  w: TripWizardState,

  stepId: WizardStepId,

): string | null {

  const resolved = withWizardDefaults(w);

  switch (stepId) {

    case "origin":

      return w.originCity ? `${cityLabel(w.originCity)} (${w.originCity})` : null;

    case "vibe":

      if (hasText(w.vibeDescribe)) return w.vibeDescribe!.trim();

      return w.travelStyle ? travelStyleLabel(w.travelStyle) : null;

    case "details": {

      const when = hasText(w.dateDescribe)

        ? w.dateDescribe!.trim()

        : dateFlexLabel(resolved.dateFlexibility);

      const who = `${w.travellers} adult${w.travellers > 1 ? "s" : ""}`;

      return `${when} · ${who}`;

    }

    default:

      return null;

  }

}



export function wizardTripSummary(w: TripWizardState): string {

  const resolved = withWizardDefaults(w);

  const parts = [

    cityLabel(resolved.originCity),

    resolved.travelStyle

      ? travelStyleLabel(resolved.travelStyle)

      : hasText(w.vibeDescribe)

        ? "Custom trip"

        : null,

    hasText(w.dateDescribe)

      ? w.dateDescribe!.trim()

      : dateFlexLabel(resolved.dateFlexibility),

    `${resolved.travellers} adult${resolved.travellers > 1 ? "s" : ""}`,

  ].filter(Boolean);

  return parts.join(" · ");

}



export function buildRecommendRequest(w: TripWizardState): RecommendRequest {

  const resolved = withWizardDefaults(w);

  const usesDescribe =

    hasText(resolved.dateDescribe) ||

    hasText(resolved.vibeDescribe) ||

    hasText(resolved.extraNotes);



  const quizComplete =

    resolved.originCity &&

    resolved.travellers &&

    resolved.dateFlexibility &&

    resolved.travelStyle &&

    resolved.budgetBand &&

    resolved.priority &&

    !usesDescribe;



  if (quizComplete && !usesDescribe) {

    return {

      mode: "quiz",

      locale: "en",

      quiz: {

        originCity: resolved.originCity,

        travellers: resolved.travellers,

        dateFlexibility: resolved.dateFlexibility!,

        travelStyle: resolved.travelStyle!,

        budgetBand: resolved.budgetBand!,

        priority: resolved.priority!,

      },

    };

  }



  return {

    mode: "brief",

    locale: "en",

    originCity: resolved.originCity,

    briefText: synthesizeBrief(resolved),

  };

}



export function synthesizeBrief(w: TripWizardState): string {

  const resolved = withWizardDefaults(w);

  const parts: string[] = [];



  parts.push(`Trip from ${cityLabel(resolved.originCity)} (${resolved.originCity})`);

  parts.push(

    `${resolved.travellers} adult${resolved.travellers > 1 ? "s" : ""}`,

  );



  if (hasText(resolved.dateDescribe)) {

    parts.push(`Dates: ${resolved.dateDescribe!.trim()}`);

  } else if (resolved.dateFlexibility) {

    const flex =

      resolved.dateFlexibility === "fixed"

        ? "fixed dates"

        : resolved.dateFlexibility === "flexible_±3"

          ? "dates flexible within ±3 days"

          : "flexible within a month";

    parts.push(`Date flexibility: ${flex}`);

  }



  if (hasText(resolved.vibeDescribe)) {

    parts.push(`Trip vibe: ${resolved.vibeDescribe!.trim()}`);

  } else if (resolved.travelStyle) {

    parts.push(`Travel style: ${travelStyleLabel(resolved.travelStyle)}`);

  }



  parts.push(`Budget band: ${budgetLabel(resolved.budgetBand!)}`);

  parts.push(`Priority: ${priorityLabel(resolved.priority!)}`);



  if (resolved.extraNotes?.trim()) {

    parts.push(resolved.extraNotes.trim());

  }



  return parts.join(". ") + ".";

}



export function wizardSummaryLines(

  w: TripWizardState,

): { label: string; value: string; stepIndex: number }[] {

  const resolved = withWizardDefaults(w);

  return [

    {

      label: "From",

      value: `${cityLabel(resolved.originCity)} (${resolved.originCity})`,

      stepIndex: 0,

    },

    {

      label: "Trip",

      value: hasText(w.vibeDescribe)

        ? w.vibeDescribe!

        : resolved.travelStyle

          ? travelStyleLabel(resolved.travelStyle)

          : "—",

      stepIndex: 1,

    },

    {

      label: "When",

      value: hasText(w.dateDescribe)

        ? w.dateDescribe!

        : dateFlexLabel(resolved.dateFlexibility),

      stepIndex: 2,

    },

    {

      label: "Travellers",

      value: `${resolved.travellers} adult${resolved.travellers > 1 ? "s" : ""}`,

      stepIndex: 2,

    },

  ];

}
