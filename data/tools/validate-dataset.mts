/**
 * Person B pre-merge gate for the curated dataset.
 *
 *   cd apps/api && npm ci          # once: provides tsx (and zod, once D adds it)
 *   apps/api/node_modules/.bin/tsx data/tools/validate-dataset.mts
 *
 * Runs in two modes. Once Person D ships `apps/api/src/validation.ts`, this picks the real
 * `routeRecordSchema` up automatically and validates every record in full, so the gate can never
 * drift from what the API enforces. Until then it falls back to structural checks and says so,
 * rather than restating the schema here and leaving two sources of truth.
 *
 * Exits non-zero when the dataset is not safe to merge.
 */
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../..");
const DATA = path.join(REPO, "data");

const ORIGINS = ["SYD", "MEL", "PER"] as const;
const DESTINATIONS = ["HAN", "SGN", "DAD"] as const;
const REQUIRED_KEYS = [
  "id", "originCity", "originAirport", "destinationCity", "destinationAirport",
  "destinationName", "connectionType", "typicalDurationHours", "seasonalityNotes",
  "gettingAround", "tripArchetypes", "indicativeFareBand", "bestMonths",
  "backgroundImage", "dataConfidence", "sourceDocument", "sourceOwner",
];

let failed = false;
const fail = (message: string) => { failed = true; console.log("  FAIL  " + message); };
const warn = (message: string) => console.log("  warn  " + message);
const pass = (message: string) => console.log("  ok    " + message);

async function tryImport(relative: string): Promise<any> {
  try {
    return await import(pathToFileURL(path.join(REPO, relative)).href);
  } catch {
    return undefined;
  }
}

const validation = await tryImport("apps/api/src/validation.ts");
const deep = Boolean(validation?.routeRecordSchema);

console.log("\n== mode ==");
console.log(
  deep
    ? "  full    - using Person D's routeRecordSchema"
    : "  shallow - apps/api/src/validation.ts not implemented yet, structural checks only",
);

console.log("\n== data/version.json ==");
let datasetVersion = "";
try {
  const parsed = JSON.parse(readFileSync(path.join(DATA, "version.json"), "utf8"));
  datasetVersion = String(parsed.datasetVersion ?? "").trim();
  if (datasetVersion) pass("datasetVersion " + datasetVersion);
  else fail("datasetVersion is blank");
} catch {
  fail("version.json is missing or unreadable");
}

console.log("\n== data/routes ==");
const routes: any[] = [];
const ids = new Set<string>();
const routeFiles = readdirSync(path.join(DATA, "routes")).filter((f) => f.endsWith(".json")).sort();

for (const file of routeFiles) {
  let record: any;
  try {
    record = JSON.parse(readFileSync(path.join(DATA, "routes", file), "utf8"));
  } catch (error) {
    fail(file + ": invalid JSON - " + (error as Error).message);
    continue;
  }

  if (deep) {
    const result = validation.routeRecordSchema.safeParse(record);
    if (!result.success) {
      fail(file + ": " + validation.formatValidationIssues(result.error));
      continue;
    }
  } else {
    const missing = REQUIRED_KEYS.filter((key) => record[key] === undefined);
    if (missing.length) {
      fail(file + ": missing " + missing.join(", "));
      continue;
    }
  }

  if (ids.has(record.id)) {
    fail(file + ": duplicate route id " + record.id);
    continue;
  }
  ids.add(record.id);
  routes.push(record);
}
pass(routes.length + " route records parsed");

const combos = new Set(routes.map((r) => r.originCity + "-" + r.destinationCity));
const missingCombos = ORIGINS.flatMap((origin) =>
  DESTINATIONS.filter((dest) => !combos.has(origin + "-" + dest)).map((dest) => origin + "-" + dest),
);
if (missingCombos.length) fail("incomplete coverage, missing: " + missingCombos.join(", "));
else pass("9/9 origin x destination coverage");

