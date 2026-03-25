"use client";
// src/app/staff/kds/page.tsx
// Phase 4 + Phase 5 — Kitchen Display System with live WebSocket updates

import { useMemo } from "react";
import { useLiveOrders } from "@/hooks/useOrders";
import { useOrderWebSocket } from "@/hooks/useWebSocket";
import { ConnectionBadge } from "@/components/shared/ConnectionBadge";
import { KDSCard } from "@/components/kds/KDSCard";
import { Skeleton } from "@/components/ui/skeleton";
import { KDSOrder, Order } from "@/types";

function toKDSOrder(o: Order): KDSOrder {
  const elapsed = Math.floor(
    (Date.now() - new Date(o.createdAt).getTime()) / 1000
  );
  return { ...o, elapsedSeconds: elapsed, isUrgent: elapsed > 900 };
}

const STATUS_COLS = [
  { status: "received",  label: "🆕 New",       bg: "bg-yellow-50/50 dark:bg-yellow-950/10" },
  { status: "preparing", label: "🔥 Cooking",   bg: "bg-orange-50/50 dark:bg-orange-950/10" },
  { status: "ready",     label: "✅ Ready",      bg: "bg-green-50/50 dark:bg-green-950/10" },
] as const;

export default function KDSPage() {
  const { data: orders = [], isLoading } = useLiveOrders();
  const { connected } = useOrderWebSocket();

  const active = useMemo(
    () =>
      orders
        .filter((o) => o.kitchenStatus !== "served")
        .map(toKDSOrder),
    [orders]
  );

  const byStatus = useMemo(() => {
    const map: Record<string, KDSOrder[]> = {
      received: [], preparing: [], ready: [],
    };
    active.forEach((o) => { if (o.kitchenStatus in map) map[o.kitchenStatus].push(o); });
    return map;
  }, [active]);

  return (
    <div className="flex h-screen flex-col bg-background overflow-hidden">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between border-b px-4 py-3 shrink-0">
        <div>
          <h1 className="text-base font-bold">Kitchen Display</h1>
          <p className="text-xs text-muted-foreground">{active.length} active orders</p>
        </div>
        <ConnectionBadge connected={connected} />
      </div>

      {/* ── 3-column board ── */}
      <div className="grid flex-1 grid-cols-3 gap-1 overflow-hidden p-2">
        {STATUS_COLS.map((col) => (
          <div key={col.status} className={`flex flex-col gap-2 rounded-xl ${col.bg} overflow-hidden`}>
            {/* Column header */}
            <div className="flex items-center justify-between px-3 pt-3 pb-1 shrink-0">
              <span className="text-sm font-bold">{col.label}</span>
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-xs font-bold">
                {byStatus[col.status]?.length ?? 0}
              </span>
            </div>

            {/* Cards */}
            <div className="flex-1 overflow-y-auto space-y-2 px-2 pb-2">
              {isLoading ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-36 w-full rounded-xl" />
                ))
              ) : byStatus[col.status]?.length === 0 ? (
                <div className="flex h-20 items-center justify-center text-xs text-muted-foreground">
                  No orders
                </div>
              ) : (
                byStatus[col.status].map((order) => (
                  <KDSCard key={order.id} order={order} />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
