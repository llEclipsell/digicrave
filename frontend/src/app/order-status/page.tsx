"use client";
// src/app/order-status/page.tsx
// Blueprint: Received → Preparing → Ready → Served

import { useSearchParams } from "next/navigation";
import { useOrder } from "@/hooks/useOrders";
import { useWSEvent } from "@/hooks/useWebSocket";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queryClient";
import { Order } from "@/types";
import { CheckCircle2, Clock, ChefHat, Bell, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

const STEPS = [
  { key: "received",  label: "Order Received",  icon: Package,   desc: "Your order is confirmed" },
  { key: "preparing", label: "Being Prepared",  icon: ChefHat,   desc: "Chef is cooking your food" },
  { key: "ready",     label: "Ready!",           icon: Bell,      desc: "Coming to your table soon" },
  { key: "served",    label: "Served",           icon: CheckCircle2, desc: "Enjoy your meal! 🎉" },
] as const;

export default function OrderStatusPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get("id") ?? "";
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

  if (isLoading) {
    return (
      <div className="mx-auto max-w-sm space-y-4 p-6 pt-12">
        <Skeleton className="h-8 w-40 mx-auto" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm min-h-screen bg-background p-4 pt-8">
      <div className="mb-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wider">Order</p>
        <p className="text-2xl font-bold font-mono">{order.orderNumber}</p>
        {order.tableLabel && (
          <p className="text-sm text-muted-foreground">Table {order.tableLabel}</p>
        )}
      </div>

      {/* Stepper */}
      <div className="relative mb-8">
        {STEPS.map((step, i) => {
          const done = i <= stepIndex;
          const active = i === stepIndex;
          const Icon = step.icon;
          return (
            <div key={step.key} className="flex gap-4">
              {/* Icon + connector */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all duration-500",
                    done
                      ? "border-orange-500 bg-orange-500 text-white"
                      : "border-muted bg-background text-muted-foreground",
                    active && "ring-4 ring-orange-200 dark:ring-orange-900"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={cn(
                      "w-0.5 flex-1 min-h-[32px] transition-colors duration-500",
                      i < stepIndex ? "bg-orange-500" : "bg-muted"
                    )}
                  />
                )}
              </div>
              {/* Text */}
              <div className="pb-7 pt-1.5">
                <p className={cn("text-sm font-semibold", !done && "text-muted-foreground")}>
                  {step.label}
                </p>
                {active && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-orange-500 animate-pulse" />
                    {step.desc}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Items recap */}
      <div className="rounded-xl border bg-card p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your Items
        </p>
        {order.items.map((item) => (
          <div key={item.id} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.quantity}× {item.name}</span>
            <span className="font-medium">₹{item.totalPrice.toFixed(2)}</span>
          </div>
        ))}
        <div className="border-t pt-2 flex justify-between text-sm font-bold">
          <span>Total</span>
          <span>₹{order.total.toFixed(2)}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-1">
        <Clock className="h-3 w-3" />
        Live updates · No refresh needed
      </p>
    </div>
  );
}
