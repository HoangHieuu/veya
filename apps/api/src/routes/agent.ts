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

  // Semantic search over data/policy-corpus (baggage, fare conditions,
  // refund/rebook, legal terms) — distinct from any keyword-only policy
  // overlay elsewhere in the agent orchestrator.
  app.post("/api/policy/ask", async (request, response) => {
    const parsed = policyAskRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      throw httpError(
        400,
        "INVALID_POLICY_QUESTION",
        `Invalid policy question: ${formatValidationIssues(parsed.error)}`,
      );
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    const result = await answerPolicyQuestion(parsed.data.question, apiKey);
    if (!result) {
      response.status(200).json({
        answered: false,
        message:
          "Nothing in the policy corpus is confidently relevant to that question — please rephrase, or this may not be covered.",
      });
      return;
    }
    response.status(200).json({ answered: true, ...result });
  });
}
