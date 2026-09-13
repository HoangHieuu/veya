import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  DestinationCity,
  DestinationSuggestion,
  MonthName,
  PolicyOverlayId,
  PolicySnippet,
} from "../../../../shared/types.js";
import type { LocalityGatewayData } from "../dataset/localityGateway.js";
import { loadLocalityGateway } from "../dataset/localityGateway.js";

const DATA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data",
);

export type CapabilityStatus = "ready" | "unavailable";

export interface AgentDataCapabilities {
  destinations: CapabilityStatus;
  locality: CapabilityStatus;
  season: CapabilityStatus;
  offer: CapabilityStatus;
  policies: CapabilityStatus;
}

export interface AgentLocalityRecord {
  id: string;
  title: string;
  aliases: string[];
  gateway: DestinationCity;
  onwardNote?: string;
  sourceFields: string[];
}

export interface AgentSeasonRecord {
  localityId?: string;
  gateway?: DestinationCity;
  month: number;
  headline: string;
  summary: string;
  bestMonths: number[];
  caveats: string[];
  sourceFields: string[];
}

export interface IllustrativeFareSnapshot {
  routeId: string;
  publicFareAud: number;
  sourceDocument: string;
  sourceFields: string[];
}

export interface DirectOfferPolicySnapshot {
  id: "direct-decision-offer";
  discountPct: number;
  expiryHours: number;
  sourceDocument: string;
  eligibility: string[];
  disclaimer: string;
  title?: string;
  summary?: string;
  bullets?: string[];
}

export interface AgentDataSnapshot {
  version: string;
  capabilities: AgentDataCapabilities;
  errors: string[];
  destinationSuggestions: DestinationSuggestionRecord[];
  localities: AgentLocalityRecord[];
  seasons: AgentSeasonRecord[];
  fares: IllustrativeFareSnapshot[];
  directOfferPolicy?: DirectOfferPolicySnapshot;
  policies: PolicySnippet[];
  legacyLocality: LocalityGatewayData;
}

export interface DestinationSuggestionRecord extends DestinationSuggestion {
  supportedOrigins?: string[];
  promotionWeight?: number;
  order?: number;
}

