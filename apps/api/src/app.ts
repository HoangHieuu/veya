import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import express, { type Express } from "express";

const DATA_ASSETS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../data/assets",
);

import { loadDataset, type DatasetInput, type DatasetProvider, createDatasetProvider } from "./dataset/loader.js";
import { apiErrorHandler } from "./errors.js";
import {
  parseTripIntent,
  type ParseTripIntentOptions,
} from "./intent/parseTripIntent.js";
import { registerRecommendRoutes } from "./routes/recommend.js";
import { InMemoryTripStore } from "./trips.js";
import { type IntentParseResult, type RecommendRequest } from "../../../shared/types.js";
import { ScoringAuditStore } from "./scoring/audit.js";

export interface AppDependencies {
  parseTripIntent: (
    input: RecommendRequest,
    options?: ParseTripIntentOptions,
  ) => Promise<IntentParseResult>;
  dataset: DatasetProvider;
  clock: () => Date;
  idGenerator: () => string;
  tripStore: InMemoryTripStore;
  auditStore: ScoringAuditStore;
  enableDevScoring: boolean;
}

export type AppDependencyOverrides = Partial<Omit<AppDependencies, "dataset">> & {
  dataset?: DatasetProvider | DatasetInput;
};

export function createApp(
  overrides: AppDependencyOverrides = {},
): Express {
  const {
    dataset: datasetOverride,
    clock: clockOverride,
    parseTripIntent: parseTripIntentOverride,
    ...dependencyOverrides
  } = overrides;
  const clock = clockOverride ?? (() => new Date());
  const parser =
    parseTripIntentOverride ??
    ((input: RecommendRequest, options?: ParseTripIntentOptions) =>
      parseTripIntent(input, { now: options?.now ?? clock() }));
  const datasetProvider = datasetOverride
    ? isDatasetProvider(datasetOverride)
      ? datasetOverride
      : createDatasetProvider(datasetOverride)
    : createDatasetProvider(loadDataset());
  const dependencies: AppDependencies = {
    parseTripIntent: parser,
    dataset: datasetProvider,
    clock,
    idGenerator: randomUUID,
    tripStore: new InMemoryTripStore(),
    auditStore: new ScoringAuditStore(20),
    enableDevScoring:
      process.env.NODE_ENV !== "production" || process.env.ENABLE_DEV_SCORING === "true",
    ...dependencyOverrides,
  };

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "64kb" }));
  app.use("/assets", express.static(DATA_ASSETS_DIR));

  app.get("/health", (_request, response) => {
    const snapshot = dependencies.dataset.getSnapshot();
    response.status(200).json({
      ok: true,
      service: "veya-api",
      status: snapshot.status,
      routeCount: snapshot.routes.length,
      datasetVersion: snapshot.version,
      errors: snapshot.errors,
    });
  });

  registerRecommendRoutes(app, dependencies);

  app.use((_request, response) => {
    response.status(404).json({
      errorCode: "NOT_FOUND",
      message: "The requested endpoint does not exist.",
    });
  });
  app.use(apiErrorHandler);

  return app;
}

function isDatasetProvider(
  value: DatasetProvider | DatasetInput,
): value is DatasetProvider {
  return typeof (value as DatasetProvider).getSnapshot === "function";
}
