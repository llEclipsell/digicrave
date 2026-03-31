"use client";
// src/hooks/useWebSocket.ts
// Phase 5 — React hook wrapping the singleton wsManager
// Provides connection state + typed event subscriptions to any component.

import { useEffect, useRef, useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { wsManager } from "@/lib/websocket";
import { queryKeys } from "@/lib/queryClient";
import { WSEventType, WSEvent, Order, KDSOrder } from "@/types";

const RID =
  typeof window !== "undefined"
    ? (new URLSearchParams(window.location.search).get("rid") ??
      localStorage.getItem("dc_restaurant_id") ??
      process.env.NEXT_PUBLIC_RESTAURANT_ID ??
      "")
    : (process.env.NEXT_PUBLIC_RESTAURANT_ID ?? "");

// ── Core connection hook ──────────────────────────────────────────────
export function useWebSocketConnection(role: "kitchen" | "cashier" | "customer" = "customer") {
  const [connected, setConnected] = useState(false);
  const [lastConnectedAt, setLastConnectedAt] = useState<Date | null>(null);

  useEffect(() => {
    wsManager.onConnect(() => {
      setConnected(true);
      setLastConnectedAt(new Date());
    });
    wsManager.onDisconnect(() => setConnected(false));
    wsManager.connect(RID, role);

    return () => {
      // Don't disconnect on unmount — singleton persists across route changes
    };
  }, [role]);

  return { connected, lastConnectedAt };
}

// ── Event subscription hook ───────────────────────────────────────────
export function useWSEvent<T>(
  event: WSEventType,
  handler: (e: WSEvent<T>) => void
) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const stable = (e: WSEvent<T>) => handlerRef.current(e);
    wsManager.on<T>(event, stable);
    return () => wsManager.off<T>(event, stable);
  }, [event]);
}

// ── KDS / Order queue integration ─────────────────────────────────────
// Subscribes to order events and updates TanStack Query cache directly,
// so components re-render without an extra network request.
export function useOrderWebSocket() {
  const qc = useQueryClient();
  const { connected } = useWebSocketConnection();

  // New order arrived
  useWSEvent<any>("order.new", useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.orders.live(RID) });
    qc.invalidateQueries({ queryKey: queryKeys.kds.queue(RID) });
    
    // Audible alert for KDS (Blueprint requirement)
    if (typeof window !== "undefined") {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  }, [qc]));

  // Status changed
  useWSEvent<{ orderId: string; kitchenStatus: string }>(
    "order.status_changed",
    useCallback((e) => {
      const { orderId, kitchenStatus } = e.payload;
      qc.setQueryData<Order[]>(queryKeys.orders.live(RID), (prev = []) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, kitchenStatus: kitchenStatus as Order["kitchenStatus"] }
            : o
        )
      );
      qc.setQueryData<KDSOrder[]>(queryKeys.kds.queue(RID), (prev = []) =>
        prev.map((o) =>
          o.id === orderId
            ? { ...o, kitchenStatus: kitchenStatus as Order["kitchenStatus"] }
            : o
        )
      );
      qc.invalidateQueries({ queryKey: queryKeys.orders.detail(orderId) });
    }, [qc])
  );

  // Payment received
  useWSEvent<{ orderId: string }>(
    "order.payment_received",
    useCallback((e) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.live(RID) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.detail(e.payload.orderId) });
      qc.invalidateQueries({ queryKey: queryKeys.tables.all(RID) });
    }, [qc])
  );

  // Menu item toggled
  useWSEvent<{ itemId: string; isAvailable: boolean }>(
    "menu.item_toggled",
    useCallback(() => {
      qc.invalidateQueries({ queryKey: queryKeys.menu.items(RID) });
    }, [qc])
  );

  // Table status changed
  useWSEvent<{ tableId: string }>(
    "table.status_changed",
    useCallback(() => {
      qc.invalidateQueries({ queryKey: queryKeys.tables.all(RID) });
    }, [qc])
  );

  return { connected };
}