const DESTINATIONS = new Set<DestinationCity>(["HAN", "SGN", "DAD"]);
const ORIGINS = new Set(["SYD", "MEL", "PER"]);
const POLICY_IDS = new Set(["direct-decision-offer", "lotusmiles", "lotustudents"]);
const MONTHS = new Set([...Array(12)].map((_, index) => index + 1));
const MONTH_NAMES: MonthName[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthNumber(month: MonthName): number {
  return MONTH_NAMES.indexOf(month) + 1;
}

export function loadAgentData(dataRoot = DATA_ROOT): AgentDataSnapshot {
  const errors: string[] = [];
  const legacyLocality = loadLegacyLocality(dataRoot, errors);
  const destinationSuggestions = loadDestinationSuggestions(dataRoot, errors);
  const localities = loadLocalities(dataRoot, legacyLocality, errors);
  const seasons = loadSeasons(dataRoot, errors);
  const fares = loadFares(dataRoot, errors);
  const directOfferPolicy = loadDirectOfferPolicy(dataRoot, errors);
  const policies = loadPolicies(dataRoot, errors);

  return {
    version: readDatasetVersion(dataRoot, errors),
    capabilities: {
      destinations: destinationSuggestions.length > 0 ? "ready" : "unavailable",
      locality: localities.length > 0 ? "ready" : "unavailable",
      season: seasons.length > 0 ? "ready" : "unavailable",
      offer: directOfferPolicy && fares.length > 0 ? "ready" : "unavailable",
      policies: policies.length > 0 ? "ready" : "unavailable",
    },
    errors,
    destinationSuggestions,
    localities,
    seasons,
    fares,
    directOfferPolicy,
    policies,
    legacyLocality,
  };
}

export function createAgentDataSnapshot(
  input: Partial<AgentDataSnapshot> & Pick<AgentDataSnapshot, "version">,
): AgentDataSnapshot {
  const legacyLocality = input.legacyLocality ?? {
    version: input.version,
    visitContextPatterns: [],
    regions: [],
    localities: [],
    defaultLocalityBoost: 0,
  };
  const destinations = structuredClone(input.destinationSuggestions ?? []);
  const localities = structuredClone(input.localities ?? []);
  const seasons = structuredClone(input.seasons ?? []);
  const fares = structuredClone(input.fares ?? []);
  const policies = structuredClone(input.policies ?? []);
  const directOfferPolicy = input.directOfferPolicy
    ? structuredClone(input.directOfferPolicy)
    : undefined;
  return {
    version: input.version,
    capabilities: input.capabilities ?? {
      destinations: destinations.length > 0 ? "ready" : "unavailable",
      locality: localities.length > 0 ? "ready" : "unavailable",
      season: seasons.length > 0 ? "ready" : "unavailable",
      offer: directOfferPolicy && fares.length > 0 ? "ready" : "unavailable",
      policies: policies.length > 0 ? "ready" : "unavailable",
    },
    errors: [...(input.errors ?? [])],
    destinationSuggestions: destinations,
    localities,
    seasons,
    fares,
    directOfferPolicy,
    policies,
    legacyLocality: structuredClone(legacyLocality),
  };
}

function readDatasetVersion(root: string, errors: string[]): string {
  const value = readJson(path.join(root, "version.json"), errors, "AGENT_VERSION_INVALID");
  if (!value || typeof value !== "object") return "unavailable";
  const version = (value as { datasetVersion?: unknown }).datasetVersion;
  return typeof version === "string" && version.trim() ? version.trim() : "unavailable";
}

function loadLegacyLocality(root: string, errors: string[]): LocalityGatewayData {
  const file = path.join(root, "locality-gateway.json");
  if (!existsSync(file)) return loadLocalityGateway(path.join(root, "missing-locality.json"));
  try {
    const raw = readJson(file, errors, "AGENT_LOCALITY_INVALID");
    if (raw && typeof raw === "object") {
      const data = normalizeLocality(raw as Parameters<typeof normalizeLocality>[0]);
      return data;
    }
  } catch {
    errors.push("AGENT_LOCALITY_INVALID");
  }
  return loadLocalityGateway(path.join(root, "missing-locality.json"));
}

function normalizeLocality(raw: {
  version?: string;
  visitContextPatterns?: string[];
  regions?: LocalityGatewayData["regions"];
  gatewayProvinces?: Partial<Record<DestinationCity, string[]>>;
  localityBoost?: number;
}): LocalityGatewayData {
  const localities = raw.gatewayProvinces
    ? Object.entries(raw.gatewayProvinces).flatMap(([gateway, names]) =>
        (names ?? []).map((title) => ({
          id: slugify(title),
          title,
          patterns: [`\\b${escapeRegex(title)}\\b`],
          gateway: gateway as DestinationCity,
          boost: raw.localityBoost ?? 0.55,
        })),
      )
    : [];
  const uniqueLocalities = [...new Map(localities.map((locality) => [locality.id, locality])).values()];
  return {
    version: raw.version ?? "unavailable",
    visitContextPatterns: raw.visitContextPatterns ?? [],
    regions: raw.regions ?? [],
    localities: uniqueLocalities,
    defaultLocalityBoost: raw.localityBoost ?? 0.55,
  };
}

function loadDestinationSuggestions(
  root: string,
  errors: string[],
): DestinationSuggestionRecord[] {
  const documentedFile = path.join(root, "promotions", "destination-spotlight.json");
  const compatibilityFile = path.join(root, "destination-spotlight.json");
  const file = existsSync(documentedFile) ? documentedFile : compatibilityFile;
  const raw = readJson(file, errors, "AGENT_DESTINATION_INVALID_JSON");
  if (raw === undefined) return [];
  const items = extractDestinationItems(raw);
  const output: DestinationSuggestionRecord[] = [];
  const seen = new Set<string>();
  for (const [index, value] of items.entries()) {
    const parsed = parseDestination(value, file, index);
    if (!parsed) {
      errors.push("AGENT_DESTINATION_INVALID");
      continue;
    }
    if (seen.has(parsed.localityId)) {
      errors.push("AGENT_DESTINATION_DUPLICATE_ID");
      continue;
    }
    seen.add(parsed.localityId);
    output.push(parsed);
  }
  return output;
}

function loadLocalities(
  root: string,
  legacy: LocalityGatewayData,
  errors: string[],
): AgentLocalityRecord[] {
  const file = path.join(root, "geo", "localities.json");
  const raw = readJson(file, errors, "AGENT_LOCALITY_INVALID_JSON");
  if (raw !== undefined) {
    const items = extractArray(raw, ["localities", "items"]);
    const output: AgentLocalityRecord[] = [];
    const seen = new Set<string>();
    const seenNames = new Map<string, string>();
    for (const [index, value] of items.entries()) {
      const parsed = parseLocality(value, file, index);
      if (!parsed) {
        errors.push("AGENT_LOCALITY_INVALID");
        continue;
      }
      if (seen.has(parsed.id)) {
        errors.push("AGENT_LOCALITY_DUPLICATE_ID");
        continue;
      }
      const names = [parsed.id, parsed.title, ...parsed.aliases].map(normalizeKey);
      if (names.some((name) => seenNames.has(name) && seenNames.get(name) !== parsed.id)) {
        errors.push("AGENT_LOCALITY_ALIAS_CONFLICT");
        continue;
      }
      seen.add(parsed.id);
      names.forEach((name) => seenNames.set(name, parsed.id));
      output.push(parsed);
    }
    return output;
  }

  return legacy.localities.map((locality) => ({
    id: locality.id,
    title: locality.title,
    aliases: [],
    gateway: locality.gateway,
    sourceFields: ["data/locality-gateway.json"],
  }));
}

function loadSeasons(root: string, errors: string[]): AgentSeasonRecord[] {
  const directory = path.join(root, "seasons");
  const output: AgentSeasonRecord[] = [];
  const seen = new Set<string>();
  if (existsSync(directory)) {
    for (const fileName of readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
      const file = path.join(directory, fileName);
      const raw = readJson(file, errors, "AGENT_SEASON_INVALID_JSON");
      appendSeasons(
        extractArray(raw, ["seasons", "items"]),
        file,
        output,
        seen,
        errors,
      );
    }
    return output;
  }

  const compatibilityFile = path.join(root, "seasons.json");
  const raw = readJson(compatibilityFile, errors, "AGENT_SEASON_INVALID_JSON");
  appendSeasons(
    normalizeGatewaySeasonItems(raw, compatibilityFile),
    compatibilityFile,
    output,
    seen,
    errors,
  );
  return output;
}

function appendSeasons(
  items: unknown[],
  file: string,
  output: AgentSeasonRecord[],
  seen: Set<string>,
  errors: string[],
): void {
  for (const [index, value] of items.entries()) {
    const parsed = parseSeason(value, file, index);
    if (!parsed) {
      errors.push("AGENT_SEASON_INVALID");
      continue;
    }
    const key = `${parsed.localityId ?? "gateway:" + parsed.gateway}-${parsed.month}`;
    if (seen.has(key)) {
      errors.push("AGENT_SEASON_DUPLICATE");
      continue;
    }
    seen.add(key);
    output.push(parsed);
  }
}

function normalizeGatewaySeasonItems(value: unknown, file: string): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const gateways = (value as Record<string, unknown>).gateways;
  if (!gateways || typeof gateways !== "object" || Array.isArray(gateways)) return [];

  return Object.entries(gateways as Record<string, unknown>).flatMap(
    ([gateway, gatewayValue]) => {
      if (!gatewayValue || typeof gatewayValue !== "object" || Array.isArray(gatewayValue)) {
        return [];
      }
      const record = gatewayValue as Record<string, unknown>;
      const months = record.months;
      if (!months || typeof months !== "object" || Array.isArray(months)) return [];
      const bestMonths = Object.entries(months as Record<string, unknown>)
        .filter(([, monthValue]) =>
          Boolean(
            monthValue &&
              typeof monthValue === "object" &&
              !Array.isArray(monthValue) &&
              (monthValue as Record<string, unknown>).rating === "best",
          ),
        )
        .map(([month]) => parseMonthValue(month))
        .filter((month): month is number => month !== undefined);

      return Object.entries(months as Record<string, unknown>).map(([month, monthValue]) => {
        const monthRecord =
          monthValue && typeof monthValue === "object" && !Array.isArray(monthValue)
            ? monthValue as Record<string, unknown>
            : {};
        const destinationName = stringValue(record.destinationName) ?? gateway;
        const rating = stringValue(monthRecord.rating);
        return {
          gateway,
          month,
          headline: rating
            ? `${destinationName}: ${rating} season in ${month}`
            : `${destinationName} in ${month}`,
          summary: monthRecord.note,
          bestMonths,
          caveats: stringValue(record.seasonalityNotes)
            ? [record.seasonalityNotes]
            : [],
          sourceFields: [sourceRef(file), `gateways.${gateway}.months.${month}`],
        };
      });
    },
  );
}

