"use client";
// src/components/menu/FloatingCartBar.tsx
// MenEW Stitch Design — floating cart bar

import { ShoppingBag, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";

export function FloatingCartBar() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const breakdown = useCartStore((s) => s.breakdown);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  if (totalQty === 0) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 px-4 float-cart-enter"
      style={{ bottom: "calc(56px + env(safe-area-inset-bottom, 0px))", paddingBottom: 8 }}
    >
      <button
        onClick={() => router.push("/cart")}
        className="flex w-full items-center justify-between rounded-xl touch-manipulation active:scale-[0.98] transition-transform"
        style={{
          background: "#FF5757",
          padding: "12px 16px",
          boxShadow: "0 4px 20px rgba(255,87,87,0.35)",
        }}
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg"
            style={{ background: "#B6212A" }}
          >
            <ShoppingBag className="h-4 w-4 text-white" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.8)" }}>
              {totalQty} item{totalQty > 1 ? "s" : ""}
            </p>
            <p className="text-sm font-bold text-white">View Cart</p>
          </div>
        </div>
        <div className="flex items-center gap-0.5 text-white">
          <span className="text-base font-bold">₹{breakdown.total.toFixed(0)}</span>
          <ChevronRight className="h-4 w-4" style={{ color: "rgba(255,255,255,0.7)" }} />
        </div>
      </button>
    </div>
  );
}
