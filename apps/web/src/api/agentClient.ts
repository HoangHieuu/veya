import type {
  AgentTurnRequest,
  AgentTurnResponse,
  ApiError,
  PolicyAnswer,
  TripSummary,
} from "@shared/types";
import { ApiClientError } from "./client";

const apiBase = import.meta.env.VITE_API_BASE ?? "";

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

/**
 * One conversational turn. The server owns the stage machine and returns the
 * centre-panel content to render, so the UI never re-derives the journey.
 */
export async function agentTurn(
  request: AgentTurnRequest,
): Promise<AgentTurnResponse> {
  const res = await fetch(`${apiBase}/api/agent/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!res.ok) await parseError(res);
  return (await res.json()) as AgentTurnResponse;
}

/** Standalone policy lookup, for the chat's suggested-question chips. */
export async function policyAsk(
  question: string,
  trip?: TripSummary,
): Promise<PolicyAnswer> {
  const res = await fetch(`${apiBase}/api/policy/ask`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ question, ...(trip ? { trip } : {}) }),
  });
  if (!res.ok) await parseError(res);
  const body = (await res.json()) as {
    answered: boolean;
    answer?: string;
    grounded?: boolean;
    sources?: PolicyAnswer["sources"];
  };
  return {
    answered: body.answered,
    answer: body.answer ?? "",
    grounded: body.grounded ?? false,
    sources: body.sources ?? [],
  };
}