function loadFares(root: string, errors: string[]): IllustrativeFareSnapshot[] {
  const file = path.join(root, "offers", "illustrative-fares.json");
  const raw = readJson(file, errors, "AGENT_FARE_INVALID_JSON");
  if (raw === undefined) return [];
  const defaultSourceDocument =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? stringValue((raw as Record<string, unknown>).source)
      : undefined;
  const output: IllustrativeFareSnapshot[] = [];
  const seen = new Set<string>();
  for (const [index, value] of extractArray(raw, ["fares", "items"]).entries()) {
    const parsed = parseFare(value, file, index, defaultSourceDocument);
    if (!parsed) {
      errors.push("AGENT_FARE_INVALID");
      continue;
    }
    if (seen.has(parsed.routeId)) {
      errors.push("AGENT_FARE_DUPLICATE_ROUTE");
      continue;
    }
    seen.add(parsed.routeId);
    output.push(parsed);
  }
  return output;
}

function loadDirectOfferPolicy(
  root: string,
  errors: string[],
): DirectOfferPolicySnapshot | undefined {
  const file = path.join(root, "policies", "direct-decision-offer.json");
  const raw = readJson(file, errors, "AGENT_OFFER_POLICY_INVALID_JSON");
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const discountPct = numberValue(value.discountPct ?? value.discountPercent);
  const expiryHours = numberValue(value.expiryHours);
  const sourceDocument = stringValue(value.sourceDocument);
  const disclaimer = stringValue(value.disclaimer);
  if (
    discountPct === undefined ||
    discountPct < 0 ||
    discountPct > 100 ||
    expiryHours === undefined ||
    expiryHours <= 0 ||
    !sourceDocument ||
    !disclaimer
  ) {
    errors.push("AGENT_OFFER_POLICY_INVALID");
    return undefined;
  }
  return {
    id: "direct-decision-offer",
    discountPct,
    expiryHours,
    sourceDocument,
    eligibility: stringArray(value.eligibility),
    disclaimer,
    title: stringValue(value.title),
    summary: stringValue(value.summary),
    bullets: stringArray(value.bullets),
  };
}

