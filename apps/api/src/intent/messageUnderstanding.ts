import type {
  AgentMessageIntent,
  DestinationCity,
  FareBrandId,
  MonthName,
  OriginCity,
  TravelStyle,
  TripSummary,
} from "../../../../shared/types.js";
import {
  extractMentionedLocalities,
  inferGatewayFromLocalities,
  loadLocalityGateway,
} from "../dataset/localityGateway.js";
import { inferGatewayFromText, loadNeedPlaceMap } from "../dataset/needPlaceMap.js";
import { COMPANION_TRAVEL_STYLES } from "./constants.js";
import { addDaysUtc, isIsoDate, MONTHS } from "./dateWindow.js";
import { isNegatedDestinationMention } from "./discoveryMode.js";
import {
  DESTINATION_LEXICON,
  ORIGIN_LEXICON,
  STYLE_LEXICON,
} from "./lexicon.js";

/**
 * A trip patch where `null` means "the traveller cleared this field" and an
 * absent key means "leave whatever is already there". The orchestrator relies
 * on that distinction to support corrections like "actually, not Da Nang".
 */
export type TripPatch = {
  [K in keyof Omit<TripSummary, "memberProfile">]?: TripSummary[K] | null;
};

export interface UnderstoodMessage {
  intent: AgentMessageIntent;
  patch: TripPatch;
  /** Populated when intent === "select_fare". */
  fareBrandId?: FareBrandId;
  /** Populated when intent === "policy_question"; the question to send to RAG. */
  policyQuestion?: string;
  usedLlm: boolean;
}

const MONTH_TITLES: MonthName[] = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const FARE_BRAND_PATTERNS: ReadonlyArray<{ pattern: RegExp; brandId: FareBrandId }> = [
  { pattern: /\bbusiness\s*flex\b|\bth[uư]ơng\s*gia\s*flex\b/i, brandId: "business_flex" },
  { pattern: /\bbusiness\s*(?:classic|class)?\b|\bth[uư]ơng\s*gia\b/i, brandId: "business_classic" },
  { pattern: /\bpremium\s*economy\b|\bph[oổ]\s*th[oô]ng\s*[dđ]ặc\s*biệt\b/i, brandId: "premium_economy" },
  { pattern: /\beconomy\s*flex\b|\bph[oổ]\s*th[oô]ng\s*linh\s*hoạt\b/i, brandId: "economy_flex" },
  { pattern: /\beconomy\s*lite\b|\bph[oổ]\s*th[oô]ng\s*tiết\s*kiệm\b/i, brandId: "economy_lite" },
  { pattern: /\beconomy\s*classic\b|\bph[oổ]\s*th[oô]ng\s*ti[eê]u\s*chu[aẩ]n\b/i, brandId: "economy_classic" },
];

const POLICY_PATTERNS: readonly RegExp[] = [
  /\bbaggage\b|\bluggage\b|\bbag(?:s)?\s+allow/i,
  /\bh[aà]nh\s*l[yý]\b|\bk[yý]\s*g[uử]i\b|\bx[aá]ch\s*tay\b/i,
  /\bcarry[- ]on\b|\bhand\s*bag/i,
  /\brefund(?:able)?\b|\bcancel(?:lation)?\b|\bho[aà]n\s*(?:ti[eề]n|v[eé])\b|\bh[uủ]y\s*v[eé]\b/i,
  /\bchange\s+(?:my\s+)?(?:flight|ticket|booking|date)\b|\breschedul|\brebook|\b[dđ][oổ]i\s*(?:v[eé]|ng[aà]y|chuy[eế]n)\b/i,
  /\bfare\s*(?:rule|condition|type)s?\b|\b[dđ]i[eề]u\s*ki[eệ]n\s*v[eé]\b/i,
  /\bcheck[- ]?in\b|\bl[aà]m\s*th[uủ]\s*t[uụ]c\b/i,
  /\bpolicy\b|\bch[ií]nh\s*s[aá]ch\b|\bquy\s*[dđ][iị]nh\b/i,
  /\bprohibit|\brestricted\b|\bkh[oô]ng\s*[dđ][uư][oợ]c\s*mang\b/i,
  /\bexcess\s+baggage\b|\bqu[aá]\s*c[uư][oớ]c\b/i,
  /\bpet\b|\bstroller\b|\bsports?\s+equipment\b|\bmusical\s+instrument\b/i,
  /\btax(?:es)?\b|\bsurcharge\b|\bfee(?:s)?\b|\bph[ií]\b/i,
];

