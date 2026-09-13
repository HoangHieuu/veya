import type { DestinationCity } from "./types.js";

/** Curated geographic coverage — provinces/regions → nearest VNA gateway (HAN, SGN, DAD). */
export interface LocalityGatewayData {
  version: string;
  visitContextPatterns: string[];
  regions: Array<{
    id: string;
    gateway: DestinationCity;
    boost: number;
    patterns: string[];
  }>;
  localities: Array<{
    id: string;
    title: string;
    patterns: string[];
    gateway: DestinationCity;
    boost: number;
  }>;
  defaultLocalityBoost: number;
}

export interface RawLocalityGatewayFile {
  version: string;
  visitContextPatterns?: string[];
  regions?: LocalityGatewayData["regions"];
  gatewayProvinces?: Partial<Record<DestinationCity, string[]>>;
  localityBoost?: number;
}

/**
 * \u0110/\u0111 carries no combining mark, so NFD leaves it intact and stripping marks
 * alone turns "\u0110\u00e0 N\u1eb5ng" into "a-nang". Map it explicitly before folding.
 */
function foldDiacritics(text: string): string {
  return text
    .replace(/[\u0110]/g, "D")
    .replace(/[\u0111]/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function slugify(name: string): string {
  return foldDiacritics(name.toLowerCase())
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function nameToPattern(name: string): string {
  const escaped = name
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, "\\s*");
  return `\\b${escaped}\\b`;
}

/** Expand Person B province lists into matchable localities at load time. */
export function normalizeLocalityGateway(raw: RawLocalityGatewayFile): LocalityGatewayData {
  const localities: LocalityGatewayData["localities"] = [];
  const seenIds = new Set<string>();

  for (const gateway of ["HAN", "SGN", "DAD"] as const) {
    const names = raw.gatewayProvinces?.[gateway] ?? [];
    const boost = raw.localityBoost ?? 0.55;
    for (const name of names) {
      const trimmed = name.trim();
      if (!trimmed) continue;
      let id = slugify(trimmed);
      if (seenIds.has(id)) {
        const existing = localities.find((l) => l.id === id);
        if (existing) {
          const pattern = nameToPattern(trimmed);
          if (!existing.patterns.includes(pattern)) {
            existing.patterns.push(pattern);
          }
        }
        continue;
      }
      seenIds.add(id);
      localities.push({
        id,
        title: trimmed,
        patterns: [nameToPattern(trimmed)],
        gateway,
        boost,
      });
    }
  }

  return {
    version: raw.version,
    visitContextPatterns: raw.visitContextPatterns ?? [],
    regions: raw.regions ?? [],
    localities,
    defaultLocalityBoost: raw.localityBoost ?? 0.55,
  };
}

function isNegatedMention(text: string, matchIndex: number): boolean {
  const window = text.slice(Math.max(0, matchIndex - 40), matchIndex);
  return /\b(?:not|avoid|skip|without|no)\s+(?:going\s+to\s+)?$/i.test(window);
}

/** Match user text with or without Vietnamese diacritics (e.g. Cà Mau ↔ Ca Mau). */
function foldForMatch(text: string): string {
  return foldDiacritics(text);
}

function patternMatch(source: string, text: string): RegExpExecArray | null {
  try {
    return new RegExp(foldForMatch(source), "i").exec(foldForMatch(text));
  } catch {
    return null;
  }
}

function testPattern(source: string, text: string): boolean {
  const match = patternMatch(source, text);
  if (!match || match.index === undefined) return false;
  return !isNegatedMention(text, match.index);
}

export function inferGatewayFromLocalities(
  text: string,
  data: LocalityGatewayData,
): DestinationCity | undefined {
  let best: { gateway: DestinationCity; score: number } | undefined;

  for (const locality of data.localities) {
    const hit = locality.patterns.some((p) => testPattern(p, text));
    if (!hit) continue;
    const score = locality.boost;
    if (!best || score > best.score) {
      best = { gateway: locality.gateway, score };
    }
  }

  for (const region of data.regions) {
    const hit = region.patterns.some((p) => testPattern(p, text));
    if (!hit) continue;
    if (!best || region.boost > best.score) {
      best = { gateway: region.gateway, score: region.boost };
    }
  }

  return best?.gateway;
}

export function applyLocalityAffinity(
  text: string,
  data: LocalityGatewayData,
  gatewayAffinity: Record<DestinationCity, number>,
  matchedTitles: string[],
): boolean {
  let any = false;
  for (const locality of data.localities) {
    const hit = locality.patterns.some((p) => testPattern(p, text));
    if (!hit) continue;
    gatewayAffinity[locality.gateway] += locality.boost;
    matchedTitles.push(locality.title);
    any = true;
  }
  for (const region of data.regions) {
    const hit = region.patterns.some((p) => testPattern(p, text));
    if (hit) {
      gatewayAffinity[region.gateway] += region.boost;
      any = true;
    }
  }
  return any;
}

export function hasVisitLocationContext(text: string, data: LocalityGatewayData): boolean {
  return data.visitContextPatterns.some((p) => testPattern(p, text));
}

/** Human-readable province/locality names mentioned in brief text (e.g. Cà Mau). */
export function extractMentionedLocalities(
  text: string,
  data: LocalityGatewayData,
): string[] {
  const titles: string[] = [];
  applyLocalityAffinity(text, data, { HAN: 0, SGN: 0, DAD: 0 }, titles);
  return titles;
}
