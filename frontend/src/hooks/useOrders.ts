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

export interface CreateOrderResponseData {
  order_id: string;
  razorpay_order_id: string | null;
  payment_method: string;
  final_amount: number;
  message: string;
}

export function usePlaceOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: PlaceOrderPayload) => {
      // Backend expects idempotency_key in body + X-Idempotency-Key header
      const idempotencyKey = crypto.randomUUID();
      const backendPayload = {
        table_id: payload.tableId || null,
        payment_method: payload.paymentMethod,
        idempotency_key: idempotencyKey,
        items: payload.items.map((i) => ({
          menu_item_id: i.menuItemId,
          quantity: i.quantity,
          special_note: i.specialNote,
        })),
        special_instructions: payload.specialInstructions,
        customer_name: payload.customerName,
        customer_phone: payload.customerPhone,
        marketing_opt_in: payload.marketingOptIn,
      };

      const { data } = await api.post<CreateOrderResponseData>(
        "/api/v1/order/create",
        backendPayload,
        {
          headers: {
            "X-Idempotency-Key": idempotencyKey,
          },
        }
      );
      return data;
    },
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.live(RID) });
      toast.success(`Order #${order?.order_id?.split("-")[0]} placed!`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || "Failed to place order. Please try again.");
    },
  });
}

// ── Razorpay order creation ────────────────────────────────────────────
export function useCreateRazorpayOrder() {
  return useMutation({
    mutationFn: async (payload: { orderId?: string; orderIds?: string[] }) => {
      const { data } = await api.post<ApiResponse<RazorpayOrderResponse>>(
        "/api/v1/payments/razorpay/order",
        { 
          order_id: payload.orderId,
          order_ids: payload.orderIds 
        }
      );
      return data.data;
    },
  });
}

// ── Session ────────────────────────────────────────────────────────
export interface SessionBill {
  orderIds: string[];
  items: {
    id: string;
    orderId: string;
    menuItemId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    specialNote: string;
  }[];
  subtotal: number;
  gst: number;
  platformFee: number;
  gatewayFee: number;
  total: number;
}

export function useSessionBill(orderIds: string[]) {
  return useQuery({
    queryKey: queryKeys.orders.detail("session-bill-" + orderIds.join(",")),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<SessionBill>>(
        `/api/v1/session/bill?order_ids=${orderIds.join(",")}`
      );
      return data.data;
    },
    enabled: orderIds.length > 0,
  });
}

export function useSessionOrders(orderIds: string[]) {
  return useQuery({
    queryKey: queryKeys.orders.detail("session-orders-" + orderIds.join(",")),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<any[]>>(
        `/api/v1/session/orders?order_ids=${orderIds.join(",")}`
      );
      return data.data;
    },
    enabled: orderIds.length > 0,
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
        { status }
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
