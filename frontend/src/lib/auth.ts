import { REFRESH_KEY, TOKEN_KEY } from "./config";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(accessToken: string, refreshToken?: string): void {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}
