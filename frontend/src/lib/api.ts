import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from "axios";
import type { ApiResponse, AuthUser } from "@/types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5050/api";

/**
 * Access tokens live only in memory (never localStorage) to limit XSS exposure.
 * The long-lived refresh token is an httpOnly cookie managed by the API.
 */
let accessToken: string | null = null;
export const setAccessToken = (t: string | null) => {
  accessToken = t;
};
export const getAccessToken = () => accessToken;

export const SESSION_EXPIRED_EVENT = "facultyhub:session-expired";

export const api = axios.create({ baseURL: API_URL, withCredentials: true, timeout: 30_000 });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

interface RefreshResult {
  accessToken: string;
  user: AuthUser;
}

let refreshPromise: Promise<RefreshResult> | null = null;

/** Single-flight refresh: concurrent 401s share one refresh request. */
export function refreshSession(): Promise<RefreshResult> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post<ApiResponse<RefreshResult | null>>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
      .then((r) => {
        if (!r.data.data) throw new Error("NO_SESSION");
        setAccessToken(r.data.data.accessToken);
        return r.data.data;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<{ details?: { code?: string } }>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    const code = error.response?.data?.details?.code;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/") && (code === "TOKEN_EXPIRED" || code === "TOKEN_INVALID" || !accessToken)) {
      original._retry = true;
      try {
        await refreshSession();
        return api(original);
      } catch {
        setAccessToken(null);
        if (typeof window !== "undefined") window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
      }
    }
    return Promise.reject(error);
  },
);

/** Extracts a human-readable message from an API error. */
export function apiError(err: unknown, fallback = "Something went wrong. Please try again."): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined;
    if (data?.message) return data.message;
    if (err.code === "ERR_NETWORK") return "Cannot reach the server. Check that the API is running.";
    return err.message || fallback;
  }
  return err instanceof Error ? err.message : fallback;
}

export async function get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const res = await api.get<ApiResponse<T>>(url, { params: clean(params) });
  return res.data.data;
}

export async function getPage<T>(url: string, params?: Record<string, unknown>) {
  const res = await api.get<ApiResponse<T[]>>(url, { params: clean(params) });
  return { items: res.data.data, meta: res.data.meta! };
}

export async function post<T>(url: string, body?: unknown, config?: AxiosRequestConfig) {
  const res = await api.post<ApiResponse<T>>(url, body, config);
  return res.data;
}
export async function put<T>(url: string, body?: unknown) {
  const res = await api.put<ApiResponse<T>>(url, body);
  return res.data;
}
export async function patch<T>(url: string, body?: unknown) {
  const res = await api.patch<ApiResponse<T>>(url, body);
  return res.data;
}
export async function del<T>(url: string, params?: Record<string, unknown>) {
  const res = await api.delete<ApiResponse<T>>(url, { params });
  return res.data;
}

/** Downloads a binary response (PDF/Excel/CSV) and triggers a browser save. */
export async function download(url: string, params: Record<string, unknown>, fallbackName: string) {
  const res = await api.get(url, { params: clean(params), responseType: "blob" });
  const disposition = String(res.headers["content-disposition"] ?? "");
  const match = /filename="?([^"]+)"?/.exec(disposition);
  const name = match?.[1] ?? fallbackName;
  const href = URL.createObjectURL(res.data as Blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

function clean(params?: Record<string, unknown>) {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== "all"));
}
