import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  AGENT_ACK_ACTION_TYPES,
  buildAgentAck,
  type AgentAckActionType,
} from "./agentAckTemplates.js";

function sentenceCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/(?<=[.!?])\s+/).filter(Boolean).length;
}

describe("buildAgentAck", () => {
  it("covers every Appendix E action type with ≤2 sentences", () => {
    assert.equal(AGENT_ACK_ACTION_TYPES.length, 8);
    for (const type of AGENT_ACK_ACTION_TYPES) {
      const text = buildAgentAck(type);
      assert.ok(text.length > 0, type);
      assert.ok(sentenceCount(text) <= 2, `${type}: ${text}`);
      assert.ok(!text.includes("```"), type);
      assert.ok(!text.includes("\n\n"), type);
    }
  });

  it("interpolates locality + gateway for showLocality", () => {
    const text = buildAgentAck("showLocality", {
      localityTitle: "Cà Mau",
      gateway: "SGN",
    });
    assert.equal(text, "Cà Mau is reached via SGN.");
    assert.equal(sentenceCount(text), 1);
  });

  it("falls back when locality vars are missing", () => {
    const text = buildAgentAck("showLocality");
    assert.ok(text.includes("gateway"));
  });

  it("rejects unknown action types at the type level via exhaustive keys", () => {
    const sample: AgentAckActionType = "showOffer";
    assert.ok(buildAgentAck(sample).includes("Offer"));
  });
});
