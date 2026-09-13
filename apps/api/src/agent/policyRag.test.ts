import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  answerPolicyQuestion,
  choosePolicyAnswer,
  hasCitationMarkers,
  loadPolicyCorpus,
  type PolicyChunk,
  type PolicyMatch,
} from "./policyRag.js";

function stubMatch(text: string, index: number): PolicyMatch {
  const chunk: PolicyChunk = {
    id: `stub-${index}`,
    docId: "stub-doc",
    docTitle: "Stub Policy",
    breadcrumb: ["Baggage"],
    title: `Chunk ${index}`,
    text,
    sourceUrl: "https://www.vietnamairlines.com/stub",
    capturedAt: "2026-01-01",
    embedding: [],
  };
  return { chunk, score: 0.9 };
}

describe("policyRag corpus", () => {
  it("loads data/policy-corpus/vectors.json with the expected shape", () => {
    const corpus = loadPolicyCorpus();
    assert.ok(corpus.chunks.length > 100, "expected 100+ chunks from the 20-page scrape");
    assert.equal(corpus.model, "text-embedding-3-small");

    for (const chunk of corpus.chunks.slice(0, 5)) {
      assert.ok(chunk.sourceUrl.startsWith("https://www.vietnamairlines.com/"));
      assert.ok(Array.isArray(chunk.embedding));
      assert.equal(chunk.embedding.length, corpus.dims);
      assert.ok(chunk.text.length > 0);
    }
  });

  it("covers the baggage and fare-conditions topics the product needs", () => {
    const corpus = loadPolicyCorpus();
    const docIds = new Set(corpus.chunks.map((c) => c.docId));
    for (const expected of [
      "travel-information_baggage_baggage-allowance-checked-baggage",
      "travel-information_baggage_baggage-allowance-hand-baggage",
      "travel-information_baggage_restricted-baggage",
      "buy-tickets-other-products_fare-conditions",
      "buy-tickets-other-products_booking-and-manage-bookings_voluntary-refund-rebook",
    ]) {
      assert.ok(docIds.has(expected), `missing chunks for ${expected}`);
    }
  });
});

describe("policyRag ask outcomes", () => {
  it("requires every [n] cite in range", () => {
    assert.equal(hasCitationMarkers("See [1] for bags.", 2), true);
    assert.equal(hasCitationMarkers("See [1] and [2].", 2), true);
    assert.equal(hasCitationMarkers("See [1] and [3].", 2), false);
    assert.equal(hasCitationMarkers("See [3] for bags.", 2), false);
    assert.equal(hasCitationMarkers("No citations here.", 2), false);
    assert.equal(hasCitationMarkers("", 2), false);
  });

  it("falls back to verbatim excerpts when synthesis has no valid cites", () => {
    const matches = [
      stubMatch("Checked bags: 23kg economy.", 1),
      stubMatch("Hand bags: 7kg.", 2),
    ];
    const uncited = choosePolicyAnswer(matches, "Economy allows 23kg.");
    assert.equal(uncited.grounded, true);
    assert.match(uncited.answer, /Checked bags/);
    assert.equal(uncited.sources.length, 2);

    const cited = choosePolicyAnswer(matches, "Economy allows 23kg (see [1]).");
    assert.equal(cited.grounded, true);
    assert.equal(cited.answer, "Economy allows 23kg (see [1]).");
  });

  it("returns openai_unavailable when API key is missing", async () => {
    const outcome = await answerPolicyQuestion("How much checked baggage?", undefined);
    assert.equal(outcome.status, "openai_unavailable");
    if (outcome.status === "openai_unavailable") {
      assert.match(outcome.message, /OPENAI_API_KEY/i);
    }
  });

  it("returns empty_question for blank input", async () => {
    const outcome = await answerPolicyQuestion("   ", "sk-test");
    assert.equal(outcome.status, "empty_question");
  });
});
