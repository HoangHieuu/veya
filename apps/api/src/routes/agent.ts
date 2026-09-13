import type { Express } from "express";

import { handleAgentTurn } from "../agent/orchestrator.js";
import type { AppDependencies } from "../app.js";
import { httpError } from "../errors.js";
import {
  agentTurnRequestSchema,
  formatValidationIssues,
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
}
