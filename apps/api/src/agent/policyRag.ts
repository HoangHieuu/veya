import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { FareOption, TripSummary } from "../../../../shared/types.js";

const DATA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data",
);

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = () => process.env.OPENAI_MODEL?.trim() || "gpt-4.1-nano";
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** Below this hybrid score, the corpus is treated as having no answer. */
const RELEVANCE_THRESHOLD = 0.3;
const TOP_K = 5;
/** Weight of the lexical overlap term relative to cosine similarity. */
const LEXICAL_WEIGHT = 0.35;

export interface PolicyChunk {
  id: string;
  docId: string;
  docTitle: string;
  breadcrumb: string[];
  title: string;
  text: string;
  sourceUrl: string;
  capturedAt: string;
  embedding: number[];
}

interface PolicyCorpusFile {
  version: string;
  model: string;
  dims: number;
  chunks: PolicyChunk[];
}

let corpusCache: PolicyCorpusFile | undefined;

/**
 * Site chrome that the scraper picked up as if it were policy prose: global nav
 * lists, the footer, and the "you are about to leave vietnamairlines.com"
 * interstitial. These chunks are real text but answer nothing, and they crowd
 * out genuine passages in the top-K, so they are dropped at load time.
 */
const NOISE_PATTERNS: readonly RegExp[] = [
  /About Us\s*-\s*Our Fleet/i,
  /Claim\/Suggestions?\s*-\s*Helpdesk/i,
  /Terms & Conditions\s*-\s*Conditions Of Carriage/i,
  /Partnership With Lotusmiles\s*-\s*Heritage Magazine/i,
  /Booking & Ticketing Policy\s*$/i,
  /Cargo Website\s*Note: Link opens in new window/i,
  /Site map\s*Contact to purchase tickets\s*Cookie Settings/i,
  /You are about to leave Vietnamairlines\.com/i,
];

export function isNoiseChunk(chunk: Pick<PolicyChunk, "text">): boolean {
  const text = chunk.text.trim();
  if (text.length < 40) return true;
  return NOISE_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Some chunks lost their heading during scraping (the Australia/Europe checked
 * baggage table is the one that matters — it is the table this product needs).
 * Recover a display title from the leading ALL-CAPS line so citations and the
 * lexical pass can see it, without touching the stored embedding.
 */
function repairTitle(chunk: PolicyChunk): PolicyChunk {
  if (chunk.title.trim()) return chunk;
  const lead = chunk.text.trim().match(/^([A-Z][A-Z0-9 ,/()'.-]{8,120}?)(?=\s+[A-Z][a-z])/);
  const recovered = lead?.[1]?.trim();
  return recovered ? { ...chunk, title: recovered } : chunk;
}

export function loadPolicyCorpus(): PolicyCorpusFile {
  if (!corpusCache) {
    const raw = JSON.parse(
      readFileSync(path.join(DATA_ROOT, "policy-corpus/vectors.json"), "utf8"),
    ) as PolicyCorpusFile;
    corpusCache = {
      ...raw,
      chunks: raw.chunks.filter((chunk) => !isNoiseChunk(chunk)).map(repairTitle),
    };
  }
  return corpusCache;
}

export function resetPolicyCorpusCacheForTests() {
  corpusCache = undefined;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

const STOP_WORDS = new Set([
  "the", "a", "an", "is", "are", "do", "does", "for", "of", "on", "in", "to",
  "my", "me", "i", "can", "what", "how", "much", "many", "with", "and", "or",
  "this", "that", "it", "be", "am", "if", "at", "from", "you", "your",
]);

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[Đđ]/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/**
 * Jaccard-ish overlap between the question and a chunk's heading path plus body.
 * The embeddings were built with the heading prefix baked in, so a chunk whose
 * heading was lost (Australia baggage) ranks poorly on cosine alone; this term
 * lets the literal words in the question rescue it.
 */
function lexicalOverlap(queryTokens: string[], chunk: PolicyChunk): number {
  if (queryTokens.length === 0) return 0;
  const haystack = new Set(
    tokenize(
      [chunk.docTitle, ...chunk.breadcrumb, chunk.title, chunk.text].join(" "),
    ),
  );
  let hits = 0;
  for (const token of new Set(queryTokens)) {
    if (haystack.has(token)) hits += 1;
  }
  return hits / new Set(queryTokens).size;
}

const RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 250;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * OpenAI calls over this link intermittently die with ECONNRESET mid-TLS-read.
 * A single reset is not an answer about policy, so retry briefly before giving
 * up; rate limits and 5xx get the same treatment. Every attempt is bounded by
 * its own timeout so a hung socket cannot stall the whole agent turn.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  attempts = RETRY_ATTEMPTS,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (response.status === 429 || response.status >= 500) {
        if (attempt === attempts) return response;
        lastError = new Error(`HTTP ${response.status}`);
      } else {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === attempts) break;
    } finally {
      clearTimeout(timer);
    }
    await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`request to ${url} failed`);
}

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const res = await fetchWithRetry(
    EMBEDDINGS_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8000) }),
    },
    8_000,
  );
  const body = (await res.json()) as {
    data?: { embedding: number[] }[];
    error?: { message: string };
  };
  if (!res.ok || !body.data?.[0]) {
    throw new Error(`embeddings request failed: ${body.error?.message ?? res.status}`);
  }
  return body.data[0].embedding;
}

