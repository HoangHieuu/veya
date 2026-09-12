import type { TripIntent } from "../../../../shared/types.js";
import { DESTINATION_CITIES } from "./constants.js";
import { buildDateWindow } from "./dateWindow.js";
import { validateTripIntent } from "./schema.js";

export interface LlmClient {
  completeJson(prompt: string, signal?: AbortSignal): Promise<unknown>;
}

export interface LlmFillOptions {
  enabled: boolean;
  client?: LlmClient;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 1_200;
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_OPENAI_MODEL = "gpt-4.1-nano";

/** Fast nano models preferred for brief gap-fill (override via OPENAI_MODEL). */
export function resolveOpenAiModel(): string {
  const configured = process.env.OPENAI_MODEL?.trim();
  return configured || DEFAULT_OPENAI_MODEL;
}

/**
 * Strict Structured Outputs schema for gap-fill only.
 * Hand-written (no zod-to-json-schema / openai SDK). Null = leave heuristic.
 */
export const LLM_GAP_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "preferredDestination",
    "travellers",
    "tripDurationDays",
    "rawSummary",
  ],
  properties: {
    preferredDestination: {
      anyOf: [
        { type: "string", enum: ["HAN", "SGN", "DAD"] },
        { type: "null" },
      ],
    },
    travellers: {
      anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
    },
    tripDurationDays: {
      anyOf: [{ type: "integer", minimum: 1 }, { type: "null" }],
    },
    rawSummary: {
      anyOf: [{ type: "string", minLength: 1 }, { type: "null" }],
    },
  },
} as const;

function isLlmEnabledByEnv(): boolean {
  return (
    process.env.INTENT_LLM_ENABLED === "true" &&
    Boolean(process.env.OPENAI_API_KEY?.trim())
  );
}

function clampDestination(value: unknown): TripIntent["preferredDestination"] {
  if (
    typeof value === "string" &&
    (DESTINATION_CITIES as readonly string[]).includes(value)
  ) {
    return value as TripIntent["preferredDestination"];
  }
  return undefined;
}

/** Default OpenAI JSON client via global fetch (Node 18+). No extra npm dep. */
export function createOpenAiJsonClient(apiKey: string): LlmClient {
  return {
    async completeJson(prompt: string, signal?: AbortSignal): Promise<unknown> {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: resolveOpenAiModel(),
          temperature: 0,
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "trip_intent_gaps",
              strict: true,
              schema: LLM_GAP_JSON_SCHEMA,
            },
          },
          messages: [
            {
              role: "system",
              content:
                "Fill only missing TripIntent fields. Use null when unknown. Destinations must be HAN, SGN, or DAD.",
            },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (!res.ok) {
        throw new Error(`OpenAI HTTP ${res.status}`);
      }
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("OpenAI empty content");
      return JSON.parse(content) as unknown;
    },
  };
}

function resolveClient(options: LlmFillOptions): LlmClient | undefined {
  if (options.client) return options.client;
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return undefined;
  return createOpenAiJsonClient(key);
}

/**
 * Merge LLM suggestions only into fields listed in missingFields.
 * Never invent destinations outside HAN/SGN/DAD. On any failure, return heuristic intent.
 */
export async function maybeFillWithLlm(
  intent: TripIntent,
  briefText: string,
  options: LlmFillOptions,
): Promise<TripIntent> {
  if (!options.enabled) return intent;
  const client = resolveClient(options);
  if (!client) return intent;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  let partial: unknown;
  try {
    partial = await client.completeJson(
      `Fill missing trip intent fields as JSON. Brief: ${briefText}. Missing: ${intent.missingFields.join(", ")}`,
      abort.signal,
    );
  } catch {
    return intent;
  } finally {
    clearTimeout(timer);
  }

  if (!partial || typeof partial !== "object") return intent;
  const patch = partial as Record<string, unknown>;
  const next: TripIntent = {
    ...intent,
    constraints: { ...intent.constraints },
    missingFields: [...intent.missingFields],
  };

  const filled = new Set<string>();

  if (
    intent.missingFields.includes("preferredDestination") &&
    "preferredDestination" in patch
  ) {
    const dest = clampDestination(patch.preferredDestination);
    if (dest) {
      next.preferredDestination = dest;
      next.goal = "choose_route";
      filled.add("preferredDestination");
    }
  }

  if (
    intent.missingFields.includes("travellers") &&
    typeof patch.travellers === "number" &&
    Number.isFinite(patch.travellers)
  ) {
    next.travellers = Math.max(1, Math.floor(patch.travellers));
    filled.add("travellers");
  }

  if (
    intent.missingFields.includes("tripDurationDays") &&
    typeof patch.tripDurationDays === "number" &&
    Number.isFinite(patch.tripDurationDays)
  ) {
    next.tripDurationDays = Math.max(1, Math.floor(patch.tripDurationDays));
    next.dateWindow = buildDateWindow(
      intent.dateWindow.start,
      next.tripDurationDays,
      intent.dateWindow.flexibility,
    );
    filled.add("tripDurationDays");
  }

  if (
    intent.missingFields.includes("rawSummary") &&
    typeof patch.rawSummary === "string" &&
    patch.rawSummary.trim()
  ) {
    next.rawSummary = patch.rawSummary.trim();
    filled.add("rawSummary");
  }

  next.missingFields = intent.missingFields.filter((field) => !filled.has(field));

  if (filled.size > 0) {
    next.parseConfidence = Math.min(1, intent.parseConfidence + 0.05);
  }

  const validated = validateTripIntent(next);
  return validated.ok ? validated.intent : intent;
}

export function shouldUseLlm(options?: { force?: boolean }): boolean {
  if (options?.force === false) return false;
  if (options?.force === true) return true;
  return isLlmEnabledByEnv();
}
