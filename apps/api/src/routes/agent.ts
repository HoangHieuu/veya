import type { Express } from "express";

import { handleAgentTurn } from "../agent/orchestrator.js";
import { answerPolicyQuestion } from "../agent/policyRag.js";
import type { AppDependencies } from "../app.js";
import { httpError } from "../errors.js";
import {
  agentTurnRequestSchema,
  formatValidationIssues,
  policyAskRequestSchema,
} from "../validation.js";

export function registerAgentRoutes(
  app: Express,
  dependencies: AppDependencies,
): void {
  app.post("/api/agent/turn", async (request, response) => {
    const parsed = agentTurnRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw httpError(
        400,
        "INVALID_AGENT_INPUT",
        `Invalid agent turn request: ${formatValidationIssues(parsed.error)}`,
      );
    }
    const result = await handleAgentTurn(parsed.data, dependencies);
    response.status(200).json(result);
  });

  // Offline policy corpus + optional OpenAI embed/synthesize.
  // Enabled by default; set POLICY_RAG_ENABLED=false to disable.
  app.post("/api/policy/ask", async (request, response) => {
    const parsed = policyAskRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw httpError(
        400,
        "INVALID_POLICY_QUESTION",
        `Invalid policy question: ${formatValidationIssues(parsed.error)}`,
      );
    }

    if (process.env.POLICY_RAG_ENABLED === "false") {
      response.status(503).json({
        answered: false,
        errorCode: "POLICY_RAG_DISABLED",
        message:
          "Policy semantic search is disabled (POLICY_RAG_ENABLED=false).",
      });
      return;
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const outcome = await answerPolicyQuestion(parsed.data.question, apiKey);

    if (outcome.status === "answered") {
      response.status(200).json({ answered: true, ...outcome.answer });
      return;
    }

    if (
      outcome.status === "openai_unavailable" ||
      outcome.status === "corpus_unavailable"
    ) {
      response.status(503).json({
        answered: false,
        errorCode:
          outcome.status === "openai_unavailable"
            ? "OPENAI_UNAVAILABLE"
            : "CORPUS_UNAVAILABLE",
        message: outcome.message,
      });
      return;
    }

    if (outcome.status === "empty_question") {
      throw httpError(400, "INVALID_POLICY_QUESTION", outcome.message);
    }

    // no_match
    response.status(200).json({
      answered: false,
      errorCode: "POLICY_NO_MATCH",
      message: outcome.message,
    });
  });
}
