import type { ErrorRequestHandler } from "express";

import type { ApiError } from "../../../shared/types.js";

export class HttpApiError extends Error {
  readonly statusCode: number;
  readonly body: ApiError;

  constructor(statusCode: number, body: ApiError) {
    super(body.message);
    this.name = "HttpApiError";
    this.statusCode = statusCode;
    this.body = body;
  }
}

export function httpError(
  statusCode: number,
  errorCode: string,
  message: string,
): HttpApiError {
  return new HttpApiError(statusCode, { errorCode, message });
}

export const apiErrorHandler: ErrorRequestHandler = (
  error,
  _request,
  response,
  _next,
) => {
  if (error instanceof HttpApiError) {
    response.status(error.statusCode).json(error.body);
    return;
  }

  // express.json() reports malformed JSON as a SyntaxError with a body flag.
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({
      errorCode: "INVALID_JSON",
      message: "Request body must be valid JSON.",
    } satisfies ApiError);
    return;
  }

  const status = readErrorStatus(error);
  if (isPayloadTooLarge(error, status)) {
    response.status(413).json({
      errorCode: "PAYLOAD_TOO_LARGE",
      message: "Request body is too large.",
    } satisfies ApiError);
    return;
  }

  if (status !== undefined && status >= 400 && status < 500) {
    response.status(status).json({
      errorCode: status === 400 ? "INVALID_REQUEST" : "REQUEST_REJECTED",
      message: "The request could not be processed.",
    } satisfies ApiError);
    return;
  }

  console.error("Unhandled Veya API error", error);
  response.status(500).json({
    errorCode: "INTERNAL_ERROR",
    message: "An unexpected server error occurred.",
  } satisfies ApiError);
};

function readErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("status" in error && typeof error.status === "number") return error.status;
  if ("statusCode" in error && typeof error.statusCode === "number") return error.statusCode;
  return undefined;
}

function isPayloadTooLarge(error: unknown, status: number | undefined): boolean {
  return Boolean(
    status === 413 ||
      (error && typeof error === "object" && "type" in error && error.type === "entity.too.large"),
  );
}
