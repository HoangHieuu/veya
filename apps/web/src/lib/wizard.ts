import type {
  OriginCity,
  PriorityPreset,
  QuizAnswers,
  RecommendRequest,
  TravelStyle,
} from "@shared/types";
import { cityLabel, travelStyleLabel } from "./labels";

export type WizardStepId =
  | "origin"
  | "who"
  | "when"
  | "vibe"
  | "budget"
  | "priority"
  | "review";

export const WIZARD_STEPS: {
  id: WizardStepId;
  title: string;
  subtitle: string;
  vibe: string;
}[] = [
  {
    id: "origin",
    title: "Where will you fly from?",
    subtitle: "Sydney, Melbourne, or Perth — tap yours.",
    vibe: "Let's start somewhere familiar",
  },
  {
    id: "who",
    title: "Who's coming along?",
    subtitle: "Solo trip, date night, or the whole family — all good.",
    vibe: "The more the merrier (or not)",
  },
  {
    id: "when",
    title: "When might you go?",
    subtitle: "Exact dates optional. Rough is perfect.",
    vibe: "No calendar police here",
  },
  {
    id: "vibe",
    title: "What's the vibe?",
    subtitle: "Beach flop, street food crawl, culture — or tell us in your words.",
    vibe: "This is the fun part",
  },
  {
    id: "budget",
    title: "Budget-wise…",
    subtitle: "Ballpark is fine. Live prices come later on VNA.",
    vibe: "No commitment yet",
  },
  {
    id: "priority",
    title: "What matters most?",
    subtitle: "Fewer stops? Family-friendly? Miles? You choose.",
    vibe: "We'll rank routes around this",
  },
  {
    id: "review",
    title: "Sound about right?",
    subtitle: "Tweak anything below, then we'll find your routes.",
    vibe: "Almost time to explore",
  },
];

export interface TripWizardState {
  stepIndex: number;
  /** Highest step the user has reached — keeps cards visible when editing earlier steps. */
  furthestStep: number;
  originCity: OriginCity;
  travellers: number;
  dateFlexibility?: QuizAnswers["dateFlexibility"];
  dateDescribe?: string;
  travelStyle?: TravelStyle;
  vibeDescribe?: string;
  budgetBand?: QuizAnswers["budgetBand"];
  budgetDescribe?: string;
  priority?: PriorityPreset;
  priorityDescribe?: string;
  extraNotes?: string;
}

export const initialWizardState: TripWizardState = {
  stepIndex: 0,
  furthestStep: 0,
  originCity: "SYD",
  travellers: 2,
};

function hasText(value?: string): boolean {
  return Boolean(value?.trim());
}

export function oliviaWizardState(): TripWizardState {
  return {
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
    extraNotes: "",
  };
}

