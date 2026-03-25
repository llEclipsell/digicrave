"use client";
// src/components/menu/FloatingCartBar.tsx

import { ShoppingBag, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

export function FloatingCartBar() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const breakdown = useCartStore((s) => s.breakdown);

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  if (totalQty === 0) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-gradient-to-t from-background via-background/90 to-transparent pb-safe">
      <button
        onClick={() => router.push("/cart")}
        className={cn(
          "flex w-full items-center justify-between rounded-xl",
          "bg-orange-500 px-4 py-3.5 shadow-lg shadow-orange-500/30",
          "active:scale-[0.98] transition-transform"
        )}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600 text-white">
            <ShoppingBag className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-xs font-medium text-orange-100">
              {totalQty} item{totalQty > 1 ? "s" : ""}
            </p>
            <p className="text-sm font-bold text-white">View Cart</p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-white">
          <span className="text-base font-bold">₹{breakdown.total.toFixed(0)}</span>
          <ChevronRight className="h-4 w-4 text-orange-200" />
        </div>
      </button>
    </div>
  );
}
