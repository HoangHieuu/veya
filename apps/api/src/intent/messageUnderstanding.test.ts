import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { TripSummary } from "../../../../shared/types.js";
import {
  extractDates,
  understandDeterministically,
  understandMessage,
} from "./messageUnderstanding.js";

const NOW = new Date("2026-09-13T00:00:00.000Z");
const OFFLINE = { now: NOW, llmEnabled: false as const };

function trip(overrides: Partial<TripSummary> = {}): TripSummary {
  return { memberProfile: "guest", ...overrides };
}

describe("understandDeterministically — reading a first brief", () => {
  it("reads origin, style, travellers and destination from one sentence", () => {
    const result = understandDeterministically(
      "Melbourne, visiting family in Cà Mau, 2 adults",
      trip(),
      NOW,
    );
    assert.equal(result.intent, "update_trip");
    assert.equal(result.patch.originCity, "MEL");
    assert.equal(result.patch.travellers, 2);
    assert.equal(result.patch.gateway, "SGN");
  });

  it("treats a bare greeting as smalltalk, not a trip", () => {
    const result = understandDeterministically("hello", trip(), NOW);
    assert.equal(result.intent, "smalltalk");
    assert.deepEqual(result.patch, {});
  });
});

describe("understandDeterministically — corrections", () => {
  it("overwrites an origin the traveller already set", () => {
    const result = understandDeterministically(
      "actually I want to fly from Perth instead",
      trip({ originCity: "SYD" }),
      NOW,
    );
    assert.equal(result.intent, "change_trip");
    assert.equal(result.patch.originCity, "PER");
  });

  it("overwrites the destination and its gateway", () => {
    const result = understandDeterministically(
      "change it to Hanoi",
      trip({ destinationLocalityId: "dad", destinationTitle: "Da Nang", gateway: "DAD" }),
      NOW,
    );
    assert.equal(result.intent, "change_trip");
    assert.equal(result.patch.gateway, "HAN");
  });

  it("clears the dates when asked to forget them", () => {
    const result = understandDeterministically(
      "clear my dates please",
      trip({ departDate: "2026-04-12", returnDate: "2026-04-26", departMonth: "April" }),
      NOW,
    );
    assert.equal(result.patch.departDate, null);
    assert.equal(result.patch.returnDate, null);
    assert.equal(result.patch.departMonth, null);
  });

  it("flags a change even when only the value differs", () => {
    const result = understandDeterministically("4 adults", trip({ travellers: 2 }), NOW);
    assert.equal(result.intent, "change_trip");
    assert.equal(result.patch.travellers, 4);
  });
});

describe("understandDeterministically — policy questions", () => {
  it("routes a baggage question away from the trip patcher", () => {
    const result = understandDeterministically(
      "how much checked baggage do I get on this ticket?",
      trip({ originCity: "SYD", gateway: "SGN" }),
      NOW,
    );
    assert.equal(result.intent, "policy_question");
    assert.deepEqual(result.patch, {});
    assert.ok(result.policyQuestion);
  });

  it("handles the Vietnamese phrasing", () => {
    const result = understandDeterministically(
      "cho mình hỏi hành lý ký gửi được bao nhiêu kg?",
      trip(),
      NOW,
    );
    assert.equal(result.intent, "policy_question");
  });

  it("does not mistake a trip detail for a rules question", () => {
    const result = understandDeterministically(
      "family of 4 flying from Sydney in April",
      trip(),
      NOW,
    );
    assert.equal(result.intent, "update_trip");
  });
});

describe("understandDeterministically — fares and reset", () => {
  it("reads a fare choice", () => {
    const result = understandDeterministically(
      "I'll take Economy Flex",
      trip({ originCity: "SYD" }),
      NOW,
    );
    assert.equal(result.intent, "select_fare");
    assert.equal(result.fareBrandId, "economy_flex");
  });

  it("distinguishes Business Flex from Business Classic", () => {
    const result = understandDeterministically("choose business flex", trip(), NOW);
    assert.equal(result.fareBrandId, "business_flex");
  });

  it("reads a fare choice with no verb at all", () => {
    const result = understandDeterministically("Economy Lite please", trip(), NOW);
    assert.equal(result.intent, "select_fare");
    assert.equal(result.fareBrandId, "economy_lite");
  });

  it("treats a question about a brand as a policy question, not a choice", () => {
    const result = understandDeterministically(
      "what baggage does Business Flex include?",
      trip({ fareBrandId: "economy_lite" }),
      NOW,
    );
    assert.equal(result.intent, "policy_question");
    assert.equal(result.patch.fareBrandId, undefined);
  });

  it("recognises a restart", () => {
    assert.equal(
      understandDeterministically("let's start over", trip({ originCity: "SYD" }), NOW).intent,
      "reset",
    );
  });
});