export interface PolicyMatch {
  chunk: PolicyChunk;
  score: number;
  cosine: number;
  lexical: number;
}

/**
 * Hybrid semantic + lexical search over the scraped VNA policy corpus (baggage
 * allowances, refund/rebook rules, check-in, legal terms — see
 * data/policy-corpus/sources.json). Returns the top matches above
 * RELEVANCE_THRESHOLD; an empty array means "nothing in the corpus answers
 * this", which callers must treat as "don't answer" rather than guessing.
 */
export async function retrievePolicyChunks(
  question: string,
  apiKey: string,
  topK = TOP_K,
): Promise<PolicyMatch[]> {
  const corpus = loadPolicyCorpus();
  const queryEmbedding = await embedText(question, apiKey);
  const queryTokens = tokenize(question);
  const scored = corpus.chunks.map((chunk) => {
    const cosine = cosineSimilarity(queryEmbedding, chunk.embedding);
    const lexical = lexicalOverlap(queryTokens, chunk);
    return {
      chunk,
      cosine,
      lexical,
      score: cosine + LEXICAL_WEIGHT * lexical,
    };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((m) => m.score >= RELEVANCE_THRESHOLD).slice(0, topK);
}

export interface PolicyAnswerResult {
  answer: string;
  grounded: boolean;
  sources: { title: string; url: string; breadcrumb: string[] }[];
}

export interface PolicyQuestionContext {
  trip?: TripSummary;
  /** The branded fare the traveller selected, if any. */
  selectedFare?: FareOption;
  /** Route label such as "SYD → SGN", used to disambiguate baggage tables. */
  routeLabel?: string;
}

const CITY_NAMES: Record<string, string> = {
  SYD: "Sydney, Australia",
  MEL: "Melbourne, Australia",
  PER: "Perth, Australia",
  HAN: "Hanoi, Vietnam",
  SGN: "Ho Chi Minh City, Vietnam",
  DAD: "Da Nang, Vietnam",
};

/**
 * "What's the baggage for this ticket?" is unanswerable on its own — the
 * corpus splits baggage by itinerary region and cabin. Restate the question
 * with the traveller's actual route and cabin so retrieval lands on the right
 * table instead of, say, the Vietnam–Japan one.
 */
export function buildRetrievalQuery(
  question: string,
  context: PolicyQuestionContext | undefined,
): string {
  if (!context) return question;
  const parts: string[] = [question];
  const origin = context.trip?.originCity;
  const gateway = context.trip?.gateway;
  if (origin && gateway) {
    parts.push(
      `Itinerary: ${CITY_NAMES[origin] ?? origin} to ${CITY_NAMES[gateway] ?? gateway} (from/to Australia).`,
    );
  } else if (origin) {
    parts.push(`Departing from ${CITY_NAMES[origin] ?? origin} (from/to Australia).`);
  }
  if (context.selectedFare) {
    parts.push(
      `Cabin: ${context.selectedFare.cabinLabel} (${context.selectedFare.brandLabel} fare).`,
    );
  }
  return parts.join(" ");
}

function fallbackAnswer(matches: PolicyMatch[]): PolicyAnswerResult {
  // No chat model configured (or it failed): hand back the retrieved
  // passages verbatim rather than inventing prose. Still grounded, just
  // less conversational.
  return {
    answer: matches.map((m) => m.chunk.text).join("\n\n"),
    grounded: true,
    sources: matches.map((m) => ({
      title: m.chunk.title || m.chunk.docTitle,
      url: m.chunk.sourceUrl,
      breadcrumb: m.chunk.breadcrumb,
    })),
  };
}

const SYSTEM_PROMPT = [
  "You answer questions about Vietnam Airlines policy for a traveller who is",
  "mid-booking, using ONLY the excerpts provided. Each excerpt is labelled [1],",
  "[2], etc. Cite the excerpt number(s) you used inline, like \"(see [1])\".",
  "If the excerpts do not fully answer the question, say what is missing instead",
  "of guessing. Never state a number, weight, fee or rule that is not literally",
  "present in an excerpt. When an excerpt labelled [Veya demo data] is used, say",
  "plainly that the figure is an illustrative prototype value rather than a",
  "published Vietnam Airlines rule; when a scraped excerpt supports the same",
  "fact, cite that excerpt as well. Address the traveller's own trip and fare",
  "when the context block names one, and pick the excerpt matching their route",
  "region rather than another region's table. Keep the answer to 2-4 short",
  "sentences.",
].join(" ");

/**
 * The traveller's own fare rules are not in the scraped corpus — VNA renders
 * fare conditions behind a JS lookup the scrape could not reach. Supplying them
 * as a clearly-labelled excerpt lets the model answer "what does MY ticket
 * allow" honestly, instead of declining or borrowing a number from elsewhere.
 */
function fareContextExcerpt(fare: FareOption): string {
  const lines = fare.rules.map(
    (rule) => `- ${rule.label}: ${rule.value}${rule.illustrative ? " (illustrative)" : " (published VNA rule)"}`,
  );
  return [
    `[Veya demo data] Selected fare: ${fare.brandLabel} (${fare.cabinLabel}), `,
    `A$${fare.pricePerAdultAud} per adult round trip.`,
    "",
    ...lines,
  ].join("\n");
}

async function synthesizeAnswer(
  question: string,
  matches: PolicyMatch[],
  apiKey: string,
  context: PolicyQuestionContext | undefined,
): Promise<string | undefined> {
  const excerpts = matches.map(
    (m, i) =>
      `[${i + 1}] (${[m.chunk.docTitle, ...m.chunk.breadcrumb, m.chunk.title].filter(Boolean).join(" > ")})\n${m.chunk.text}`,
  );
  if (context?.selectedFare) {
    excerpts.push(`[${excerpts.length + 1}] ${fareContextExcerpt(context.selectedFare)}`);
  }

  const contextLines: string[] = [];
  if (context?.routeLabel) contextLines.push(`Route: ${context.routeLabel}`);
  if (context?.trip?.travellers) {
    contextLines.push(`Travellers: ${context.trip.travellers} adult(s)`);
  }
  if (context?.trip?.departDate) {
    contextLines.push(`Departs: ${context.trip.departDate}`);
  }
  if (context?.selectedFare) {
    contextLines.push(
      `Selected fare: ${context.selectedFare.brandLabel} (${context.selectedFare.cabinLabel})`,
    );
  }

  try {
    const res = await fetchWithRetry(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: CHAT_MODEL(),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              contextLines.length > 0
                ? `Traveller context:\n${contextLines.join("\n")}\n`
                : "",
              `Excerpts:\n\n${excerpts.join("\n\n")}`,
              `\nQuestion: ${question}`,
            ].join("\n"),
          },
        ],
        temperature: 0,
        max_tokens: 260,
      }),
    }, 12_000);
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    };
    if (!res.ok) return undefined;
    return body.choices?.[0]?.message?.content?.trim();
  } catch {
    // Falls back to the raw retrieved excerpts — still grounded, just unpolished.
    return undefined;
  }
}

