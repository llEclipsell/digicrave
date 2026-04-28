// src/lib/axios.ts
// Phase 3 — Global Axios instance
// Every request sends X-Restaurant-ID so FastAPI resolves the tenant.

import axios, {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import { useSessionStore } from "@/store/sessionStore";

// ── Dev-mode restaurant ID (confirmed from DB) ──────────────────────
export const RESTAURANT_ID = "099e3454-e48c-42d9-9098-d554e7d9ccd2";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Helpers ──────────────────────────────────────────────────────────
function getRestaurantId(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_RESTAURANT_ID ?? RESTAURANT_ID;
  }
  const sessionState = useSessionStore.getState();
  if (sessionState.restaurantId) return sessionState.restaurantId;
  
  const params = new URLSearchParams(window.location.search);
  return (
    params.get("rid") ??
    localStorage.getItem("dc_restaurant_id") ??
    process.env.NEXT_PUBLIC_RESTAURANT_ID ??
    RESTAURANT_ID
  );
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  // Use table session token first for customer routes
  const sessionToken = useSessionStore.getState().sessionToken;
  if (sessionToken) return sessionToken;
  // Fallback to staff token
  return localStorage.getItem("dc_access_token");
}

function setToken(t: string) {
  localStorage.setItem("dc_access_token", t);
}

function clearToken() {
  localStorage.removeItem("dc_access_token");
}

// ── Seed the restaurant ID into localStorage & sessionStorage on first load ──────────
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("dc_restaurant_id");
  if (!stored || stored === "test-bistro") {
    localStorage.setItem("dc_restaurant_id", RESTAURANT_ID);
  }
  sessionStorage.setItem("dc_restaurant_id", RESTAURANT_ID);
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
    // Always attach X-Restaurant-ID header (the backend's multi-tenant key)
    const rid = getRestaurantId();
    if (rid) config.headers["X-Restaurant-ID"] = rid;

    // Remove query params logic for restaurant_id
    // It's handled securely via session token now

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
        // Don't redirect — guest flow doesn't require login
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