export function canCompleteStep(w: TripWizardState, stepId: WizardStepId): boolean {
  switch (stepId) {
    case "origin":
      return Boolean(w.originCity);
    case "who":
      return w.travellers >= 1;
    case "when":
      return Boolean(w.dateFlexibility) || hasText(w.dateDescribe);
    case "vibe":
      return Boolean(w.travelStyle) || hasText(w.vibeDescribe);
    case "budget":
      return Boolean(w.budgetBand) || hasText(w.budgetDescribe);
    case "priority":
      return Boolean(w.priority) || hasText(w.priorityDescribe);
    case "review":
      return true;
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
  switch (stepId) {
    case "origin":
      return w.originCity ? `${cityLabel(w.originCity)} (${w.originCity})` : null;
    case "who":
      return w.travellers >= 1
        ? `${w.travellers} adult${w.travellers > 1 ? "s" : ""}`
        : null;
    case "when":
      if (hasText(w.dateDescribe)) return w.dateDescribe!.trim();
      if (w.dateFlexibility === "fixed") return "Fixed dates";
      if (w.dateFlexibility === "flexible_±3") return "±3 days flexible";
      if (w.dateFlexibility === "flexible_month") return "Flexible within a month";
      return null;
    case "vibe":
      if (hasText(w.vibeDescribe)) return w.vibeDescribe!.trim();
      return w.travelStyle ? travelStyleLabel(w.travelStyle) : null;
    case "budget":
      if (hasText(w.budgetDescribe)) return w.budgetDescribe!.trim();
      return w.budgetBand
        ? w.budgetBand.charAt(0).toUpperCase() + w.budgetBand.slice(1)
        : null;
    case "priority":
      if (hasText(w.priorityDescribe)) return w.priorityDescribe!.trim();
      return w.priority ? w.priority.replace(/_/g, " ") : null;
    case "review":
      return "Ready to find routes";
    default:
      return null;
  }
}

export function buildRecommendRequest(w: TripWizardState): RecommendRequest {
  const usesDescribe =
    hasText(w.dateDescribe) ||
    hasText(w.vibeDescribe) ||
    hasText(w.budgetDescribe) ||
    hasText(w.priorityDescribe) ||
    hasText(w.extraNotes);

  const quizComplete =
    w.originCity &&
    w.travellers &&
    w.dateFlexibility &&
    w.travelStyle &&
    w.budgetBand &&
    w.priority &&
    !usesDescribe;

  if (quizComplete && !usesDescribe) {
    return {
      mode: "quiz",
      locale: "en",
      quiz: {
        originCity: w.originCity,
        travellers: w.travellers,
        dateFlexibility: w.dateFlexibility!,
        travelStyle: w.travelStyle!,
        budgetBand: w.budgetBand!,
        priority: w.priority!,
      },
    };
  }

  return {
    mode: "brief",
    locale: "en",
    originCity: w.originCity,
    briefText: synthesizeBrief(w),
  };
}

export function synthesizeBrief(w: TripWizardState): string {
  const parts: string[] = [];

  parts.push(`Trip from ${cityLabel(w.originCity)} (${w.originCity})`);
  parts.push(
    `${w.travellers} adult${w.travellers > 1 ? "s" : ""}`,
  );

  if (hasText(w.dateDescribe)) {
    parts.push(`Dates: ${w.dateDescribe!.trim()}`);
  } else if (w.dateFlexibility) {
    const flex =
      w.dateFlexibility === "fixed"
        ? "fixed dates"
        : w.dateFlexibility === "flexible_±3"
          ? "dates flexible within ±3 days"
          : "flexible within a month";
    parts.push(`Date flexibility: ${flex}`);
  }

  if (hasText(w.vibeDescribe)) {
    parts.push(`Trip vibe: ${w.vibeDescribe!.trim()}`);
  } else if (w.travelStyle) {
    parts.push(`Travel style: ${travelStyleLabel(w.travelStyle)}`);
  }

  if (hasText(w.budgetDescribe)) {
    parts.push(`Budget: ${w.budgetDescribe!.trim()}`);
  } else if (w.budgetBand) {
    parts.push(`Budget band: ${w.budgetBand}`);
  }

  if (hasText(w.priorityDescribe)) {
    parts.push(`Priority: ${w.priorityDescribe!.trim()}`);
  } else if (w.priority) {
    parts.push(`Priority: ${w.priority.replace(/_/g, " ")}`);
  }

  if (w.extraNotes?.trim()) {
    parts.push(w.extraNotes.trim());
  }

  return parts.join(". ") + ".";
}

export function wizardSummaryLines(
  w: TripWizardState,
): { label: string; value: string; stepIndex: number }[] {
  return [
    {
      label: "From",
      value: `${cityLabel(w.originCity)} (${w.originCity})`,
      stepIndex: 0,
    },
    {
      label: "Travellers",
      value: `${w.travellers} adult${w.travellers > 1 ? "s" : ""}`,
      stepIndex: 1,
    },
    {
      label: "When",
      value: hasText(w.dateDescribe)
          ? w.dateDescribe!
          : w.dateFlexibility === "fixed"
            ? "Fixed dates"
            : w.dateFlexibility === "flexible_±3"
              ? "±3 days flexible"
              : w.dateFlexibility === "flexible_month"
                ? "Flexible within a month"
                : "—",
      stepIndex: 2,
    },
    {
      label: "Vibe",
      value: hasText(w.vibeDescribe)
          ? w.vibeDescribe!
          : w.travelStyle
            ? travelStyleLabel(w.travelStyle)
            : "—",
      stepIndex: 3,
    },
    {
      label: "Budget",
      value: hasText(w.budgetDescribe)
          ? w.budgetDescribe!
          : w.budgetBand
            ? w.budgetBand.charAt(0).toUpperCase() + w.budgetBand.slice(1)
            : "—",
      stepIndex: 4,
    },
    {
      label: "Priority",
      value: hasText(w.priorityDescribe)
          ? w.priorityDescribe!
          : w.priority
            ? w.priority.replace(/_/g, " ")
            : "—",
      stepIndex: 5,
    },
  ];
}