/**
 * Answers a free-text policy question, or returns `undefined` when nothing
 * in the corpus is relevant enough — callers should fall back to the
 * existing keyword `classifyPolicyIntent` overlay (or say "I don't know")
 * rather than treat `undefined` as "answer with anything".
 */
export async function answerPolicyQuestion(
  question: string,
  apiKey: string | undefined,
  context?: PolicyQuestionContext,
): Promise<PolicyAnswerResult | undefined> {
  if (!apiKey || !question.trim()) return undefined;

  const matches = await retrievePolicyChunks(
    buildRetrievalQuery(question, context),
    apiKey,
  );
  if (matches.length === 0) return undefined;

  const synthesized = await synthesizeAnswer(question, matches, apiKey, context);
  if (synthesized) {
    return {
      answer: synthesized,
      grounded: true,
      sources: citedSources(synthesized, matches),
    };
  }
  return fallbackAnswer(matches);
}

/**
 * Top-K retrieval deliberately pulls in several near-identical passages (the
 * per-region baggage tables all look alike) and lets the model choose. Showing
 * all of them as "sources" would imply the answer rests on regions it ignored,
 * so cite back only the excerpts the answer actually referenced.
 */
function citedSources(
  answer: string,
  matches: PolicyMatch[],
): PolicyAnswerResult["sources"] {
  const cited = new Set<number>();
  for (const match of answer.matchAll(/\[(\d{1,2})\]/g)) {
    cited.add(Number(match[1]));
  }
  // An answer that cites nothing is either a decline or ungrounded prose; in
  // both cases listing pages under it would overstate what it rests on.
  if (cited.size === 0) return [];
  // Numbers outside the match list point at the appended fare-context excerpt,
  // which is demo data and has no external URL to cite.
  const used = matches.filter((_, index) => cited.has(index + 1));
  const seen = new Set<string>();
  return used
    .filter((m) => {
      const key = `${m.chunk.sourceUrl}#${m.chunk.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((m) => ({
      title: m.chunk.title || m.chunk.docTitle,
      url: m.chunk.sourceUrl,
      breadcrumb: m.chunk.breadcrumb,
    }));
}
