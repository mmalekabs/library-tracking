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

  const json = await response.json();

  if (!response.ok || json.success === false) {
    const err = json as ApiErrorBody;
    throw new ApiError(
      err.error?.code ?? "UNKNOWN_ERROR",
      err.error?.message ?? "Request failed",
      response.status,
      err.error?.details,
    );
  }

  return json.data as T;
}

export async function checkHealth(): Promise<{ status: string; timestamp: string }> {
  return apiFetch("/health");
}
