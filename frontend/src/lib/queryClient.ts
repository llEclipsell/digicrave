// src/lib/queryClient.ts
// Phase 3 — TanStack Query configuration

import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,        // 30s — menu data is fairly stable
      gcTime: 5 * 60_000,       // 5 min cache
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

// Query key factories — centralised so refetches are type-safe
export const queryKeys = {
  menu: {
    all: (restaurantId: string) => ["menu", restaurantId] as const,
    categories: (restaurantId: string) => ["menu", restaurantId, "categories"] as const,
    items: (restaurantId: string, categoryId?: string) =>
      categoryId
        ? ["menu", restaurantId, "items", categoryId]
        : ["menu", restaurantId, "items"],
  },
  orders: {
    all: (restaurantId: string) => ["orders", restaurantId] as const,
    detail: (orderId: string) => ["orders", orderId] as const,
    live: (restaurantId: string) => ["orders", restaurantId, "live"] as const,
  },
  kds: {
    queue: (restaurantId: string) => ["kds", restaurantId, "queue"] as const,
  },
  tables: {
    all: (restaurantId: string) => ["tables", restaurantId] as const,
  },
  admin: {
    stats: (restaurantId: string) => ["admin", restaurantId, "stats"] as const,
    wallet: (restaurantId: string) => ["admin", restaurantId, "wallet"] as const,
    campaigns: (restaurantId: string) => ["admin", restaurantId, "campaigns"] as const,
  },
} as const;
