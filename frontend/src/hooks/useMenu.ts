// src/hooks/useMenu.ts
// Phase 3 — menu data via TanStack Query + Axios

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { queryKeys } from "@/lib/queryClient";
import { Category, MenuItem, ApiResponse, PaginatedResponse } from "@/types";
import { toast } from "sonner";

const RESTAURANT_ID =
  typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("rid") ??
      localStorage.getItem("dc_restaurant_id") ??
      process.env.NEXT_PUBLIC_RESTAURANT_ID ??
      ""
    : process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "";

// ── Categories ────────────────────────────────────────────────────────
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
export function useMenuItems(categoryId?: string) {
  return useQuery({
    queryKey: queryKeys.menu.items(RESTAURANT_ID, categoryId),
    queryFn: async () => {
      const params = categoryId ? `?category_id=${categoryId}` : "";
      const { data } = await api.get<ApiResponse<PaginatedResponse<MenuItem>>>(
        `/api/v1/menu/items${params}&limit=100`
      );
      return data.data.items;
    },
    staleTime: 30_000,
  });
}

// ── Toggle item availability (admin) ─────────────────────────────────
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
