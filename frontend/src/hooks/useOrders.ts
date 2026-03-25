// src/hooks/useOrders.ts
// Phase 3 — order fetching + mutations via TanStack Query

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { queryKeys } from "@/lib/queryClient";
import {
  Order,
  KitchenStatus,
  ApiResponse,
  PaginatedResponse,
  RazorpayOrderResponse,
} from "@/types";
import { toast } from "sonner";

const RID =
  typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("rid") ??
      localStorage.getItem("dc_restaurant_id") ??
      process.env.NEXT_PUBLIC_RESTAURANT_ID ??
      "")
    : (process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "");

// ── Live order queue (KDS / POS) ─────────────────────────────────────
export function useLiveOrders() {
  return useQuery({
    queryKey: queryKeys.orders.live(RID),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<PaginatedResponse<Order>>>(
        "/api/v1/staff/orders?limit=50&cursor="
      );
      return data.data.items;
    },
    refetchInterval: 15_000, // fallback polling when WS is down
  });
}

// ── Single order ──────────────────────────────────────────────────────
export function useOrder(orderId: string) {
  return useQuery({
    queryKey: queryKeys.orders.detail(orderId),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<Order>>(
        `/api/v1/orders/${orderId}`
      );
      return data.data;
    },
    enabled: !!orderId,
  });
}

// ── Place order (customer) ───────────────────────────────────────────
interface PlaceOrderPayload {
  tableId: string | null;
  orderType: string;
  items: { menuItemId: string; quantity: number; specialNote: string }[];
  specialInstructions: string;
  paymentMethod: "online" | "cash";
  customerName?: string;
  customerPhone?: string;
  marketingOptIn?: boolean;
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PlaceOrderPayload) => {
      const { data } = await api.post<ApiResponse<Order>>(
        "/api/v1/orders",
        payload
      );
      return data.data;
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.live(RID) });
      toast.success(`Order #${order.orderNumber} placed!`);
    },
    onError: () => {
      toast.error("Failed to place order. Please try again.");
    },
  });
}

// ── Razorpay order creation ────────────────────────────────────────────
export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: async (internalOrderId: string) => {
      const { data } = await api.post<ApiResponse<RazorpayOrderResponse>>(
        "/api/v1/payments/razorpay/order",
        { order_id: internalOrderId }
      );
      return data.data;
    },
  });
}

// ── Update kitchen status (staff) ─────────────────────────────────────
export function useUpdateKitchenStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      status,
    }: {
      orderId: string;
      status: KitchenStatus;
    }) => {
      const { data } = await api.patch<ApiResponse<Order>>(
        `/api/v1/staff/orders/${orderId}/status`,
        { kitchen_status: status }
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.live(RID) });
      qc.invalidateQueries({ queryKey: queryKeys.kds.queue(RID) });
    },
    onError: () => toast.error("Status update failed."),
  });
}

// ── Mark payment received (cashier) ──────────────────────────────────
export function useMarkPaymentReceived() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      orderId,
      method,
    }: {
      orderId: string;
      method: "cash" | "card" | "upi";
    }) => {
      const { data } = await api.post<ApiResponse<Order>>(
        `/api/v1/staff/orders/${orderId}/payment`,
        { method }
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.live(RID) });
      qc.invalidateQueries({ queryKey: queryKeys.tables.all(RID) });
      toast.success("Payment marked as received.");
    },
    onError: () => toast.error("Failed to update payment."),
  });
}
