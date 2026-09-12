import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { OriginCity, RouteRecord } from "../../../../shared/types.js";
import { formatValidationIssues, routeRecordSchema } from "../validation.js";

const DATASET_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../data",
);

export const REQUIRED_ORIGINS: OriginCity[] = ["SYD", "MEL", "PER"];
export const REQUIRED_DESTINATIONS = ["HAN", "SGN", "DAD"] as const;

export type DatasetLogger = (message: string, error?: unknown) => void;

export interface DatasetSnapshot {
  version: string;
  routes: RouteRecord[];
  errors: string[];
  status: "ready" | "degraded";
  isComplete: boolean;
  missingCombinations: string[];
}

export type DatasetInput = Pick<DatasetSnapshot, "version" | "routes"> &
  Partial<Pick<DatasetSnapshot, "errors" | "status" | "isComplete" | "missingCombinations">>;

export interface DatasetProvider {
  getSnapshot(): DatasetSnapshot;
}

export function loadDataset(
  dataRoot = DATASET_ROOT,
  logger: DatasetLogger = defaultDatasetLogger,
): DatasetSnapshot {
  const errors: string[] = [];
  let version = "unavailable";

  const versionPath = path.join(dataRoot, "version.json");
  try {
    const parsedVersion: unknown = JSON.parse(readFileSync(versionPath, "utf8"));
    if (
      !parsedVersion ||
      typeof parsedVersion !== "object" ||
      typeof (parsedVersion as { datasetVersion?: unknown }).datasetVersion !== "string" ||
      !(parsedVersion as { datasetVersion: string }).datasetVersion.trim()
    ) {
      addDatasetError(
        errors,
        "VERSION_INVALID",
        logger,
        "Dataset version metadata is invalid.",
        versionPath,
      );
    } else {
      version = (parsedVersion as { datasetVersion: string }).datasetVersion.trim();
    }
  } catch (error) {
    const code = isFileMissing(error) ? "VERSION_NOT_FOUND" : "VERSION_READ_ERROR";
    addDatasetError(
      errors,
      code,
      logger,
      "Dataset version metadata could not be read.",
      versionPath,
      error,
    );
  }

  const routes: RouteRecord[] = [];
  const routeIds = new Set<string>();
  let routeFiles: string[] = [];
  const routesRoot = path.join(dataRoot, "routes");

  try {
    routeFiles = readdirSync(routesRoot)
      .filter((file) => file.endsWith(".json"))
      .sort();
  } catch (error) {
    const code = isFileMissing(error) ? "ROUTES_NOT_FOUND" : "ROUTES_READ_ERROR";
    addDatasetError(
      errors,
      code,
      logger,
      "Dataset route directory could not be read.",
      routesRoot,
      error,
    );
  }

  for (const file of routeFiles) {
    const filePath = path.join(routesRoot, file);

    try {
      const raw: unknown = JSON.parse(readFileSync(filePath, "utf8"));
      const parsed = routeRecordSchema.safeParse(raw);
      if (!parsed.success) {
        addDatasetError(
          errors,
          "ROUTE_INVALID",
          logger,
          `Route record ${file} failed schema validation: ${formatValidationIssues(parsed.error)}`,
          filePath,
        );
        continue;
      }

      const route = parsed.data as RouteRecord;
      if (routeIds.has(route.id)) {
        addDatasetError(
          errors,
          "ROUTE_DUPLICATE_ID",
          logger,
          `Duplicate route ID ${route.id} was found in ${file}.`,
          filePath,
        );
        continue;
      }

      routeIds.add(route.id);
      routes.push(route);
    } catch (error) {
      const code = isJsonParseError(error)
        ? "ROUTE_INVALID_JSON"
        : "ROUTE_READ_ERROR";
      addDatasetError(
        errors,
        code,
        logger,
        `Route record ${file} could not be read or parsed.`,
        filePath,
        error,
      );
    }
  }

  const missingCombinations = getMissingCombinations(routes);
  if (missingCombinations.length > 0) {
    addDatasetError(
      errors,
      "ROUTE_COVERAGE_INCOMPLETE",
      logger,
      `Curated route coverage is incomplete: ${missingCombinations.join(", ")}.`,
      routesRoot,
    );
  }

  const isComplete = missingCombinations.length === 0;
  return {
    version,
    routes,
    errors,
    status: isComplete && version !== "unavailable" && errors.length === 0 ? "ready" : "degraded",
    isComplete,
    missingCombinations,
  };
}

