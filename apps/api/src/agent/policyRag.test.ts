import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { loadPolicyCorpus } from "./policyRag.js";

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
