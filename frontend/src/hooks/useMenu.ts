// src/hooks/useMenu.ts
// Phase 3 — menu data via TanStack Query + Axios

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, RESTAURANT_ID } from "@/lib/axios";
import { queryKeys } from "@/lib/queryClient";
import { Category, MenuItem, ApiResponse, PaginatedResponse } from "@/types";
import { toast } from "sonner";

// ── Categories ────────────────────────────────────────────────────────
// Backend: GET /api/v1/menu/categories
// Requires: X-Restaurant-ID header (sent by axios interceptor)
export function useCategories() {
  return useQuery({
    queryKey: queryKeys.menu.categories(RESTAURANT_ID),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Category[]>>(
        `/api/v1/menu/categories`
      );
      return data.data;
    },
    staleTime: 60_000,
  });
}

// ── Menu Items ────────────────────────────────────────────────────────
// Backend: GET /api/v1/menu/items?category_id=...&limit=100
// Requires: X-Restaurant-ID header (sent by axios interceptor)
export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.menu.items(RESTAURANT_ID, categoryId),
    queryFn: async () => {
      // Build query params properly — always start with ?
      const params = new URLSearchParams();
      if (categoryId) params.set("category_id", categoryId);
      params.set("limit", "100");
      const { data } = await api.get<ApiResponse<PaginatedResponse<MenuItem>>>(
        `/api/v1/menu/items?${params.toString()}`
      );
      return data.data.items;
    },
    staleTime: 30_000,
  });
}

// ── Toggle item availability (admin) ─────────────────────────────────
// Backend: PATCH /api/v1/menu/items/{item_id}
// Requires: X-Restaurant-ID header
export function useToggleItemAvailability() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      itemId,
      isAvailable,
    }: {
      itemId: string;
      isAvailable: boolean;
    }) => {
      const { data } = await api.patch<ApiResponse<MenuItem>>(
        `/api/v1/menu/items/${itemId}`,
        { is_available: isAvailable }
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.items(RESTAURANT_ID) });
      toast.success("Item availability updated.");
    },
    onError: () => {
      toast.error("Failed to update item. Please try again.");
    },
  });
}

// ── Menu by Slug (matches backend GET /api/v1/menu/{slug}) ───────────
// This is the customer-facing anonymous endpoint — no auth, no X-Restaurant-ID needed
interface MenuBySlugCategory {
  id: string;
  name: string;
}

interface MenuBySlugItem {
  id: string;
  name: string;
  description: string | null;
  price_offline: number;
  qr_discount_percent: number;
  is_available: boolean;
  image_url: string | null;
  category_id: string;
}

interface MenuBySlugResponse {
  categories: MenuBySlugCategory[];
  items: MenuBySlugItem[];
}

export function useMenuBySlug(slug: string) {
  return useQuery({
    queryKey: ["menu", "slug", slug],
    queryFn: async () => {
      const { data } = await api.get<MenuBySlugResponse>(
        `/api/v1/menu/${slug}`
      );
      return data;
    },
    enabled: !!slug,
    staleTime: 60_000,
  });
}