function loadPolicies(root: string, errors: string[]): PolicySnippet[] {
  const directory = path.join(root, "policies");
  if (!existsSync(directory)) return [];
  const output: PolicySnippet[] = [];
  for (const fileName of readdirSync(directory).filter((name) => name.endsWith(".json")).sort()) {
    if (fileName === "direct-decision-offer.json") continue;
    const file = path.join(directory, fileName);
    const raw = readJson(file, errors, "AGENT_POLICY_INVALID_JSON");
    if (!raw || typeof raw !== "object") continue;
    const value = raw as Record<string, unknown>;
    const id = stringValue(value.id) as PolicyOverlayId | undefined;
    const title = stringValue(value.title);
    const summary = stringValue(value.summary);
    const sourceDocument = stringValue(value.sourceDocument);
    const bullets = stringArray(value.bullets);
    if (!id || !POLICY_IDS.has(id) || !title || !summary || !sourceDocument || bullets.length === 0) {
      errors.push("AGENT_POLICY_INVALID");
      continue;
    }
    output.push({
      id,
      title,
      summary,
      bullets,
      sourceDocument,
      sourceFields: [`data/policies/${fileName}`],
    });
  }
  return output;
}

function parseDestination(
  value: unknown,
  file: string,
  index: number,
): DestinationSuggestionRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const localityId = stringValue(item.localityId ?? item.id);
  const title = stringValue(item.title ?? item.destinationName);
  const gateway = stringValue(item.gateway) as DestinationCity | undefined;
  const summary = stringValue(item.summary ?? item.subtitle);
  const tags = stringArray(
    item.tags ?? item.vibes ?? item.travelStyles ?? item.matchVibe,
  );
  if (!localityId || !title || !summary || !gateway || !DESTINATIONS.has(gateway) || tags.length === 0) {
    return undefined;
  }
  const explicitOrigin = stringValue(item.origin ?? item.originCity);
  const supportedOrigins = [
    ...new Set([
      ...stringArray(item.supportedOrigins ?? item.origins),
      ...(explicitOrigin ? [explicitOrigin] : []),
    ]),
  ];
  if (supportedOrigins.some((origin) => !ORIGINS.has(origin))) return undefined;
  const image = parseImage(item.image);
  return {
    localityId,
    title,
    gateway,
    summary,
    tags,
    onwardNote: stringValue(item.onwardNote),
    promoted: booleanValue(item.promoted) ?? booleanValue(item.isPromoted),
    image,
    sourceFields: stringArray(item.sourceFields).length
      ? stringArray(item.sourceFields)
      : [sourceRef(file), `item[${index}]`],
    supportedOrigins: supportedOrigins.length ? supportedOrigins : undefined,
    promotionWeight: numberValue(item.promotionWeight ?? item.weight),
    order: numberValue(item.order ?? item.priority),
  };
}

