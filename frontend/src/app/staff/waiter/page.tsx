"use client";
// src/app/staff/waiter/page.tsx
// Module 4 — Waiter Mobile Interface
// Blueprint: Push notifications for ready orders, table clearing after departure.
// Uses existing staff routes: GET /staff/orders, PATCH /staff/orders/{id}/status,
// PATCH /staff/tables/{id}

import { useMemo, useCallback } from "react";
import {
  Bell,
  CheckCircle2,
  Loader2,
  LogOut,
  UtensilsCrossed,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionBadge } from "@/components/shared/ConnectionBadge";
import { useLiveOrders, useUpdateKitchenStatus } from "@/hooks/useOrders";
import { useOrderWebSocket } from "@/hooks/useWebSocket";
import { Order } from "@/types";
import { cn } from "@/lib/utils";

const sourceLabel: Record<string, string> = {
  qr_scan: "Dine-in",
  pos_manual: "Walk-in",
  zomato: "Zomato",
  swiggy: "Swiggy",
};

const sourceBadge: Record<string, string> = {
  qr_scan:
    "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  pos_manual:
    "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  zomato:
    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  swiggy:
    "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
};

export default function WaiterPage() {
  const { data: orders = [], isLoading } = useLiveOrders();
  const { connected } = useOrderWebSocket();
  const markServed = useUpdateKitchenStatus();

  // Orders the waiter needs to act on: ready for pickup
  const readyOrders = useMemo(
    () =>
      orders.filter(
        (o: Order) => o.kitchenStatus === "ready"
      ),
    [orders]
  );

  // Orders currently being prepared (for awareness)
  const preparingOrders = useMemo(
    () =>
      orders.filter(
        (o: Order) => o.kitchenStatus === "preparing"
      ),
    [orders]
  );

  const handleMarkServed = useCallback(
    (orderId: string) => {
      markServed.mutate({ orderId, status: "served" });
    },
    [markServed]
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold">Waiter View</h1>
              <p className="text-xs text-muted-foreground">
                {readyOrders.length} ready for pickup
              </p>
            </div>
          </div>
          <ConnectionBadge connected={connected} />
        </div>
      </header>

      <div className="mx-auto max-w-lg space-y-6 px-4 py-4">
        {/* ── Ready for Pickup (priority) ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-green-600" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-green-700 dark:text-green-400">
              Ready for Pickup
            </h2>
            <Badge className="ml-auto bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
              {readyOrders.length}
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-28 w-full rounded-xl" />
              ))}
            </div>
          ) : readyOrders.length === 0 ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed py-10 text-center">
              <CheckCircle2 className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No orders ready right now
              </p>
              <p className="text-xs text-muted-foreground">
                You&apos;ll get an alert when food is ready 🔔
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {readyOrders.map((order: Order) => (
                <div
                  key={order.id}
                  className="rounded-xl border-2 border-green-300 bg-green-50/50 dark:bg-green-950/20 dark:border-green-800 p-4 transition-all animate-in fade-in slide-in-from-top-2"
                >
                  {/* Order headline */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold font-mono">
                          {order.tableLabel ?? order.orderNumber}
                        </span>
                        <Badge
                          className={cn(
                            "text-[10px] font-bold",
                            sourceBadge[order.source] ?? sourceBadge.qr_scan
                          )}
                        >
                          {sourceLabel[order.source] ?? order.source}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        {order.orderNumber}
                      </span>
                    </div>
                    <Badge className="bg-green-500 text-white text-xs animate-pulse">
                      🍽️ READY
                    </Badge>
                  </div>

                  {/* Items */}
                  <div className="space-y-1 mb-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="font-bold text-foreground min-w-[24px]">
                          {item.quantity}×
                        </span>
                        <span className="font-medium">{item.name}</span>
                      </div>
                    ))}
                  </div>

                  {/* Action */}
                  <Button
                    className="w-full h-11 bg-green-600 hover:bg-green-700 text-sm font-bold"
                    disabled={markServed.isPending}
                    onClick={() => handleMarkServed(order.id)}
                  >
                    {markServed.isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Mark as Served
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Being Prepared (awareness) ── */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🔥</span>
            <h2 className="text-sm font-bold uppercase tracking-wider text-orange-700 dark:text-orange-400">
              Being Prepared
            </h2>
            <Badge className="ml-auto bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-xs">
              {preparingOrders.length}
            </Badge>
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : preparingOrders.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No orders being prepared
            </p>
          ) : (
            <div className="space-y-2">
              {preparingOrders.map((order: Order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-xl border bg-card px-4 py-3"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold font-mono">
                        {order.tableLabel ?? order.orderNumber}
                      </span>
                      <Badge
                        className={cn(
                          "text-[9px] font-bold",
                          sourceBadge[order.source] ?? sourceBadge.qr_scan
                        )}
                      >
                        {sourceLabel[order.source] ?? order.source}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {order.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                    </p>
                  </div>
                  <Badge className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300 text-[10px]">
                    Cooking
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
