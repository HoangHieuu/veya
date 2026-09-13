import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { extractDepartMonth } from "./dateWindow.js";
import {
  classifyPolicyIntent,
  patchTripSummary,
  suggestNextField,
} from "./tripOrchestration.js";

describe("extractDepartMonth", () => {
  it("reads bare month and mid-month", () => {
    assert.equal(extractDepartMonth("beach trip in April"), "April");
    assert.equal(extractDepartMonth("mid-November"), "November");
    assert.equal(extractDepartMonth("no month here"), undefined);
  });
});

describe("suggestNextField", () => {
  it("starts with originCity on empty trip", () => {
    assert.equal(suggestNextField({}), "originCity");
  });

  it("asks destination after MEL + beach", () => {
    assert.equal(
      suggestNextField({ originCity: "MEL", travelStyle: "beach_relaxation" }),
      "destinationLocalityId",
    );
  });

  it("skips gateway when already inferred", () => {
    assert.equal(
      suggestNextField({
        originCity: "MEL",
        travelStyle: "beach_relaxation",
        destinationLocalityId: "da-nang",
        gateway: "DAD",
      }),
      "travellers",
    );
  });

  it("asks gateway when locality set but gateway missing", () => {
    assert.equal(
      suggestNextField({
        originCity: "MEL",
        travelStyle: "vfr",
        destinationLocalityId: "ca-mau",
      }),
      "gateway",
    );
  });

  it("returns book when required fields are filled", () => {
    assert.equal(
      suggestNextField({
        originCity: "MEL",
        travelStyle: "beach_relaxation",
        destinationLocalityId: "da-nang",
        gateway: "DAD",
        travellers: 2,
        departMonth: "April",
      }),
      "book",
    );
  });
});

describe("patchTripSummary", () => {
  it("fills multiple fields from a full beach brief", () => {
    const patch = patchTripSummary(
      "Melbourne, beach, Da Nang, April, 2 adults",
    );
    assert.equal(patch.originCity, "MEL");
    assert.equal(patch.travelStyle, "beach_relaxation");
    assert.equal(patch.gateway, "DAD");
    assert.equal(patch.travellers, 2);
    assert.equal(patch.departMonth, "April");
    assert.ok(patch.destinationLocalityId);
  });

  it("merges onto current without wiping prior fields", () => {
    const patch = patchTripSummary("2 adults", {
      originCity: "MEL",
      travelStyle: "beach_relaxation",
    });
    assert.equal(patch.originCity, "MEL");
    assert.equal(patch.travelStyle, "beach_relaxation");
    assert.equal(patch.travellers, 2);
  });

  it("patches Cà Mau VFR locality to SGN", () => {
    const patch = patchTripSummary(
      "Visiting family in Cà Mau from Melbourne",
    );
    assert.equal(patch.originCity, "MEL");
    assert.equal(patch.gateway, "SGN");
    assert.ok(patch.destinationLocalityId);
  });
});

describe("classifyPolicyIntent", () => {
  it("routes offer / lotusmiles / lotustudents keywords", () => {
    assert.equal(
      classifyPolicyIntent("what are the offer terms?"),
      "direct-decision-offer",
    );
    assert.equal(classifyPolicyIntent("see the -5% discount"), "direct-decision-offer");
    assert.equal(classifyPolicyIntent("Lotusmiles enrollment"), "lotusmiles");
    assert.equal(
      classifyPolicyIntent("LotuStudents student fare"),
      "lotustudents",
    );
  });

  it("returns null for unrelated chat", () => {
    assert.equal(classifyPolicyIntent("beach trip from Sydney"), null);
    assert.equal(classifyPolicyIntent(""), null);
  });
});