function parseLocality(
  value: unknown,
  file: string,
  index: number,
): AgentLocalityRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const id = stringValue(item.id);
  const title = stringValue(item.title);
  const gateway = stringValue(item.gateway) as DestinationCity | undefined;
  if (!id || !title || !gateway || !DESTINATIONS.has(gateway)) return undefined;
  return {
    id,
    title,
    aliases: stringArray(item.aliases),
    gateway,
    onwardNote: stringValue(item.onwardNote),
    sourceFields: stringArray(item.sourceFields).length
      ? stringArray(item.sourceFields)
      : [sourceRef(file), `item[${index}]`],
  };
}

function parseSeason(
  value: unknown,
  file: string,
  index: number,
): AgentSeasonRecord | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const month = parseMonthValue(item.month);
  const headline = stringValue(item.headline);
  const summary = stringValue(item.summary);
  const bestMonths = monthArray(item.bestMonths);
  if (
    month === undefined ||
    !MONTHS.has(month) ||
    !headline ||
    !summary ||
    (!stringValue(item.localityId) && !stringValue(item.gateway)) ||
    bestMonths.some((value) => !MONTHS.has(value))
  ) {
    return undefined;
  }
  const gateway = stringValue(item.gateway) as DestinationCity | undefined;
  if (gateway && !DESTINATIONS.has(gateway)) return undefined;
  return {
    localityId: stringValue(item.localityId),
    gateway,
    month,
    headline,
    summary,
    bestMonths,
    caveats: stringArray(item.caveats),
    sourceFields: stringArray(item.sourceFields).length
      ? stringArray(item.sourceFields)
      : [sourceRef(file), `item[${index}]`],
  };
}

