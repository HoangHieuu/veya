/**
 * Person B pre-merge gate.
 *
 * Imports Person D's real `loadDataset()` and schema rather than re-implementing the rules, so
 * this can never drift from what the API enforces at runtime.
 *
 *   cd apps/api && npm install        # once — provides zod + tsx
 *   apps/api/node_modules/.bin/tsx data/tools/validate-dataset.mts
 *
 * Exits non-zero when the dataset is not safe to merge.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DATA = path.join(REPO, "data");
const importFromRepo = (rel: string) =>
  import(pathToFileURL(path.join(REPO, rel)).href);

const { loadDataset } = await importFromRepo("apps/api/src/dataset/loader.ts");
const { tripIntentSchema, formatValidationIssues } = await importFromRepo(
  "apps/api/src/validation.ts",
);

let failed = false;
const fail = (m: string) => { failed = true; console.log(`  FAIL  ${m}`); };
const warn = (m: string) => console.log(`  warn  ${m}`);
const pass = (m: string) => console.log(`  ok    ${m}`);

console.log("\n== data/routes + version.json (via D's loadDataset) ==");
const snap = loadDataset(DATA, () => {});
console.log(`  datasetVersion : ${snap.version}`);
console.log(`  routes loaded  : ${snap.routes.length} / 9`);
console.log(`  status         : ${snap.status}`);
if (snap.errors.length) {
  for (const e of new Set<string>(snap.errors)) fail(`loader error: ${e}`);
} else pass("no loader errors");
if (snap.missingCombinations.length) {
  fail(`missing routes: ${snap.missingCombinations.join(", ")}`);
} else pass("9/9 origin x destination coverage");

console.log("\n== maxStops is a hard filter, not a penalty ==");
// recommend.ts filterCandidates() drops any route with more stops than the intent allows,
// so an origin needs three routes within the cap to fill three cards.
const stops = { direct: 0, one_stop: 1, two_stop: 2 } as const;
for (const origin of ["SYD", "MEL", "PER"]) {
  const forOrigin = snap.routes.filter((r: any) => r.originCity === origin);
  if (!forOrigin.length) { warn(`${origin}: no routes`); continue; }
  for (const cap of [0, 1] as const) {
    const kept = forOrigin.filter(
      (r: any) => stops[r.connectionType as keyof typeof stops] <= cap,
    );
    const msg = `${origin} @ maxStops=${cap} -> ${kept.length} card(s)`;
    if (kept.length >= 3) { pass(msg); continue; }
    // maxStops=0 fires only on a literal "direct only" brief (briefHeuristic.ts:179).
    // Fewer cards is the honest answer there; the contract allows min(3, candidateCount).
    cap === 0 ? warn(`${msg}  (expected: direct-only brief)`) : fail(`${msg}  (< 3)`);
  }
}

console.log("\n== scoring-signal spread (a constant field is a dead factor) ==");
if (snap.routes.length) {
  const spread = (label: string, vals: unknown[]) => {
    const uniq = new Set(vals.map((v) => JSON.stringify(v)));
    uniq.size <= 1
      ? fail(`${label}: all ${snap.routes.length} routes identical -> cannot rank`)
      : pass(`${label}: ${uniq.size} distinct values`);
  };
  spread("indicativeFareBand", snap.routes.map((r: any) => r.indicativeFareBand));
  spread("connectionType", snap.routes.map((r: any) => r.connectionType));
  for (const [label, n] of [
    ["promotion", snap.routes.filter((r: any) => r.promotion).length],
    ["lotusmilesIndicative", snap.routes.filter((r: any) => r.lotusmilesIndicative).length],
  ] as const) {
    n === 0
      ? fail(`${label}: all null -> factor scores 0 everywhere`)
      : pass(`${label}: ${n}/${snap.routes.length} routes`);
  }
}

console.log("\n== background images resolve on disk ==");
for (const route of snap.routes as any[]) {
  const file = path.join(DATA, "assets", path.basename(route.backgroundImage.url));
  try {
    readFileSync(file);
  } catch {
    fail(`${route.id}: backgroundImage.url has no file at data/assets/${path.basename(file)}`);
  }
}
if (!failed) pass("every backgroundImage.url has a committed file");

console.log("\n== data/experiences (gateway place board) ==");
const EXPERIENCE_TAGS = new Set(["food", "beach", "quiet", "family", "culture", "city"]);
const seenExperienceIds = new Set<string>();
for (const gateway of ["HAN", "SGN", "DAD"]) {
  const file = path.join(DATA, "experiences", `${gateway}.json`);
  let parsed: any;
  try {
    parsed = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail(`experiences/${gateway}.json is missing or unreadable`);
    continue;
  }
  const items = parsed.highlights ?? [];
  if (items.length < 2 || items.length > 6) {
    fail(`${gateway}: ${items.length} highlights (expected 2-6)`);
  } else {
    pass(`${gateway}: ${items.length} experience highlights`);
  }
  for (const item of items) {
    if (seenExperienceIds.has(item.id)) fail(`duplicate experience id ${item.id}`);
    seenExperienceIds.add(item.id);
    for (const field of ["title", "subtitle", "transferNote", "imageUrl"]) {
      if (!String(item[field] ?? "").trim()) fail(`${item.id}: ${field} is blank`);
    }
    if (!Array.isArray(item.tags) || item.tags.length === 0) {
      fail(`${item.id}: tags must be a non-empty array`);
    }
    for (const tag of item.tags) {
      if (!EXPERIENCE_TAGS.has(tag)) fail(`${item.id}: unknown tag "${tag}"`);
    }
    const rel = String(item.imageUrl ?? "").replace(/^\/assets\//, "");
    try {
      readFileSync(path.join(DATA, "assets", rel));
    } catch {
      fail(`${item.id}: imageUrl has no file at data/assets/${rel}`);
    }
  }
}

console.log("\n== data/policy-corpus (baggage/fare-conditions RAG) ==");
try {
  const corpus = JSON.parse(readFileSync(path.join(DATA, "policy-corpus/vectors.json"), "utf8"));
  const chunkCount = corpus.chunks?.length ?? 0;
  chunkCount > 50
    ? pass(`${chunkCount} embedded chunks, model ${corpus.model}`)
    : fail(`only ${chunkCount} chunks in policy-corpus/vectors.json`);
  const badDims = (corpus.chunks ?? []).filter((c: any) => c.embedding?.length !== corpus.dims);
  badDims.length === 0
    ? pass(`all chunks match declared dims (${corpus.dims})`)
    : fail(`${badDims.length} chunk(s) have the wrong embedding length`);
  const noUrl = (corpus.chunks ?? []).filter((c: any) => !String(c.sourceUrl ?? "").startsWith("https://"));
  if (noUrl.length > 0) fail(`${noUrl.length} chunk(s) missing a sourceUrl`);
} catch (error) {
  fail(`policy-corpus/vectors.json unreadable: ${(error as Error).message}`);
}
try {
  const sources = JSON.parse(readFileSync(path.join(DATA, "policy-corpus/sources.json"), "utf8"));
  sources.length >= 15
    ? pass(`${sources.length} source pages listed`)
    : fail(`only ${sources.length} source pages listed`);
} catch (error) {
  fail(`policy-corpus/sources.json unreadable: ${(error as Error).message}`);
}

console.log("\n== data/fixtures/sampleIntent.json (vs D's tripIntentSchema) ==");
try {
  const raw = JSON.parse(readFileSync(path.join(DATA, "fixtures/sampleIntent.json"), "utf8"));
  const parsed = tripIntentSchema.safeParse(raw);
  parsed.success
    ? pass("valid TripIntent")
    : fail(`invalid: ${formatValidationIssues(parsed.error)}`);
} catch (error) {
  fail(`unreadable: ${(error as Error).message}`);
}

console.log("\n== data/fixtures/expectedTop3.json is current ==");
try {
  const lock = JSON.parse(readFileSync(path.join(DATA, "fixtures/expectedTop3.json"), "utf8"));
  lock.datasetVersion === snap.version
    ? pass(`locked at ${lock.datasetVersion}`)
    : fail(
        `locked at ${lock.datasetVersion} but dataset is ${snap.version} — regenerate it`,
      );
} catch (error) {
  fail(`unreadable: ${(error as Error).message}`);
}

console.log(failed ? "\nRESULT: NOT READY TO MERGE\n" : "\nRESULT: dataset clean\n");
process.exit(failed ? 1 : 0);
