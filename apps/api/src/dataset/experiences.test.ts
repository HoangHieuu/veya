import assert from "node:assert/strict";
import test from "node:test";

import { loadExperienceHighlights, resetExperienceCacheForTests } from "./experiences.js";

test("loadExperienceHighlights returns curated places per gateway", () => {
  resetExperienceCacheForTests();
  const han = loadExperienceHighlights("HAN");
  assert.ok(han.length >= 4);
  assert.ok(han.some((h) => h.title.includes("Old Quarter")));
  assert.ok(han.some((h) => h.title.includes("Hạ Long") || h.title.includes("Ha Long")));

  const sgn = loadExperienceHighlights("SGN");
  assert.ok(sgn.some((h) => h.title.includes("Vũng Tàu")));

  const dad = loadExperienceHighlights("DAD");
  assert.ok(dad.some((h) => h.title.includes("Hoi An")));
});