function parseFare(
  value: unknown,
  file: string,
  index: number,
  defaultSourceDocument?: string,
): IllustrativeFareSnapshot | undefined {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const routeId = stringValue(item.routeId);
  const publicFareAud = numberValue(item.publicFareAud);
  const sourceDocument = stringValue(item.sourceDocument) ?? defaultSourceDocument;
  if (!routeId || publicFareAud === undefined || publicFareAud <= 0 || !sourceDocument) {
    return undefined;
  }
  return {
    routeId,
    publicFareAud,
    sourceDocument,
    sourceFields: stringArray(item.sourceFields).length
      ? stringArray(item.sourceFields)
      : [sourceRef(file), `item[${index}]`],
  };
}

function parseImage(value: unknown): DestinationSuggestionRecord["image"] {
  if (!value || typeof value !== "object") return undefined;
  const item = value as Record<string, unknown>;
  const url = stringValue(item.url);
  const source = stringValue(item.source);
  const owner = stringValue(item.owner);
  const licenseNote = stringValue(item.licenseNote);
  return url && source && owner && licenseNote
    ? { url, source, owner, licenseNote }
    : undefined;
}

function readJson(
  file: string,
  errors?: string[],
  invalidCode = "AGENT_JSON_INVALID",
): unknown | undefined {
  if (!existsSync(file)) return undefined;
  try {
    return JSON.parse(readFileSync(file, "utf8")) as unknown;
  } catch {
    if (errors && !errors.includes(invalidCode)) errors.push(invalidCode);
    return undefined;
  }
}

function extractArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== "object") return [];
  for (const key of keys) {
    const candidate = (value as Record<string, unknown>)[key];
    if (Array.isArray(candidate)) return candidate;
  }
  const byOrigin = (value as Record<string, unknown>).byOrigin;
  if (byOrigin && typeof byOrigin === "object") {
    return Object.values(byOrigin as Record<string, unknown>).flatMap((entry) =>
      Array.isArray(entry) ? entry : [],
    );
  }
  if (
    "localityId" in value ||
    ("id" in value && "gateway" in value) ||
    "routeId" in value
  ) {
    return [value];
  }
  return [];
}

function extractDestinationItems(value: unknown): unknown[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return extractArray(value, ["suggestions", "destinations", "items"]);
  }
  const byOrigin = (value as Record<string, unknown>).byOrigin;
  if (byOrigin && typeof byOrigin === "object" && !Array.isArray(byOrigin)) {
    return Object.entries(byOrigin as Record<string, unknown>).flatMap(([origin, entries]) =>
      (Array.isArray(entries) ? entries : []).map((entry) =>
        entry && typeof entry === "object" && !Array.isArray(entry)
          ? {
              ...(entry as Record<string, unknown>),
              supportedOrigins:
                (entry as Record<string, unknown>).supportedOrigins ?? [origin],
            }
          : entry,
      ),
    );
  }
  return extractArray(value, ["suggestions", "destinations", "items"]);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string =>
          typeof item === "string" && item.trim().length > 0,
        )
        .map((item) => item.trim())
    : [];
}

function monthArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const month = parseMonthValue(item);
    return month === undefined ? [] : [month];
  });
}

function parseMonthValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  const index = MONTH_NAMES.findIndex((month) => month.toLowerCase() === normalized);
  return index >= 0 ? index + 1 : undefined;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/\s+/g, " ");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceRef(file: string): string {
  const marker = `${path.sep}data${path.sep}`;
  const index = file.lastIndexOf(marker);
  return index >= 0
    ? `data/${file.slice(index + marker.length).split(path.sep).join("/")}`
    : file.split(path.sep).join("/");
}
