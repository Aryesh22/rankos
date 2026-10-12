/**
 * Typed HTTP client for the RankOS REST API.
 *
 * - Base URL comes from `VITE_API_URL` (absolute, e.g. https://api.rankos.app/api)
 *   and falls back to the same-origin `/api` prefix used in production behind a
 *   reverse proxy. See `.env.example`.
 * - Session is carried by an httpOnly cookie, so every request opts into
 *   `credentials: "include"`.
 * - Errors are normalised to {@link ApiError} from the standard envelope
 *   `{ error: { code, message, fields? } }` (see API_SPEC.md → "Conventions").
 */
import type { ApiErrorBody } from "@/types";

const API_BASE = (import.meta.env.VITE_API_URL ?? "/api").replace(/\/+$/, "");

/** A structured error thrown by every non-2xx API response. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Per-field validation messages, keyed by form field name. */
  readonly fields?: Record<string, string>;

  constructor(message: string, status: number, code = "ERROR", fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

/** True when the error is an {@link ApiError} with the given HTTP status. */
export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

type Json = Record<string, unknown> | unknown[];

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** JSON body — serialised automatically. */
  body?: Json;
  signal?: AbortSignal;
  /** Extra headers merged over the defaults. */
  headers?: Record<string, string>;
}

function safeParse(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/**
 * Perform a JSON request against the API and return the parsed body typed as `T`.
 * Throws {@link ApiError} on any non-2xx response.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, headers } = options;

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      credentials: "include",
      signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (cause) {
    // Network failure / CORS / offline — surface a uniform error.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(
      "Can't reach the server. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }

  if (response.status === 204) return undefined as T;

  const payload = safeParse(await response.text());

  if (!response.ok) {
    const envelope = (payload as ApiErrorBody | null)?.error;
    throw new ApiError(
      envelope?.message ?? response.statusText ?? "Request failed",
      response.status,
      envelope?.code ?? "ERROR",
      envelope?.fields,
    );
  }

  return payload as T;
}
