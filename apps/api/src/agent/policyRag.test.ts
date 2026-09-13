import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildRetrievalQuery,
  isNoiseChunk,
  loadPolicyCorpus,
} from "./policyRag.js";
import type { TripSummary } from "../../../../shared/types.js";

describe("policyRag corpus", () => {
  it("loads data/policy-corpus/vectors.json with the expected shape", () => {
    const corpus = loadPolicyCorpus();
    assert.ok(corpus.chunks.length > 80, "expected 80+ usable chunks after pruning");
    assert.equal(corpus.model, "text-embedding-3-small");

    for (const chunk of corpus.chunks.slice(0, 5)) {
      assert.ok(chunk.sourceUrl.startsWith("https://www.vietnamairlines.com/"));
      assert.ok(Array.isArray(chunk.embedding));
      assert.equal(chunk.embedding.length, corpus.dims);
      assert.ok(chunk.text.length > 0);
    }
  });

  it("covers the baggage and refund topics the product answers from", () => {
    const corpus = loadPolicyCorpus();
    const docIds = new Set(corpus.chunks.map((c) => c.docId));
    for (const expected of [
      "travel-information_baggage_baggage-allowance-checked-baggage",
      "travel-information_baggage_baggage-allowance-hand-baggage",
      "travel-information_baggage_restricted-baggage",
      "buy-tickets-other-products_booking-and-manage-bookings_voluntary-refund-rebook",
    ]) {
      assert.ok(docIds.has(expected), `missing chunks for ${expected}`);
    }
  });

  it("drops the site-chrome chunks that crowded out real passages", () => {
    const corpus = loadPolicyCorpus();
    assert.ok(
      corpus.chunks.every((chunk) => !isNoiseChunk(chunk)),
      "no navigation/footer chunk should survive loading",
    );
    assert.ok(
      isNoiseChunk({
        text: "- Vietnam Airlines - About Us - Our Fleet - Partners & Subsidiaries - Press Room",
      }),
      "the global nav list is noise",
    );
  });

  /**
   * The two fare-conditions pages scraped to pure footer markup — VNA renders
   * their rules behind a JS lookup widget. This asserts the gap stays visible
   * rather than being quietly papered over, so fare-rule answers keep coming
   * from the labelled data/offers/fare-families.json instead.
   */
  it("documents that scraped fare-conditions prose is not available", () => {
    const corpus = loadPolicyCorpus();
    const fareConditionChunks = corpus.chunks.filter((chunk) =>
      chunk.docId.startsWith("buy-tickets-other-products_fare-conditions"),
    );
    assert.ok(
      fareConditionChunks.every(
        (chunk) => !/economy\s+(?:lite|classic|flex)/i.test(chunk.text),
      ),
      "corpus must not appear to hold branded fare rules it never captured",
    );
  });

  it("recovers the Australia checked-baggage heading lost during scraping", () => {
    const corpus = loadPolicyCorpus();
    const australia = corpus.chunks.find(
      (chunk) =>
        chunk.docId === "travel-information_baggage_baggage-allowance-checked-baggage" &&
        /FROM\/TO AUSTRALIA/i.test(chunk.text),
    );
    assert.ok(australia, "the Australia baggage table must be in the corpus");
    assert.match(australia.title, /AUSTRALIA/i);
  });
});

describe("buildRetrievalQuery", () => {
  const trip: TripSummary = {
    originCity: "SYD",
    gateway: "SGN",
    travellers: 2,
    memberProfile: "guest",
  };

  it("returns the bare question without context", () => {
    assert.equal(buildRetrievalQuery("how much baggage?", undefined), "how much baggage?");
  });

  it("names the itinerary so region-specific baggage tables can be found", () => {
    const query = buildRetrievalQuery("what is the baggage on this ticket?", { trip });
    assert.match(query, /Sydney, Australia to Ho Chi Minh City, Vietnam/);
    assert.match(query, /from\/to Australia/i);
  });

  it("adds the cabin when a fare is selected", () => {
    const query = buildRetrievalQuery("baggage?", {
      trip,
      selectedFare: {
        brandId: "business_flex",
        cabin: "business",
        brandLabel: "Business Flex",
        cabinLabel: "Business",
        pricePerAdultAud: 100,
        totalAud: 200,
        currency: "AUD",
        lowest: false,
        perks: [],
        rules: [],
        checkedBaggage: "2 pieces, 32kg each",
        handBaggage: "2 pieces, 18kg total",
        changePolicy: "Free changes",
        refundPolicy: "Refundable",
        milesEarnPct: 250,
        illustrative: true,
        sourceFields: [],
      },
    });
    assert.match(query, /Cabin: Business \(Business Flex fare\)/);
  });
});