describe("understandDeterministically — Vietnamese place names", () => {
  it("resolves the accented spelling to the same gateway and id as the plain one", () => {
    const accented = understandDeterministically("I want to go to Đà Nẵng", trip(), NOW);
    const plain = understandDeterministically("I want to go to Da Nang", trip(), NOW);
    assert.equal(accented.patch.gateway, "DAD");
    assert.equal(
      accented.patch.destinationLocalityId,
      plain.patch.destinationLocalityId,
      "the two spellings must not read as two different destinations",
    );
  });

  it("keeps diacritics out of every locality id it derives", () => {
    for (const [text, expected] of [
      ["visiting family in Cà Mau", "ca-mau"],
      ["a few days in Hội An", "hoi-an"],
    ] as const) {
      const result = understandDeterministically(text, trip(), NOW);
      assert.equal(result.patch.destinationLocalityId, expected, text);
    }
  });
});

describe("extractDates", () => {
  it("reads an explicit ISO range", () => {
    const patch = extractDates("from 2026-04-12 to 2026-04-26", NOW, trip());
    assert.equal(patch.departDate, "2026-04-12");
    assert.equal(patch.returnDate, "2026-04-26");
    assert.equal(patch.departMonth, "April");
  });

  it("reads day-first numeric dates the Australian way", () => {
    const patch = extractDates("12/04/2027 - 26/04/2027", NOW, trip());
    assert.equal(patch.departDate, "2027-04-12");
    assert.equal(patch.returnDate, "2027-04-26");
  });

  it("reads written dates", () => {
    const patch = extractDates("leaving 12 April 2027, back on 26 April 2027", NOW, trip());
    assert.equal(patch.departDate, "2027-04-12");
    assert.equal(patch.returnDate, "2027-04-26");
  });

  it("derives the return date from a stated duration", () => {
    const patch = extractDates("depart 2027-04-12 for 2 weeks", NOW, trip());
    assert.equal(patch.returnDate, "2027-04-26");
  });

  it("rolls a bare day/month forward so it is never in the past", () => {
    const patch = extractDates("leaving on 5/1", NOW, trip());
    assert.equal(patch.departDate, "2027-01-05");
  });

  it("applies a lone date to the return leg when departure is already set", () => {
    const patch = extractDates(
      "coming back on 2027-05-02",
      NOW,
      trip({ departDate: "2027-04-12" }),
    );
    assert.equal(patch.returnDate, "2027-05-02");
    assert.equal(patch.departDate, undefined);
  });

  it("drops a return that would precede departure", () => {
    const patch = extractDates(
      "return on 2027-01-01",
      NOW,
      trip({ departDate: "2027-04-12" }),
    );
    assert.equal(patch.returnDate, undefined);
  });

  it("still reads a bare month when no date is given", () => {
    assert.equal(extractDates("sometime in November", NOW, trip()).departMonth, "November");
  });

  it("reads the Vietnamese month form", () => {
    assert.equal(extractDates("tháng 4", NOW, trip()).departMonth, "April");
  });
});

describe("understandMessage", () => {
  it("works with the LLM disabled", async () => {
    const result = await understandMessage("Sydney, 3 adults", trip(), OFFLINE);
    assert.equal(result.usedLlm, false);
    assert.equal(result.patch.originCity, "SYD");
    assert.equal(result.patch.travellers, 3);
  });

  it("falls back to the deterministic result when the LLM call fails", async () => {
    const result = await understandMessage("Perth in May", trip(), {
      now: NOW,
      apiKey: "sk-invalid-key-for-test",
      timeoutMs: 1,
    });
    assert.equal(result.patch.originCity, "PER");
    assert.equal(result.patch.departMonth, "May");
  });
});