const QUESTION_PATTERNS: readonly RegExp[] = [
  /\?\s*$/,
  /^(?:what|how|can|could|is|are|do|does|may|will|which|when|am|i'?m allowed)\b/i,
  /^(?:cho\s*(?:m[iì]nh|t[oô]i)|m[iì]nh|t[oô]i)?\s*(?:mu[oố]n\s*)?h[oỏ]i\b/i,
  /\b(?:bao\s*nhi[eê]u|c[oó]\s*[dđ][uư][oư][oợ]c|nh[uư]\s*th[eế]\s*n[aà]o|ra\s*sao|th[eế]\s*n[aà]o)\b/i,
];

const RESET_PATTERNS: readonly RegExp[] = [
  /\b(?:start|begin)\s+(?:over|again)\b/i,
  /\breset\b|\bclear\s+(?:everything|all|my\s+trip)\b/i,
  /\bl[aà]m\s*l[aạ]i\s*t[uừ]\s*[dđ][aầ]u\b|\bb[aắ]t\s*[dđ][aầ]u\s*l[aạ]i\b|\bx[oó]a\s*h[eế]t\b/i,
];

const SMALLTALK_PATTERN =
  /^(?:hi|hello|hey|yo|sup|thanks?|thank you|ok(?:ay)?|cool|nice|good (?:morning|afternoon|evening)|ch[aà]o|xin ch[aà]o|c[aả]m [oơ]n|[uừ]m?)\b[!.?\s]*$/i;

/** "not X", "no longer X", "khong phai X" — signals a field should be cleared. */
const CLEAR_DESTINATION =
  /\b(?:not|no longer|forget|drop|cancel|remove|scrap)\s+(?:the\s+)?(?:destination|where)\b|\bkh[oô]ng\s*[dđ]i\s*n[uữ]a\b|\b[dđ][uừ]ng\s*[dđ]i\b/i;
const CLEAR_DATES =
  /\b(?:no|not|remove|clear|forget|drop)\s+(?:my\s+)?(?:dates?|travel dates?)\b|\bch[uư]a\s*(?:c[oó]\s*)?ng[aà]y\b|\bb[oỏ]\s*ng[aà]y\b/i;

export interface UnderstandOptions {
  now: Date;
  /** Set false to skip the LLM entirely (tests, offline demos). */
  llmEnabled?: boolean;
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
}

/**
 * Free-text chat turn → intent + trip patch.
 *
 * The deterministic pass always runs and is authoritative for anything it is
 * confident about; the LLM pass only fills what the regexes could not read and
 * can propose explicit clears. When the LLM is unavailable the deterministic
 * result stands on its own, so chat keeps working offline.
 */
export async function understandMessage(
  message: string,
  current: TripSummary,
  options: UnderstandOptions,
): Promise<UnderstoodMessage> {
  const text = message.trim();
  if (!text) {
    return { intent: "smalltalk", patch: {}, usedLlm: false };
  }

  const deterministic = understandDeterministically(text, current, options.now);
  if (deterministic.intent === "reset" || deterministic.intent === "policy_question") {
    return deterministic;
  }

  if (!shouldCallLlm(options)) return deterministic;

  try {
    const llm = await callUnderstandingLlm(text, current, options);
    if (!llm) return deterministic;
    return mergeUnderstanding(deterministic, llm, current);
  } catch {
    return deterministic;
  }
}

export function understandDeterministically(
  text: string,
  current: TripSummary,
  now: Date,
): UnderstoodMessage {
  if (RESET_PATTERNS.some((pattern) => pattern.test(text))) {
    return { intent: "reset", patch: {}, usedLlm: false };
  }

  const fareBrandId = extractFareBrand(text);
  if (fareBrandId) {
    // "I'll take Economy Flex" and a bare "Economy Lite please" mean the same
    // thing; only a question about a brand ("what does Business Flex include?")
    // should fall through to the policy path.
    const asksAbout = isPolicyQuestion(text) || QUESTION_PATTERNS.some((p) => p.test(text));
    if (!asksAbout) {
      return { intent: "select_fare", patch: { fareBrandId }, fareBrandId, usedLlm: false };
    }
  }

  if (isPolicyQuestion(text)) {
    return {
      intent: "policy_question",
      patch: {},
      policyQuestion: text,
      usedLlm: false,
    };
  }

  const patch: TripPatch = {};

  const origin = extractOrigin(text);
  if (origin) patch.originCity = origin;

  const style = extractTravelStyle(text);
  if (style) patch.travelStyle = COMPANION_TRAVEL_STYLES[style]?.[0] ?? style;

  const travellers = extractTravellers(text);
  if (travellers !== undefined) patch.travellers = travellers;

  const locality = resolveLocality(text);
  if (locality) {
    patch.destinationLocalityId = locality.id;
    patch.destinationTitle = locality.title;
    if (locality.gateway) patch.gateway = locality.gateway;
  } else {
    const gateway = extractExplicitGateway(text);
    if (gateway) patch.gateway = gateway;
  }

  const dates = extractDates(text, now, current);
  Object.assign(patch, dates);

  if (CLEAR_DESTINATION.test(text)) {
    patch.destinationLocalityId = null;
    patch.destinationTitle = null;
    patch.gateway = null;
  }
  if (CLEAR_DATES.test(text)) {
    patch.departDate = null;
    patch.returnDate = null;
    patch.departMonth = null;
  }

  if (fareBrandId) patch.fareBrandId = fareBrandId;

  if (Object.keys(patch).length === 0) {
    return {
      intent: SMALLTALK_PATTERN.test(text) ? "smalltalk" : "unknown",
      patch: {},
      usedLlm: false,
    };
  }

  return {
    intent: isChangeRequest(text, patch, current) ? "change_trip" : "update_trip",
    patch,
    ...(fareBrandId ? { fareBrandId } : {}),
    usedLlm: false,
  };
}

/** True when the message contradicts a field the traveller already set. */
function isChangeRequest(
  text: string,
  patch: TripPatch,
  current: TripSummary,
): boolean {
  if (/\b(?:actually|instead|rather|change|switch|swap|make it|no wait|on second thought)\b/i.test(text)) {
    return true;
  }
  if (/\b(?:th[aậ]y\s*v[iì]|[dđ][oổ]i\s*(?:sang|th[aà]nh)|chuy[eể]n\s*sang|kh[oô]ng\s*ph[aả]i)\b/i.test(text)) {
    return true;
  }
  return (Object.entries(patch) as [keyof TripSummary, unknown][]).some(
    ([field, value]) => {
      const existing = current[field];
      if (existing === undefined) return false;
      return value === null || JSON.stringify(value) !== JSON.stringify(existing);
    },
  );
}

function isPolicyQuestion(text: string): boolean {
  const mentionsPolicy = POLICY_PATTERNS.some((pattern) => pattern.test(text));
  if (!mentionsPolicy) return false;
  // "2 bags for the family in April" is a trip detail, not a rules question.
  return QUESTION_PATTERNS.some((pattern) => pattern.test(text));
}

function extractFareBrand(text: string): FareBrandId | undefined {
  for (const entry of FARE_BRAND_PATTERNS) {
    if (entry.pattern.test(text)) return entry.brandId;
  }
  return undefined;
}

function extractOrigin(text: string): OriginCity | undefined {
  for (const entry of ORIGIN_LEXICON) {
    if (entry.pattern.test(text)) return entry.city;
  }
  return undefined;
}

function extractTravelStyle(text: string): TravelStyle | undefined {
  for (const entry of STYLE_LEXICON) {
    if (entry.pattern.test(text)) return entry.style;
  }
  return undefined;
}

function extractTravellers(text: string): number | undefined {
  const adults = text.match(/\b(\d+)\s*(?:adults?|ng[uư][oờ]i\s*l[oớ]n|kh[aá]ch|pax)\b/i);
  if (adults) return clampTravellers(Number(adults[1]));
  const familyOf = text.match(/\bfamily\s+of\s+(\d+)\b|\bgia\s*[dđ][iì]nh\s*(\d+)\s*ng[uư][oờ]i\b/i);
  if (familyOf) return clampTravellers(Number(familyOf[1] ?? familyOf[2]));
  const people = text.match(/\b(\d+)\s+(?:of us|people|travellers?|travelers?)\b/i);
  if (people) return clampTravellers(Number(people[1]));
  if (/\bsolo\b|\bjust me\b|\bby myself\b|\b[dđ]i\s*m[oộ]t\s*m[iì]nh\b/i.test(text)) return 1;
  if (/\bwith\s+(?:a|my)\s+(?:friend|partner|wife|husband)\b|\bfor\s+two\b|\bhai\s*ng[uư][oờ]i\b/i.test(text)) {
    return 2;
  }
  return undefined;
}

function clampTravellers(value: number): number | undefined {
  if (!Number.isFinite(value)) return undefined;
  const rounded = Math.floor(value);
  if (rounded < 1 || rounded > 20) return undefined;
  return rounded;
}

function extractExplicitGateway(text: string): DestinationCity | undefined {
  for (const entry of DESTINATION_LEXICON) {
    const match = text.match(entry.pattern);
    if (!match || match.index === undefined) continue;
    if (isNegatedDestinationMention(text, match.index)) continue;
    return entry.city;
  }
  return undefined;
}

function resolveLocality(
  text: string,
): { id: string; title: string; gateway?: DestinationCity } | undefined {
  const data = loadLocalityGateway();
  const titles = extractMentionedLocalities(text, data);
  if (titles.length > 0) {
    const title = titles[0];
    return { id: slugify(title), title, gateway: inferGatewayFromLocalities(text, data) };
  }

  for (const entry of DESTINATION_LEXICON) {
    const match = text.match(entry.pattern);
    if (!match || match.index === undefined) continue;
    if (isNegatedDestinationMention(text, match.index)) continue;
    return { id: entry.city.toLowerCase(), title: match[0], gateway: entry.city };
  }

  const fromPlaces = inferGatewayFromText(text, loadNeedPlaceMap());
  if (fromPlaces) {
    return { id: fromPlaces.toLowerCase(), title: fromPlaces, gateway: fromPlaces };
  }
  return undefined;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    // Đ/đ has no NFD decomposition, so strip-the-marks alone turns "Đà Nẵng"
    // into "a-nang" and the id stops matching the dataset's "da-nang".
    .replace(/[Đđ]/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------

const MONTH_WORD =
  "january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec";

/**
 * Reads departure and return dates from free text, including ranges, durations
 * ("for 2 weeks"), and bare months. Returns only the keys it is sure about so
 * the caller can merge without clobbering.
 */
export function extractDates(
  text: string,
  now: Date,
  current: TripSummary,
): TripPatch {
  const patch: TripPatch = {};
  const found = collectDates(text, now);

  const rangeWords =
    /\b(?:from|between|depart(?:ing|s)?\s+on|leaving\s+on|t[uừ]\s*ng[aà]y|[dđ]i\s*ng[aà]y)\b/i;
  const returnWords =
    /\b(?:to|until|till|through|returning|return(?:ing)?\s+on|back\s+on|come\s+back|[dđ][eế]n\s*ng[aà]y|v[eề]\s*ng[aà]y|v[eề]\s*l[aạ]i)\b/i;

  if (found.length >= 2) {
    patch.departDate = found[0];
    patch.returnDate = found[1];
  } else if (found.length === 1) {
    const single = found[0];
    const isReturn =
      returnWords.test(text) && !rangeWords.test(text) && Boolean(current.departDate);
    if (isReturn) {
      patch.returnDate = single;
    } else {
      patch.departDate = single;
      const duration = extractDurationDays(text);
      if (duration !== undefined) patch.returnDate = addDaysUtc(single, duration);
    }
  }

  if (patch.departDate && !patch.returnDate && !current.returnDate) {
    const duration = extractDurationDays(text);
    if (duration !== undefined) patch.returnDate = addDaysUtc(patch.departDate, duration);
  }

  if (patch.departDate) {
    patch.departMonth = MONTH_TITLES[Number(patch.departDate.slice(5, 7)) - 1];
  } else {
    const month = extractMonthName(text, now);
    if (month) patch.departMonth = month;
  }

  // Never emit an inverted window; drop the return instead of failing the turn.
  if (
    patch.departDate &&
    patch.returnDate &&
    patch.returnDate < patch.departDate
  ) {
    delete patch.returnDate;
  }
  if (
    patch.returnDate &&
    !patch.departDate &&
    current.departDate &&
    patch.returnDate < current.departDate
  ) {
    delete patch.returnDate;
  }

  return patch;
}

function collectDates(text: string, now: Date): string[] {
  const hits: { index: number; iso: string }[] = [];
  // Each pass blanks out what it consumed, so "2026-04-12" is not also read as
  // the day/month pair "04-12" by the next pattern.
  let remaining = text;

  const consume = (pattern: RegExp, read: (match: RegExpExecArray) => string | undefined) => {
    remaining = remaining.replace(pattern, (...args) => {
      const groups = args.slice(0, -2) as string[];
      const index = args[args.length - 2] as number;
      const match = Object.assign(groups, { index }) as unknown as RegExpExecArray;
      const iso = read(match);
      if (iso) hits.push({ index, iso });
      return " ".repeat(args[0].length);
    });
  };

  consume(/\b20\d{2}-\d{2}-\d{2}\b/g, (match) =>
    isIsoDate(match[0]) ? match[0] : undefined,
  );

  // 12/04/2026, 12-04-26, 12/4 — day first, matching AU convention.
  consume(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](\d{2,4}))?\b/g, (match) => {
    const day = Number(match[1]);
    const month = Number(match[2]);
    return toIso(resolveYear(match[3], month, day, now), month, day);
  });

  // 12 April 2026 / 12 April
  consume(
    new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORD})\\b(?:\\s+(\\d{4}))?`, "gi"),
    (match) => {
      const day = Number(match[1]);
      const month = monthIndex(match[2]);
      if (month === undefined) return undefined;
      return toIso(resolveYear(match[3], month + 1, day, now), month + 1, day);
    },
  );

  // April 12 / April 12, 2026
  consume(
    new RegExp(`\\b(${MONTH_WORD})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`, "gi"),
    (match) => {
      const month = monthIndex(match[1]);
      const day = Number(match[2]);
      if (month === undefined || day > 31) return undefined;
      return toIso(resolveYear(match[3], month + 1, day, now), month + 1, day);
    },
  );

  hits.sort((a, b) => a.index - b.index);
  const unique: string[] = [];
  for (const hit of hits) {
    if (!unique.includes(hit.iso)) unique.push(hit.iso);
  }
  return unique;
}

function extractDurationDays(text: string): number | undefined {
  const weeks = text.match(/\bfor\s+(\d+)\s+weeks?\b|\b(\d+)\s+tu[aầ]n\b/i);
  if (weeks) return Number(weeks[1] ?? weeks[2]) * 7;
  const nights = text.match(/\bfor\s+(\d+)\s+nights?\b|\b(\d+)\s+[dđ][eê]m\b/i);
  if (nights) return Number(nights[1] ?? nights[2]);
  const days = text.match(/\bfor\s+(\d+)\s+days?\b|\b(\d+)\s+ng[aà]y\b/i);
  if (days) return Number(days[1] ?? days[2]);
  return undefined;
}

function extractMonthName(text: string, now: Date): MonthName | undefined {
  const mid = text.match(new RegExp(`\\bmid[- ](${MONTH_WORD})\\b`, "i"));
  if (mid) {
    const index = monthIndex(mid[1]);
    if (index !== undefined) return MONTH_TITLES[index];
  }
  const explicit = text.match(new RegExp(`\\b(?:in|during|for|next)\\s+(${MONTH_WORD})\\b`, "i"));
  if (explicit) {
    const index = monthIndex(explicit[1]);
    if (index !== undefined) return MONTH_TITLES[index];
  }
  const viet = text.match(/\bth[aá]ng\s*(\d{1,2})\b/i);
  if (viet) {
    const month = Number(viet[1]);
    if (month >= 1 && month <= 12) return MONTH_TITLES[month - 1];
  }
  const lone = text.match(new RegExp(`\\b(${MONTH_WORD})\\b`, "i"));
  if (lone) {
    const index = monthIndex(lone[1]);
    if (index !== undefined) return MONTH_TITLES[index];
  }
  if (/\bnext\s+month\b|\bth[aá]ng\s*sau\b/i.test(text)) {
    return MONTH_TITLES[(now.getUTCMonth() + 1) % 12];
  }
  return undefined;
}

function monthIndex(word: string): number | undefined {
  const key = word.toLowerCase();
  if (key in MONTHS) return MONTHS[key];
  const abbreviations: Record<string, number> = {
    jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6,
    aug: 7, sep: 8, sept: 8, oct: 9, nov: 10, dec: 11,
  };
  return abbreviations[key];
}

/** Bare day/month means the next occurrence, so "12/4" never books the past. */
function resolveYear(
  raw: string | undefined,
  month: number,
  day: number,
  now: Date,
): number {
  if (raw) {
    const value = Number(raw);
    return value < 100 ? 2000 + value : value;
  }
  const year = now.getUTCFullYear();
  const candidate = Date.UTC(year, month - 1, day);
  return candidate >= Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ? year
    : year + 1;
}

function toIso(year: number, month: number, day: number): string | undefined {
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;
  const iso = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return isIsoDate(iso) ? iso : undefined;
}

// ---------------------------------------------------------------------------
// LLM pass
// ---------------------------------------------------------------------------

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_TIMEOUT_MS = 4_000;

const NULLABLE_STRING = { anyOf: [{ type: "string" }, { type: "null" }] } as const;

export const UNDERSTANDING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent", "patch", "fareBrandId", "policyQuestion"],
  properties: {
    intent: {
      type: "string",
      enum: [
        "update_trip",
        "change_trip",
        "select_fare",
        "policy_question",
        "reset",
        "smalltalk",
        "unknown",
      ],
    },
    fareBrandId: {
      anyOf: [
        {
          type: "string",
          enum: [
            "economy_lite",
            "economy_classic",
            "economy_flex",
            "premium_economy",
            "business_classic",
            "business_flex",
          ],
        },
        { type: "null" },
      ],
    },
    policyQuestion: NULLABLE_STRING,
    patch: {
      type: "object",
      additionalProperties: false,
      required: [
        "originCity",
        "travelStyle",
        "destinationTitle",
        "gateway",
        "travellers",
        "departDate",
        "returnDate",
      ],
      properties: {
        originCity: {
          anyOf: [{ type: "string", enum: ["SYD", "MEL", "PER"] }, { type: "null" }],
        },
        travelStyle: {
          anyOf: [
            {
              type: "string",
              enum: [
                "beach_relaxation",
                "food_culture",
                "education",
                "family",
                "vfr",
                "mixed",
              ],
            },
            { type: "null" },
          ],
        },
        destinationTitle: NULLABLE_STRING,
        gateway: {
          anyOf: [{ type: "string", enum: ["HAN", "SGN", "DAD"] }, { type: "null" }],
        },
        travellers: {
          anyOf: [{ type: "integer", minimum: 1, maximum: 20 }, { type: "null" }],
        },
        departDate: NULLABLE_STRING,
        returnDate: NULLABLE_STRING,
      },
    },
  },
} as const;

function shouldCallLlm(options: UnderstandOptions): boolean {
  if (options.llmEnabled === false) return false;
  const key = options.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  if (!key) return false;
  return process.env.AGENT_LLM_ENABLED !== "false";
}

interface LlmUnderstanding {
  intent: AgentMessageIntent;
  patch: TripPatch;
  fareBrandId?: FareBrandId;
  policyQuestion?: string;
}

function buildSystemPrompt(now: Date): string {
  return [
    "You read one chat message from a traveller planning a Vietnam Airlines trip",
    "from Australia (Sydney, Melbourne or Perth) and return a structured update.",
    `Today is ${now.toISOString().slice(0, 10)}.`,
    "",
    "Rules:",
    "- Only include a patch field when THIS message states or changes it.",
    "- Use null for a field the traveller explicitly removes or negates",
    '  ("not Da Nang after all", "forget the dates").',
    "- Omit nothing from the schema: set unmentioned fields to null ONLY when the",
    "  traveller cleared them; otherwise repeat the value they already have if",
    "  the message confirms it, or use null when it was never mentioned and is",
    "  currently unset.",
    "- Dates are ISO YYYY-MM-DD and must be in the future. Day/month order is",
    "  Australian (12/04 is 12 April).",
    "- gateway must be the Vietnamese arrival airport: HAN (Hanoi), SGN (Ho Chi",
    "  Minh City) or DAD (Da Nang). Infer it from any province or town named",
    "  (e.g. Cà Mau and the Mekong delta -> SGN, Hoi An -> DAD, Ninh Binh -> HAN).",
    '- intent "policy_question" is for questions about baggage, fare rules,',
    "  refunds, changes, check-in or other airline policy. Put the question in",
    "  policyQuestion and leave the patch empty.",
    '- intent "change_trip" when the message contradicts something already set.',
    '- intent "reset" when they want to start over.',
    '- intent "smalltalk" for greetings and thanks with no trip content.',
  ].join("\n");
}

async function callUnderstandingLlm(
  text: string,
  current: TripSummary,
  options: UnderstandOptions,
): Promise<LlmUnderstanding | undefined> {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return undefined;

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  // The link to OpenAI drops connections intermittently (ECONNRESET). Without a
  // retry a single reset silently downgrades the turn to the regex-only parse,
  // which reads the same message differently — so the chat felt inconsistent.
  for (let attempt = 1; attempt <= LLM_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await requestUnderstanding(text, current, options, apiKey, controller.signal);
    } catch (error) {
      if (attempt === LLM_ATTEMPTS) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
  return undefined;
}

const LLM_ATTEMPTS = 2;

async function requestUnderstanding(
  text: string,
  current: TripSummary,
  options: UnderstandOptions,
  apiKey: string,
  signal: AbortSignal,
): Promise<LlmUnderstanding | undefined> {
  {
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: options.model ?? process.env.OPENAI_MODEL?.trim() ?? DEFAULT_MODEL,
        temperature: 0,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "agent_message_understanding",
            strict: true,
            schema: UNDERSTANDING_JSON_SCHEMA,
          },
        },
        messages: [
          { role: "system", content: buildSystemPrompt(options.now) },
          {
            role: "user",
            content: [
              `Current trip so far: ${JSON.stringify(stripProfile(current))}`,
              `Message: ${text}`,
            ].join("\n"),
          },
        ],
      }),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return undefined;
    return parseLlmUnderstanding(JSON.parse(content) as unknown, current);
  }
}

function stripProfile(trip: TripSummary): Omit<TripSummary, "memberProfile"> {
  const { memberProfile: _memberProfile, ...rest } = trip;
  return rest;
}

function parseLlmUnderstanding(
  raw: unknown,
  current: TripSummary,
): LlmUnderstanding | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const intent = value.intent;
  if (typeof intent !== "string") return undefined;

  const patchRaw = (value.patch ?? {}) as Record<string, unknown>;
  const patch: TripPatch = {};

  assignIfMeaningful(patch, "originCity", patchRaw.originCity, current.originCity);
  assignIfMeaningful(patch, "travelStyle", patchRaw.travelStyle, current.travelStyle);
  assignIfMeaningful(patch, "gateway", patchRaw.gateway, current.gateway);
  assignIfMeaningful(
    patch,
    "destinationTitle",
    patchRaw.destinationTitle,
    current.destinationTitle,
  );
  assignIfMeaningful(patch, "travellers", patchRaw.travellers, current.travellers);
  assignIfMeaningful(patch, "departDate", patchRaw.departDate, current.departDate);
  assignIfMeaningful(patch, "returnDate", patchRaw.returnDate, current.returnDate);

  if (patch.destinationTitle === null) {
    patch.destinationLocalityId = null;
  } else if (
    typeof patch.destinationTitle === "string" &&
    patch.destinationTitle !== current.destinationTitle
  ) {
    // Only re-derive the id for a genuinely new destination. The model often
    // echoes the current title back; slugging that would replace a curated id
    // (say "spotlight-dad") with a guess and read as a route change.
    patch.destinationLocalityId = slugify(patch.destinationTitle);
  } else if (typeof patch.destinationTitle === "string") {
    delete patch.destinationTitle;
  }

  for (const field of ["departDate", "returnDate"] as const) {
    const candidate = patch[field];
    if (typeof candidate === "string" && !isIsoDate(candidate)) delete patch[field];
  }
  if (typeof patch.departDate === "string") {
    patch.departMonth = MONTH_TITLES[Number(patch.departDate.slice(5, 7)) - 1];
  }

  const fareBrandId =
    typeof value.fareBrandId === "string" ? (value.fareBrandId as FareBrandId) : undefined;
  if (fareBrandId) patch.fareBrandId = fareBrandId;

  const policyQuestion =
    typeof value.policyQuestion === "string" && value.policyQuestion.trim()
      ? value.policyQuestion.trim()
      : undefined;

  return {
    intent: intent as AgentMessageIntent,
    patch,
    ...(fareBrandId ? { fareBrandId } : {}),
    ...(policyQuestion ? { policyQuestion } : {}),
  };
}

/**
 * The schema forces every key to be present, so a `null` only means "clear"
 * when the field actually held a value; otherwise it is just "not mentioned".
 */
function assignIfMeaningful<K extends keyof TripPatch>(
  patch: TripPatch,
  field: K,
  value: unknown,
  existing: unknown,
): void {
  if (value === null) {
    if (existing !== undefined) patch[field] = null as TripPatch[K];
    return;
  }
  if (value === undefined) return;
  patch[field] = value as TripPatch[K];
}

function mergeUnderstanding(
  deterministic: UnderstoodMessage,
  llm: LlmUnderstanding,
  current: TripSummary,
): UnderstoodMessage {
  if (llm.intent === "policy_question" && llm.policyQuestion) {
    return {
      intent: "policy_question",
      patch: {},
      policyQuestion: llm.policyQuestion,
      usedLlm: true,
    };
  }
  if (llm.intent === "reset") {
    return { intent: "reset", patch: {}, usedLlm: true };
  }

  // Regexes beat the model on the fields they can read (airport codes, counts);
  // the model fills the rest and supplies the clears.
  const patch: TripPatch = { ...llm.patch, ...deterministic.patch };

  if (Object.keys(patch).length === 0) {
    return {
      intent: llm.intent === "unknown" ? deterministic.intent : llm.intent,
      patch: {},
      usedLlm: true,
    };
  }

  const fareBrandId = deterministic.fareBrandId ?? llm.fareBrandId;
  const intent: AgentMessageIntent =
    deterministic.intent === "select_fare" || llm.intent === "select_fare"
      ? "select_fare"
      : isChangeRequest("", patch, current) ||
          deterministic.intent === "change_trip" ||
          llm.intent === "change_trip"
        ? "change_trip"
        : "update_trip";

  return {
    intent,
    patch,
    ...(fareBrandId ? { fareBrandId } : {}),
    usedLlm: true,
  };
}
