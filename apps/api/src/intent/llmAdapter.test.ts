import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TripIntent } from "../../../../shared/types.js";
import {
  LLM_GAP_JSON_SCHEMA,
  maybeFillWithLlm,
  resolveOpenAiModel,
  type LlmClient,
} from "./llmAdapter.js";

const baseIntent: TripIntent = {
  originCity: "SYD",
  travelStyles: ["mixed"],
  budgetBand: "standard",
  travellers: 1,
  priority: "lowest_hassle",
  dateWindow: {
    start: "2026-09-11",
    end: "2026-09-18",
    flexibility: "flexible_±3",
  },
  tripDurationDays: 7,
  goal: "discover_destination",
  constraints: { maxStops: 1 },
  rawSummary: "vague trip",
  parseConfidence: 0.6,
  missingFields: ["preferredDestination", "travellers"],
};

describe("LLM_GAP_JSON_SCHEMA", () => {
  it("is a strict gap-fill object schema", () => {
    assert.equal(LLM_GAP_JSON_SCHEMA.type, "object");
    assert.equal(LLM_GAP_JSON_SCHEMA.additionalProperties, false);
    assert.deepEqual(LLM_GAP_JSON_SCHEMA.required, [
      "preferredDestination",
      "travellers",
      "tripDurationDays",
      "rawSummary",
    ]);
    const dest = LLM_GAP_JSON_SCHEMA.properties.preferredDestination;
    assert.ok(
      dest.anyOf.some(
        (branch) =>
          "enum" in branch &&
          Array.isArray(branch.enum) &&
          branch.enum.includes("HAN") &&
          branch.enum.includes("SGN") &&
          branch.enum.includes("DAD"),
      ),
    );
  });
});

describe("maybeFillWithLlm", () => {
  it("returns heuristic intent when disabled", async () => {
    const client: LlmClient = {
      async completeJson() {
        return { preferredDestination: "DAD", travellers: 3 };
      },
    };
    const result = await maybeFillWithLlm(baseIntent, "brief", {
      enabled: false,
      client,
    });
    assert.equal(result.preferredDestination, undefined);
    assert.equal(result.travellers, 1);
  });

  it("fills missing destination and travellers from fake client", async () => {
    const client: LlmClient = {
      async completeJson() {
        return { preferredDestination: "DAD", travellers: 3 };
      },
    };
    const result = await maybeFillWithLlm(baseIntent, "brief", {
      enabled: true,
      client,
    });
    assert.equal(result.preferredDestination, "DAD");
    assert.equal(result.goal, "choose_route");
    assert.equal(result.travellers, 3);
    assert.ok(result.parseConfidence > baseIntent.parseConfidence);
  });

  it("ignores destinations outside whitelist", async () => {
    const client: LlmClient = {
      async completeJson() {
        return { preferredDestination: "CXR" };
      },
    };
    const result = await maybeFillWithLlm(baseIntent, "brief", {
      enabled: true,
      client,
    });
    assert.equal(result.preferredDestination, undefined);
    assert.equal(result.goal, "discover_destination");
  });

  it("falls back on timeout without throwing", async () => {
    const client: LlmClient = {
      async completeJson(_prompt, signal) {
        await new Promise<void>((resolve, reject) => {
          const wait = setTimeout(resolve, 50);
          signal?.addEventListener("abort", () => {
            clearTimeout(wait);
            reject(new Error("aborted"));
          });
        });
        return { preferredDestination: "HAN" };
      },
    };
    const result = await maybeFillWithLlm(baseIntent, "brief", {
      enabled: true,
      client,
      timeoutMs: 5,
    });
    assert.equal(result.preferredDestination, undefined);
  });

  it("keeps missingFields when LLM omits them", async () => {
    const client: LlmClient = {
      async completeJson() {
        return { preferredDestination: "DAD" };
      },
    };
    const result = await maybeFillWithLlm(baseIntent, "brief", {
      enabled: true,
      client,
    });
    assert.equal(result.preferredDestination, "DAD");
    assert.ok(result.missingFields.includes("travellers"));
    assert.ok(!result.missingFields.includes("preferredDestination"));
  });

  it("rebuilds dateWindow.end when tripDurationDays is filled", async () => {
    const intent: TripIntent = {
      ...baseIntent,
      missingFields: ["tripDurationDays"],
    };
    const client: LlmClient = {
      async completeJson() {
        return { tripDurationDays: 10 };
      },
    };
    const result = await maybeFillWithLlm(intent, "brief", {
      enabled: true,
      client,
    });
    assert.equal(result.tripDurationDays, 10);
    assert.equal(result.dateWindow.end, "2026-09-21");
  });

  it("treats null gap fields as no-fill", async () => {
    const client: LlmClient = {
      async completeJson() {
        return {
          preferredDestination: null,
          travellers: null,
          tripDurationDays: null,
          rawSummary: null,
        };
      },
    };
    const result = await maybeFillWithLlm(baseIntent, "brief", {
      enabled: true,
      client,
    });
    assert.equal(result.preferredDestination, undefined);
    assert.equal(result.travellers, 1);
    assert.deepEqual(result.missingFields, baseIntent.missingFields);
  });
});

describe("resolveOpenAiModel", () => {
  it("defaults to gpt-4.1-nano when OPENAI_MODEL is unset", () => {
    const prev = process.env.OPENAI_MODEL;
    delete process.env.OPENAI_MODEL;
    assert.equal(resolveOpenAiModel(), "gpt-4.1-nano");
    if (prev !== undefined) process.env.OPENAI_MODEL = prev;
  });
});
