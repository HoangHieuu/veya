import type {
  ApiError,
  RankedResponse,
  RecommendRequest,
  SaveTripRequest,
  SaveTripResponse,
} from "@shared/types";
import { attachMockExperienceHighlights } from "../lib/experienceHighlights";
import { applyMockBriefLocality } from "../lib/mockRecommend";
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

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isMockMode() {
  return useMock;
}
