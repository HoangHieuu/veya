import type { Express } from "express";
import type { ApiError } from "../../../../shared/types.js";

/** Person D: wire parseTripIntent → loadDataset → rank → RankedResponse */
export function registerRecommendRoutes(app: Express) {
  app.post("/api/recommend", (_req, res) => {
    const body: ApiError = {
      errorCode: "NOT_IMPLEMENTED",
      message:
        "API stub — Person D: implement orchestration per docs/WORK_SPLIT.md §3.1",
    };
    res.status(501).json(body);
  });

  app.post("/api/trips/save", (_req, res) => {
    const body: ApiError = {
      errorCode: "NOT_IMPLEMENTED",
      message: "API stub — Person D: implement save per docs/WORK_SPLIT.md §3.5",
    };
    res.status(501).json(body);
  });
}
