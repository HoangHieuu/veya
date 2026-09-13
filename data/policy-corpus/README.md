# data/policy-corpus

Real embeddings for semantic search over Vietnam Airlines policy pages, consumed by
`apps/api/src/agent/policyRag.ts`'s `POST /api/policy/ask` endpoint.

## Scope note

The project's own docs (`docs/TDD-v2.md` and `docs/TDD-v2-3panel.md`) describe a "RAG-lite"
convention — grounded template copy from structured fields, explicitly **not** a vector DB or
live LLM synthesis. This directory is a deliberate, explicit exception to that convention,
requested directly by the project owner: real embeddings, a real vector store (flat JSON, cosine
similarity — no external DB needed at this scale), and live grounded LLM synthesis with citations.
The existing keyword-only `classifyPolicyIntent` overlay (three demo policy IDs) is untouched and
still used for its original purpose; this is an additional, separate capability.

## Source

Scraped from `https://www.vietnamairlines.com/vn/en/legal/terms-and-conditions` and 19 pages it
links to (legal terms, baggage allowance for carry-on/checked, restricted/prohibited items, fare
conditions, refund and rebook rules — full list in `sources.json`). Captured 2026-09-13. Raw HTML
and intermediate Markdown were kept in the session scratchpad only, per `docs/TDD.md` §V.4
("reference captures only — do not commit scrape files to repo") — only the final distilled,
embedded chunks are committed here.

## Chunking

Each page is split by its heading hierarchy (`chunk-tree`: H1/H2/H3 → `breadcrumb` array), so a
chunk carries its section path (e.g. `Baggage > Checked baggage > To/from the US, Australia,
Europe`) rather than being a bare paragraph. Two fixups were needed for VNA's actual markup:

- Long legal pages written as numbered prose instead of real headings (privacy policy, online
  booking conditions, cookies policy) are split on `Article \d+` markers, or on sentence
  boundaries (~1200 chars) when no article markers are present.
- Trailing "Related Information(s)" navigation and satisfaction-survey widget noise is trimmed
  from every page before chunking.

Result: 154 chunks across 20 source pages.

## Embeddings

Each chunk is embedded via OpenAI `text-embedding-3-small` (1536 dims), with the embedding input
prefixed by the chunk's doc title + breadcrumb + title so the vector carries section context, not
just the leaf sentence. `vectors.json` stores `{version, model, dims, capturedAt, source, chunks:
[{id, docId, docTitle, breadcrumb, title, text, sourceUrl, capturedAt, embedding}]}`.

## Retrieval and answering (`apps/api/src/agent/policyRag.ts`)

1. Embed the incoming question with the same model.
2. Cosine-similarity rank against all 154 chunk embeddings; keep the top 4 above a relevance
   threshold (0.32) — below that, the corpus is treated as having no answer (`undefined`), and
   the caller must not guess.
3. Synthesize a 2-4 sentence answer with an LLM (`OPENAI_MODEL`, default `gpt-4.1-nano`),
   strictly grounded on the retrieved excerpts, citing excerpt numbers, forbidden from stating any
   number/fee/rule not literally present in an excerpt. Falls back to the raw excerpt text if
   synthesis fails (still grounded, just unpolished).

Verified end-to-end against the live OpenAI API: correctly answered checked-baggage-weight,
prohibited-carry-on-items and refund-eligibility questions with citations, and correctly declined
to answer an Economy Lite vs. Classic fare comparison that genuinely isn't covered by the scraped
pages — rather than hallucinating a difference.

## Regenerating

The scratchpad pipeline (`html-to-md.mjs` → `chunk-tree.mjs` → `embed.mjs`) is not part of this
repo (it depends on the raw HTML captures, which are not committed per policy). Re-scraping is a
manual, occasional operation, not part of the regular data-validation loop — unlike
`expectedTop3.json`, this corpus has no automated "is it stale" check beyond the validator's
sanity checks (chunk count, embedding dimensions, source URL format, per-topic coverage).
