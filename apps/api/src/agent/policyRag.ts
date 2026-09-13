import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DATA_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data",
);

const EMBEDDING_MODEL = "text-embedding-3-small";
const CHAT_MODEL = () => process.env.OPENAI_MODEL?.trim() || "gpt-4.1-nano";
const EMBEDDINGS_URL = "https://api.openai.com/v1/embeddings";
const CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** Below this cosine similarity, the corpus is treated as having no answer. */
const RELEVANCE_THRESHOLD = 0.32;
const TOP_K = 4;

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

export function loadPolicyCorpus(): PolicyCorpusFile {
  corpusCache ??= JSON.parse(
    readFileSync(path.join(DATA_ROOT, "policy-corpus/vectors.json"), "utf8"),
  ) as PolicyCorpusFile;
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

async function embedText(text: string, apiKey: string): Promise<number[]> {
  const res = await fetch(EMBEDDINGS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input: text.slice(0, 8000) }),
  });
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
}

/**
 * Semantic search over the scraped VNA policy corpus (baggage allowances,
 * fare conditions, refund/rebook rules, legal terms — see
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
  const scored = corpus.chunks.map((chunk) => ({
    chunk,
    score: cosineSimilarity(queryEmbedding, chunk.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((m) => m.score >= RELEVANCE_THRESHOLD).slice(0, topK);
}

export interface PolicyAnswer {
  answer: string;
  grounded: boolean;
  sources: { title: string; url: string; breadcrumb: string[] }[];
}

function fallbackAnswer(matches: PolicyMatch[]): PolicyAnswer {
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
  "You answer questions about Vietnam Airlines policy using ONLY the excerpts",
  "provided below. Each excerpt is labelled [1], [2], etc. Cite the excerpt",
  "number(s) you used inline, like \"(see [1])\". If the excerpts do not fully",
  "answer the question, say what is missing instead of guessing. Never state a",
  "number, weight, fee or rule that is not literally present in an excerpt.",
  "Keep the answer to 2-4 short sentences.",
].join(" ");

async function synthesizeAnswer(
  question: string,
  matches: PolicyMatch[],
  apiKey: string,
): Promise<string | undefined> {
  const context = matches
    .map((m, i) => `[${i + 1}] (${[m.chunk.docTitle, ...m.chunk.breadcrumb, m.chunk.title].filter(Boolean).join(" > ")})\n${m.chunk.text}`)
    .join("\n\n");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6_000);
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      signal: controller.signal,
      body: JSON.stringify({
        model: CHAT_MODEL(),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Excerpts:\n\n${context}\n\nQuestion: ${question}` },
        ],
        temperature: 0,
        max_tokens: 220,
      }),
    });
    const body = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      error?: { message: string };
    };
    if (!res.ok) return undefined;
    return body.choices?.[0]?.message?.content?.trim();
  } catch {
    return undefined;
  } finally {
    clearTimeout(timeout);
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
): Promise<PolicyAnswer | undefined> {
  if (!apiKey || !question.trim()) return undefined;

  const matches = await retrievePolicyChunks(question, apiKey);
  if (matches.length === 0) return undefined;

  const synthesized = await synthesizeAnswer(question, matches, apiKey);
  if (synthesized) {
    return {
      answer: synthesized,
      grounded: true,
      sources: matches.map((m) => ({
        title: m.chunk.title || m.chunk.docTitle,
        url: m.chunk.sourceUrl,
        breadcrumb: m.chunk.breadcrumb,
      })),
    };
  }
  return fallbackAnswer(matches);
}
