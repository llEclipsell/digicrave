"use client";
// src/app/order-status/page.tsx
// MenEW Stitch Design — In-House Order Tracking screen

import { useSearchParams, useRouter } from "next/navigation";
import { useOrder } from "@/hooks/useOrders";
import { useWSEvent } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { Order } from "@/types";
import { Clock, ChefHat, Bell, Package, CheckCircle2, ArrowLeft, MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCallback } from "react";
import { useCartStore } from "@/store/cartStore";

const STEPS = [
  {
    key: "received",
    label: "Order Placed",
    icon: Package,
    desc: "We've received your order",
    time: "",
  },
  {
    key: "preparing",
    label: "Order is being prepared",
    icon: ChefHat,
    desc: "Chef is working on it",
    time: "",
  },
  {
    key: "ready",
    label: "Order is ready",
    icon: Bell,
    desc: "Will be served shortly",
    time: "",
  },
  {
    key: "served",
    label: "Order is served",
    icon: CheckCircle2,
    desc: "Enjoy your meal!",
    time: "",
  },
] as const;

export default function OrderStatusPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get("id") ?? "";
  const tableId = useCartStore((s) => s.tableId);
  const { data: order, isLoading } = useOrder(orderId);

  const qc = useQueryClient();
  useWSEvent<{ orderId: string; kitchenStatus: string }>(
    "order.status_changed",
    useCallback((e) => {
      if (e.payload.orderId === orderId) {
        qc.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
      }
    }, [orderId, qc])
  );

  const stepIndex = STEPS.findIndex((s) => s.key === order?.kitchenStatus);

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F9F9F9] p-4 pt-10 max-w-sm mx-auto">
        <Skeleton className="h-8 w-40 mx-auto mb-4 rounded-lg" />
        <Skeleton className="h-28 w-full rounded-xl mb-3" />
        <Skeleton className="h-48 w-full rounded-xl mb-3" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F9F9F9]">
        <p style={{ color: "var(--brand-text-muted)" }}>Order not found.</p>
      </div>
    );
  }

  const slug = typeof window !== "undefined"
    ? localStorage.getItem("dc_restaurant_slug") || "test-bistro"
    : "test-bistro";

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-36">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-white border-b border-[#E8E8E8] px-4 py-3"
           style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "#F3F3F3" }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "var(--brand-text)" }} />
        </button>
        <h1 className="text-base font-bold" style={{ color: "var(--brand-text)" }}>
          Track Your Order
        </h1>
      </div>

      <div className="mx-auto max-w-sm px-4 pt-5 space-y-4">

        {/* ── Location + Table chip ── */}
        <div className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4"
             style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="h-4 w-4 shrink-0" style={{ color: "#B6212A" }} />
            <span className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--brand-text-muted)" }}>
              Your Location
            </span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold" style={{ color: "var(--brand-text)" }}>
                {order.tableLabel ? `Table ${order.tableLabel}` : (tableId ? `Table ${tableId}` : "Dine-in")}
              </p>
              <p className="text-xs mt-0.5" style={{ color: "var(--brand-text-muted)" }}>
                ESTIMATED SERVING TIME
              </p>
              <p className="text-lg font-bold mt-0.5" style={{ color: "#B6212A" }}>
                <Clock className="inline h-4 w-4 mr-1 -mt-0.5" />
                ~15–20 mins
              </p>
            </div>
            {order.paymentStatus === "pending" ? (
              <span className="rounded-full px-3 py-1 text-xs font-semibold badge-pending">
                Payment Pending
              </span>
            ) : (
              <span className="rounded-full px-3 py-1 text-xs font-semibold badge-paid">
                Paid ✓
              </span>
            )}
          </div>
        </div>

        {/* ── Order Status Stepper ── */}
        <div className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4"
             style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-widest mb-4"
             style={{ color: "var(--brand-text-muted)" }}>
            Order Status
          </p>
          <div className="space-y-0">
            {STEPS.map((step, i) => {
              const done = i <= stepIndex;
              const active = i === stepIndex;
              const Icon = step.icon;
              return (
                <div key={step.key} className="flex gap-4">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500 shrink-0",
                      )}
                      style={{
                        borderColor: done ? "#B6212A" : "#E8E8E8",
                        background: done ? "#B6212A" : "#F9F9F9",
                        color: done ? "#FFFFFF" : "#BDBDBD",
                        boxShadow: active ? "0 0 0 4px rgba(182,33,42,0.12)" : "none",
                      }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {i < STEPS.length - 1 && (
                      <div
                        className="w-0.5 flex-1 min-h-[28px] transition-colors duration-500"
                        style={{ background: i < stepIndex ? "#B6212A" : "#E8E8E8" }}
                      />
                    )}
                  </div>

                  {/* Text */}
                  <div className="pb-6 pt-1.5 min-w-0">
                    <p className="text-sm font-semibold"
                       style={{ color: done ? "var(--brand-text)" : "var(--brand-text-muted)" }}>
                      {step.label}
                    </p>
                    {active && (
                      <p className="text-xs mt-0.5 flex items-center gap-1.5"
                         style={{ color: "var(--brand-text-muted)" }}>
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                          style={{ background: "#B6212A" }}
                        />
                        {step.desc}
                      </p>
                    )}
                    {!active && done && (
                      <p className="text-xs mt-0.5" style={{ color: "var(--brand-text-muted)" }}>
                        {step.desc}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Items recap ── */}
        <div className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4 space-y-2"
             style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-xs font-bold uppercase tracking-widest"
             style={{ color: "var(--brand-text-muted)" }}>
            Your Items
          </p>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span style={{ color: "var(--brand-text-muted)" }}>
                {item.quantity}× {item.name}
              </span>
              <span className="font-semibold" style={{ color: "var(--brand-text)" }}>
                ₹{item.totalPrice.toFixed(0)}
              </span>
            </div>
          ))}
          <div className="border-t border-[#F3F3F3] pt-2 flex justify-between text-sm font-bold">
            <span style={{ color: "var(--brand-text)" }}>Total</span>
            <span style={{ color: "var(--brand-text)" }}>₹{order.total.toFixed(0)}</span>
          </div>
        </div>

        <p className="text-center text-xs flex items-center justify-center gap-1.5 pb-4"
           style={{ color: "var(--brand-text-muted)" }}>
          <span
            className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
            style={{ background: "#2E7D32" }}
          />
          Live updates · No refresh needed
        </p>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="sticky-action-bar">
        <div className="mx-auto max-w-md">
          <button
            className="w-full h-12 rounded-lg font-bold text-sm border-2 touch-manipulation active:scale-[0.98] transition-transform"
            style={{
              borderColor: "#B6212A",
              color: "#B6212A",
              background: "#FFFFFF",
              fontFamily: "inherit",
            }}
            onClick={() => {
              const tableQuery = tableId ? `?table=${tableId}` : "";
              router.push(`/menu/${slug}${tableQuery}`);
            }}
          >
            + Add More Items
          </button>
        </div>
      </div>
    </div>
  );
}
