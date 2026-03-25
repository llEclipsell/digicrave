// src/lib/axios.ts
// Phase 3 — Global Axios instance
// Every request sends X-Restaurant-ID so FastAPI resolves the tenant.

import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Helpers ──────────────────────────────────────────────────────────
function getRestaurantId(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";
  }
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("rid") ??
    localStorage.getItem("dc_restaurant_id") ??
    process.env.NEXT_PUBLIC_RESTAURANT_ID ??
    ""
  );
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dc_access_token");
}

function setToken(t: string) {
  localStorage.setItem("dc_access_token", t);
}

function clearToken() {
  localStorage.removeItem("dc_access_token");
}

// ── Create instance ───────────────────────────────────────────────────
export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor ───────────────────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const rid = getRestaurantId();
    if (rid) config.headers["X-Restaurant-ID"] = rid;

    const token = getToken();
    if (token) config.headers["Authorization"] = `Bearer ${token}`;

    // Idempotency key for mutating requests (Blueprint: all POST with money)
    if (config.method === "post" && !config.headers["X-Idempotency-Key"]) {
      config.headers["X-Idempotency-Key"] = crypto.randomUUID();
    }

    return config;
  },
  (err) => Promise.reject(err)
);

// ── Response interceptor — 401 token refresh ─────────────────────────
let isRefreshing = false;
type QueueEntry = { resolve: (t: string) => void; reject: (e: unknown) => void };
let failedQueue: QueueEntry[] = [];

function processQueue(err: unknown, token: string | null = null) {
  failedQueue.forEach((p) => (err ? p.reject(err) : p.resolve(token!)));
  failedQueue = [];
}

api.interceptors.response.use(
  (res: AxiosResponse) => res,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({
            resolve: (t) => {
              original.headers["Authorization"] = `Bearer ${t}`;
              resolve(api(original));
            },
            reject,
          });
        });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem("dc_refresh_token");
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
          refresh_token: refreshToken,
        });
        setToken(data.access_token);
        processQueue(null, data.access_token);
        original.headers["Authorization"] = `Bearer ${data.access_token}`;
        return api(original);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearToken();
        if (typeof window !== "undefined") window.location.href = "/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