export function getMissingCombinations(routes: RouteRecord[]): string[] {
  const combinations = new Set(
    routes.map((route) => `${route.originCity}-${route.destinationCity}`),
  );
  return REQUIRED_ORIGINS.flatMap((origin) =>
    REQUIRED_DESTINATIONS
      .filter((destination) => !combinations.has(`${origin}-${destination}`))
      .map((destination) => `${origin}-${destination}`),
  );
}

export function createDatasetProvider(snapshot: DatasetInput): DatasetProvider {
  const missingCombinations = snapshot.missingCombinations
    ? [...snapshot.missingCombinations]
    : getMissingCombinations(snapshot.routes);
  const errors = sanitizeDiagnostics(snapshot.errors ?? []);
  const version = typeof snapshot.version === "string" && snapshot.version.trim()
    ? snapshot.version.trim()
    : "unavailable";
  const isComplete = snapshot.isComplete ?? missingCombinations.length === 0;
  const normalizedSnapshot: DatasetSnapshot = {
    version,
    routes: structuredClone(snapshot.routes),
    errors,
    status:
      snapshot.status ??
      (isComplete && version !== "unavailable" && errors.length === 0 ? "ready" : "degraded"),
    isComplete,
    missingCombinations,
  };
  const frozenSnapshot = structuredClone(normalizedSnapshot);
  return {
    getSnapshot() {
      return structuredClone(frozenSnapshot);
    },
  };
}

let defaultProvider: DatasetProvider | undefined;

function getDefaultProvider(): DatasetProvider {
  defaultProvider ??= createDatasetProvider(loadDataset());
  return defaultProvider;
}

export function getRoutesForOrigin(origin: OriginCity): RouteRecord[] {
  return getDefaultProvider()
    .getSnapshot()
    .routes.filter((route) => route.originCity === origin)
    .map((route) => structuredClone(route));
}

export function getRouteById(id: string): RouteRecord | undefined {
  const route = getDefaultProvider().getSnapshot().routes.find((item) => item.id === id);
  return route ? structuredClone(route) : undefined;
}

export function resetDefaultDatasetProviderForTests() {
  defaultProvider = undefined;
}

function addDatasetError(
  errors: string[],
  code: string,
  logger: DatasetLogger,
  detail: string,
  filePath: string,
  error?: unknown,
) {
  errors.push(code);
  logger(`${detail} [${code}]`, { filePath, error });
}

function sanitizeDiagnostics(errors: string[]): string[] {
  return errors.map((error) => {
    if (error === "ROUTE_COVERAGE_INCOMPLETE") return error;
    if (error === "ROUTE_DUPLICATE_ID") return error;
    if (error === "ROUTE_INVALID" || error === "ROUTE_INVALID_JSON") return error;
    if (error === "ROUTE_READ_ERROR") return error;
    if (error === "VERSION_INVALID" || error === "VERSION_NOT_FOUND" || error === "VERSION_READ_ERROR") return error;
    if (error === "ROUTES_NOT_FOUND" || error === "ROUTES_READ_ERROR") return error;
    return "DATASET_WARNING";
  });
}

function isFileMissing(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

function isJsonParseError(error: unknown): boolean {
  return error instanceof SyntaxError;
}

function defaultDatasetLogger(message: string, error?: unknown) {
  console.error("Veya dataset loader", message, error);
}
