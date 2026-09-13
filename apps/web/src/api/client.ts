import type {
  ApiError,
  CreateRecoverySessionRequest,
  RankedResponse,
  RecommendRequest,
  RecoverySessionResponse,
  RecoverySessionStatus,
  SaveTripRequest,
  SaveTripResponse,
} from "@shared/types";
import { attachMockExperienceHighlights } from "../lib/experienceHighlights";
import { cityLabel } from "../lib/labels";
import { applyMockBriefLocality } from "../lib/mockRecommend";
import { buildFallbackNudge } from "../lib/recoveryNudge";
import mockOlivia from "../mocks/rankedResponse.olivia.json";

const useMock = import.meta.env.VITE_USE_MOCK !== "false";
const apiBase = import.meta.env.VITE_API_BASE ?? "";

export class ApiClientError extends Error {
  errorCode: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "ApiClientError";
    this.errorCode = error.errorCode;
  }
}

async function parseError(res: Response): Promise<never> {
  let body: ApiError = {
    errorCode: "UNKNOWN",
    message: `Request failed (${res.status})`,
  };
  try {
    body = (await res.json()) as ApiError;
  } catch {
    /* keep default */
  }
  throw new ApiClientError(body);
}

export async function recommend(
  request: RecommendRequest,
): Promise<RankedResponse> {
  if (useMock) {
    await delay(900);
    const data = structuredClone(mockOlivia) as RankedResponse;
    if (request.priorityOverride) {
      data.intent = {
        ...data.intent,
        ...(request.cachedIntent ?? {}),
        priority: request.priorityOverride,
      };
      // Stable mock: lightly reshuffle labels only — real re-rank is Person D.
    }
    if (request.mode === "quiz" && request.quiz) {
      data.intent.originCity = request.quiz.originCity;
      data.intent.travellers = request.quiz.travellers;
      data.intent.budgetBand = request.quiz.budgetBand;
      data.intent.priority = request.priorityOverride ?? request.quiz.priority;
    }
    if (request.mode === "brief" && request.briefText) {
      data.intent.rawSummary = request.briefText.slice(0, 180);
    }
    if (request.originCity) {
      data.intent.originCity = request.originCity;
    }
    if (request.mode === "brief" && request.briefText?.includes("Melbourne")) {
      data.intent.originCity = "MEL";
    }
    if (request.mode === "brief" && request.briefText?.includes("Perth")) {
      data.intent.originCity = "PER";
    }
    if (request.mode === "brief" && request.briefText) {
      applyMockBriefLocality(data, request.briefText);
    }
    attachMockExperienceHighlights(data);
    return data;
  }

  const res = await fetch(`${apiBase}/api/recommend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as RankedResponse;
}

export async function saveTrip(
  request: SaveTripRequest,
): Promise<SaveTripResponse> {
  if (useMock) {
    await delay(400);
    return {
      saveId: `save-mock-${Date.now()}`,
      remindAfterHours: 24,
      status: "saved",
    };
  }

  const res = await fetch(`${apiBase}/api/trips/save`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as SaveTripResponse;
}

export async function createRecoverySession(
  request: CreateRecoverySessionRequest,
): Promise<RecoverySessionResponse> {
  if (useMock) {
    await delay(250);
    const destCode = request.routeId.split("-")[1] ?? "DAD";
    const dest = cityLabel(destCode as "HAN" | "SGN" | "DAD");
    const nudge = buildFallbackNudge({
      itineraryLine: `${request.intent.originCity} → ${destCode} (${dest}) · ${request.intent.dateWindow.start}–${request.intent.dateWindow.end} · ${request.intent.travellers} adults`,
      whyGateway: request.reasons?.slice(0, 2) ?? [
        request.tripOutline?.split(/(?<=[.!?])\s+/)[0]?.trim() ||
          `Keep your ${dest} gateway sketch and finish on VNA.`,
      ],
      loyaltyLine: "Illustrative Lotusmiles — confirm earn band at checkout.",
    });
    return {
      sessionId: `rec-mock-${Date.now()}`,
      status: "active",
      createdAt: new Date().toISOString(),
      nudge,
      mockTimeline: [
        {
          atHours: 0,
          subject: "Your Vietnam gateway sketch is ready",
          body: nudge.itineraryLine,
          ctaLabel: "Resume on Veya",
        },
        {
          atHours: 1,
          subject: `Still thinking about ${dest}?`,
          body: "Gentle reminder: resume your trip sketch when ready.",
          ctaLabel: "Resume trip sketch",
        },
        {
          atHours: 24,
          subject: "Why book this direct on Vietnam Airlines",
          body: nudge.directValueLines.join(" "),
          ctaLabel: "Open pre-filled VNA search",
        },
      ],
      resume: {
        requestId: request.requestId,
        routeId: request.routeId,
        intent: request.intent,
        screen: request.screen,
      },
      remindAfterHours: 24,
    };
  }

  const res = await fetch(`${apiBase}/api/recovery/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as RecoverySessionResponse;
}

export async function updateRecoverySessionStatus(
  sessionId: string,
  status: RecoverySessionStatus,
): Promise<RecoverySessionResponse> {
  if (useMock) {
    await delay(100);
    return {
      sessionId,
      status,
      createdAt: new Date().toISOString(),
      nudge: buildFallbackNudge({
        itineraryLine: "Mock session",
        whyGateway: ["Mock recovery status update."],
      }),
      mockTimeline: [],
      resume: {
        requestId: "mock",
        routeId: "mock",
        intent: (structuredClone(mockOlivia) as RankedResponse).intent,
        screen: "results",
      },
      remindAfterHours: 24,
    };
  }

  const res = await fetch(`${apiBase}/api/recovery/sessions/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as RecoverySessionResponse;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMockMode() {
  return useMock;
}
