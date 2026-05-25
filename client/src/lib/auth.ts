import { apiFetch } from "./api";
import { AUTH_TOKEN_KEY } from "./constants";

export { AUTH_TOKEN_KEY };

export interface AdminUser {
  id: string;
  username: string;
  createdAt?: string;
}

export interface LoginResult {
  token: string;
  admin: AdminUser;
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResult> {
  return apiFetch<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
}

export async function getMe(): Promise<AdminUser> {
  return apiFetch<AdminUser>("/auth/me");
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>("/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}
