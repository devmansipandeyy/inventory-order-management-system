import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE } from "../lib/config";
import { clearTokens, getToken } from "../lib/auth";

const MAX_RETRIES = 2;
const IDEMPOTENT_METHODS = new Set(["get", "head", "options"]);
const RETRYABLE_STATUS = new Set([502, 503, 504]);

type RetryConfig = InternalAxiosRequestConfig & { _retry?: number };

function isReplayable(error: AxiosError): boolean {
  if (error.code === "ERR_CANCELED") return false;
  const method = (error.config?.method ?? "get").toLowerCase();
  const url = error.config?.url ?? "";
  const safe = IDEMPOTENT_METHODS.has(method) || url.includes("/auth/");
  if (!safe) return false;
  if (!error.response) return true;
  return RETRYABLE_STATUS.has(error.response.status);
}

export const UNAUTHORIZED_EVENT = "inv:unauthorized";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const config = error.config as RetryConfig | undefined;
    if (config && isReplayable(error)) {
      config._retry = (config._retry ?? 0) + 1;
      if (config._retry <= MAX_RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 300 * config._retry!));
        return api(config);
      }
    }
    if (error.response?.status === 401) {
      const onLogin = window.location.pathname.startsWith("/login");
      if (!onLogin) {
        clearTokens();
        window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

export function getErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as
      | { detail?: unknown; message?: string }
      | undefined;
    const detail = data?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      const first = detail[0] as { msg?: string } | undefined;
      if (first?.msg) return first.msg;
    }
    if (detail && typeof detail === "object" && "msg" in detail) {
      return String((detail as { msg: unknown }).msg);
    }
    if (data?.message) return data.message;
    if (error.message) return error.message;
  }
  if (error instanceof Error) return error.message;
  return fallback;
}
