// src/hooks/useAdmin.ts
// Phase 6 — Admin dashboard data

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/axios";
import { queryKeys } from "@/lib/queryClient";
import { RevenueStats, WhatsAppWallet, WhatsAppCampaign, ApiResponse } from "@/types";
import { toast } from "sonner";

const RID =
  typeof window !== "undefined"
    ? (localStorage.getItem("dc_restaurant_id") ??
      process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "")
    : (process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "");

export function useRevenueStats(period: "week" | "month" | "year" = "month") {
  return useQuery({
    queryKey: [...queryKeys.admin.stats(RID), period],
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<RevenueStats>>(
        `/api/v1/admin/analytics/revenue?period=${period}`
      );
      return data.data;
    },
    staleTime: 5 * 60_000,
  });
}

export function useWhatsAppWallet() {
  return useQuery({
    queryKey: queryKeys.admin.wallet(RID),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WhatsAppWallet>>(
        "/api/v1/admin/whatsapp/wallet"
      );
      return data.data;
    },
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: queryKeys.admin.campaigns(RID),
    queryFn: async () => {
      const { data } = await api.get<ApiResponse<WhatsAppCampaign[]>>(
        "/api/v1/admin/whatsapp/campaigns"
      );
      return data.data;
    },
  });
}

// ── Razorpay recharge for WhatsApp wallet ──────────────────────────
export function useRechargeWallet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (amountInr: number) => {
      const { data } = await api.post<
        ApiResponse<{ razorpayOrderId: string; amount: number; keyId: string }>
      >("/api/v1/admin/whatsapp/wallet/recharge", { amount: amountInr });
      return data.data;
    },
    onSuccess: (rzpData) => {
      // Open Razorpay checkout
      if (typeof window !== "undefined" && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: rzpData.keyId,
          amount: rzpData.amount,
          currency: "INR",
          name: "DigiCrave",
          description: "WhatsApp Marketing Wallet Recharge",
          order_id: rzpData.razorpayOrderId,
          handler: async (response: {
            razorpay_payment_id: string;
            razorpay_order_id: string;
            razorpay_signature: string;
          }) => {
            await api.post("/api/v1/admin/whatsapp/wallet/verify", response);
            qc.invalidateQueries({ queryKey: queryKeys.admin.wallet(RID) });
            toast.success("Wallet recharged successfully!");
          },
          theme: { color: "#F97316" },
        });
        rzp.open();
      }
    },
    onError: () => toast.error("Failed to initiate recharge."),
  });
}

export function useSendCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      name: string;
      templateId: string;
      targetSegment: WhatsAppCampaign["targetSegment"];
      scheduledAt?: string;
    }) => {
      const { data } = await api.post<ApiResponse<WhatsAppCampaign>>(
        "/api/v1/admin/whatsapp/campaigns",
        payload
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.admin.campaigns(RID) });
      toast.success("Campaign scheduled!");
    },
    onError: () => toast.error("Campaign failed to schedule."),
  });
}