console.log("\n== maxStops is a hard filter, not a penalty ==");
// The recommendation endpoint drops any route with more stops than the intent allows, so each
// origin needs three routes within the cap to fill three cards.
const stops: Record<string, number> = { direct: 0, one_stop: 1, two_stop: 2 };
for (const origin of ORIGINS) {
  const forOrigin = routes.filter((r) => r.originCity === origin);
  if (!forOrigin.length) {
    warn(origin + ": no routes");
    continue;
  }
  for (const cap of [0, 1]) {
    const kept = forOrigin.filter((r) => stops[r.connectionType] <= cap);
    const message = origin + " @ maxStops=" + cap + " -> " + kept.length + " card(s)";
    if (kept.length >= 3) {
      pass(message);
    } else if (cap === 0) {
      // maxStops=0 only fires on a literal "direct only" brief, where fewer options is the honest
      // answer and the contract allows min(3, candidateCount).
      warn(message + "  (expected: direct-only brief)");
    } else {
      fail(message + "  (< 3)");
    }
  }
}

console.log("\n== scoring-signal spread (a constant field is a dead factor) ==");
if (routes.length) {
  const spread = (label: string, values: unknown[]) => {
    const unique = new Set(values.map((value) => JSON.stringify(value)));
    if (unique.size <= 1) fail(label + ": all " + routes.length + " routes identical -> cannot rank");
    else pass(label + ": " + unique.size + " distinct values");
  };
  spread("indicativeFareBand", routes.map((r) => r.indicativeFareBand));
  spread("connectionType", routes.map((r) => r.connectionType));

  const counts: Array<[string, number]> = [
    ["promotion", routes.filter((r) => r.promotion).length],
    ["lotusmilesIndicative", routes.filter((r) => r.lotusmilesIndicative).length],
  ];
  for (const [label, count] of counts) {
    if (count === 0) fail(label + ": all null -> factor scores 0 everywhere");
    else pass(label + ": " + count + "/" + routes.length + " routes");
  }
}

console.log("\n== background images resolve on disk ==");
let imagesOk = true;
for (const route of routes) {
  const relative = String(route.backgroundImage?.url ?? "").replace(/^\/assets\//, "");
  try {
    readFileSync(path.join(DATA, "assets", relative));
  } catch {
    imagesOk = false;
    fail(route.id + ": no file at data/assets/" + relative);
  }
  if (!String(route.backgroundImage?.licenseNote ?? "").trim()) {
    imagesOk = false;
    fail(route.id + ": backgroundImage.licenseNote is blank");
  }
}
if (imagesOk) pass("every backgroundImage has a committed file and a licence note");

console.log("\n== data/fixtures ==");
try {
  const intent = JSON.parse(readFileSync(path.join(DATA, "fixtures/sampleIntent.json"), "utf8"));
  if (deep && validation.tripIntentSchema) {
    const result = validation.tripIntentSchema.safeParse(intent);
    if (result.success) pass("sampleIntent.json is a valid TripIntent");
    else fail("sampleIntent.json: " + validation.formatValidationIssues(result.error));
  } else {
    const required = ["originCity", "travelStyles", "budgetBand", "priority", "dateWindow", "constraints"];
    const missing = required.filter((key) => intent[key] === undefined);
    if (missing.length) fail("sampleIntent.json missing " + missing.join(", "));
    else pass("sampleIntent.json has the required TripIntent fields");
  }
} catch {
  fail("sampleIntent.json is missing or unreadable");
}

try {
  const lock = JSON.parse(readFileSync(path.join(DATA, "fixtures/expectedTop3.json"), "utf8"));
  if (lock.datasetVersion === datasetVersion) {
    pass("expectedTop3.json locked at " + lock.datasetVersion);
  } else {
    fail(
      "expectedTop3.json is locked at " + lock.datasetVersion +
      " but the dataset is " + datasetVersion + " - regenerate it",
    );
  }
  const personas = (lock.cases ?? []).map((c: any) => c.persona);
  if (personas.length) pass("covers " + personas.length + " persona(s): " + personas.join(", "));
  else fail("expectedTop3.json has no cases");
} catch {
  fail("expectedTop3.json is missing or unreadable");
}

console.log(failed ? "\nRESULT: NOT READY TO MERGE\n" : "\nRESULT: dataset clean\n");
process.exit(failed ? 1 : 0);
