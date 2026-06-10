const API_BASE =
  import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "/api";

export interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

import { AUTH_TOKEN_KEY } from "./constants";

function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers);

  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let json: { success?: boolean; data?: T; error?: ApiErrorBody["error"] };
  try {
    json = await response.json();
  } catch {
    throw new ApiError(
      "INVALID_RESPONSE",
      response.status === 429
        ? "Too many requests. Please wait a moment and try again."
        : "Request failed",
      response.status,
    );
  }

  if (!response.ok || json.success === false) {
    throw new ApiError(
      json.error?.code ?? "UNKNOWN_ERROR",
      json.error?.message ??
        (response.status === 429
          ? "Too many requests. Please wait a moment and try again."
          : "Request failed"),
      response.status,
      json.error?.details,
    );
  }

  return json.data as T;
}

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  return apiFetch("/health");
}
