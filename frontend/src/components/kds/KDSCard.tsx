"use client";
// src/components/kds/KDSCard.tsx
// Phase 4 — Kitchen Display System card
// Blueprint color coding: Blue=Dine-in, Red=Aggregator, Green=Takeaway

import { useState, useEffect } from "react";
import { Clock, ChefHat, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KDSOrder, KitchenStatus } from "@/types";
import { useUpdateKitchenStatus } from "@/hooks/useOrders";
import { cn } from "@/lib/utils";

interface KDSCardProps {
  order: KDSOrder;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

// Blueprint: Blue=Dine-in, Red=Aggregator (Swiggy/Zomato), Green=Takeaway
const sourceConfig = {
  qr_scan:    { border: "border-l-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/20",   label: "Dine-in",   labelClass: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" },
  pos_manual: { border: "border-l-green-500",  bg: "bg-green-50 dark:bg-green-950/20", label: "Takeaway",  labelClass: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" },
  zomato:     { border: "border-l-red-500",    bg: "bg-red-50 dark:bg-red-950/20",     label: "Zomato",    labelClass: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" },
  swiggy:     { border: "border-l-orange-500", bg: "bg-orange-50 dark:bg-orange-950/20",label: "Swiggy",   labelClass: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" },
};

const statusFlow: Record<KitchenStatus, KitchenStatus | null> = {
  received:  "preparing",
  preparing: "ready",
  ready:     "served",
  served:    null,
};

const statusLabel: Record<KitchenStatus, string> = {
  received:  "New",
  preparing: "Preparing",
  ready:     "Ready",
  served:    "Served",
};

const statusColor: Record<KitchenStatus, string> = {
  received:  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  preparing: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  ready:     "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  served:    "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function KDSCard({ order }: KDSCardProps) {
  const [elapsed, setElapsed] = useState(order.elapsedSeconds);
  const updateStatus = useUpdateKitchenStatus();
  const cfg = sourceConfig[order.source] ?? sourceConfig.qr_scan;
  const nextStatus = statusFlow[order.kitchenStatus];

  // Live elapsed timer
  useEffect(() => {
    if (order.kitchenStatus === "served") return;
    const id = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(id);
  }, [order.kitchenStatus]);

  const isUrgent = elapsed > 900; // >15 min = urgent

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border-l-4 bg-card shadow-sm transition-all",
        cfg.border,
        cfg.bg,
        isUrgent && "ring-2 ring-red-400 dark:ring-red-600",
        order.kitchenStatus === "served" && "opacity-60"
      )}
    >
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-2 p-3 pb-2">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-bold leading-none">
              {order.tableLabel ?? order.orderNumber}
            </span>
            <Badge className={cn("h-4 px-1.5 text-[9px] font-bold", cfg.labelClass)}>
              {cfg.label}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{order.orderNumber}</span>
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("text-[9px] font-bold", statusColor[order.kitchenStatus])}>
            {statusLabel[order.kitchenStatus]}
          </Badge>
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-mono font-bold",
              isUrgent ? "text-red-500 animate-pulse" : "text-muted-foreground"
            )}
          >
            {isUrgent && <AlertTriangle className="h-3 w-3" />}
            <Clock className="h-3 w-3" />
            {formatElapsed(elapsed)}
          </div>
        </div>
      </div>

      {/* ── Items ── */}
      <div className="flex-1 space-y-1 px-3 pb-2">
        {order.items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 text-sm">
            <span className="shrink-0 font-bold text-foreground min-w-[24px]">
              {item.quantity}×
            </span>
            <div className="flex-1 min-w-0">
              <span className="font-medium leading-tight">{item.name}</span>
              {item.specialNote && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                  📝 {item.specialNote}
                </p>
              )}
            </div>
          </div>
        ))}
        {order.specialInstructions && (
          <p className="mt-1 rounded bg-amber-50 dark:bg-amber-950/30 px-2 py-1 text-xs text-amber-700 dark:text-amber-400">
            🗒 {order.specialInstructions}
          </p>
        )}
      </div>

      {/* ── Action button ── */}
      {nextStatus && (
        <div className="border-t p-2">
          <Button
            size="sm"
            className={cn(
              "w-full h-9 text-xs font-bold",
              order.kitchenStatus === "received" && "bg-orange-500 hover:bg-orange-600",
              order.kitchenStatus === "preparing" && "bg-green-600 hover:bg-green-700",
              order.kitchenStatus === "ready" && "bg-blue-600 hover:bg-blue-700"
            )}
            disabled={updateStatus.isPending}
            onClick={() => updateStatus.mutate({ orderId: order.id, status: nextStatus })}
          >
            {order.kitchenStatus === "received" && <><ChefHat className="mr-1.5 h-3 w-3" /> Start Preparing</>}
            {order.kitchenStatus === "preparing" && <><CheckCircle2 className="mr-1.5 h-3 w-3" /> Mark Ready</>}
            {order.kitchenStatus === "ready" && <><CheckCircle2 className="mr-1.5 h-3 w-3" /> Mark Served</>}
          </Button>
        </div>
      )}
    </div>
  );
}
