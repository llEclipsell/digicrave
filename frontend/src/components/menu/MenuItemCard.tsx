"use client";
// src/components/menu/MenuItemCard.tsx
// MenEW Stitch Design — menu item card

import { useState } from "react";
import { Plus, Minus, Star, Zap } from "lucide-react";
import { MenuItem, getDigitalBasePrice } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

interface MenuItemCardProps {
  item: MenuItem;
  onUpsellTrigger?: (crossSells: string[]) => void;
}

export function MenuItemCard({ item, onUpsellTrigger }: MenuItemCardProps) {
  const addItem = useCartStore((s) => s.addItem);
  const removeItem = useCartStore((s) => s.removeItem);
  const cartItems = useCartStore((s) => s.items);
  const [imgError, setImgError] = useState(false);

  const cartEntry = cartItems.find((i) => i.menuItemId === item.id);
  const qty = cartEntry?.quantity ?? 0;
  const digitalPrice = getDigitalBasePrice(item);
  const saving = item.priceOffline - digitalPrice;

  function handleAdd() {
    addItem(item);
    if (item.crossSells.length > 0 && qty === 0) {
      onUpsellTrigger?.(item.crossSells);
    }
  }

  const isVeg = item.dietType === "veg" || item.dietType === "vegan";

  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl bg-white border transition-all touch-manipulation",
        !item.isAvailable && "opacity-60",
        qty > 0
          ? "border-[#FF5757] shadow-sm"
          : "border-[#E8E8E8] shadow-[0_2px_8px_rgba(0,0,0,0.05)]"
      )}
      style={{ padding: "12px" }}
    >
      {/* Image */}
      <div className="relative shrink-0 overflow-hidden rounded-lg bg-[#F3F3F3]"
           style={{ width: 88, height: 88 }}>
        {item.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl">🍽️</div>
        )}
        {item.isPopular && (
          <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-md px-1 py-0.5 text-[9px] font-bold text-white"
               style={{ background: "#FFB800" }}>
            <Star className="h-2 w-2 fill-current" />
            HOT
          </div>
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg"
               style={{ background: "rgba(0,0,0,0.55)" }}>
            <span className="text-xs font-semibold text-white">Sold Out</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Diet indicator */}
        <div className="flex items-center gap-1">
          <div
            className="h-3.5 w-3.5 rounded-sm border-2 flex items-center justify-center shrink-0"
            style={{
              borderColor: isVeg ? "#2E7D32" : "#B6212A",
            }}
          >
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{ background: isVeg ? "#2E7D32" : "#B6212A" }}
            />
          </div>
          <span className="text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: isVeg ? "#2E7D32" : "#B6212A" }}>
            {item.dietType === "veg" ? "Veg" : item.dietType === "vegan" ? "Vegan" : "Non-Veg"}
          </span>
        </div>

        {/* Name */}
        <h3 className="text-sm font-bold leading-tight line-clamp-2"
            style={{ color: "var(--brand-text)" }}>
          {item.name}
        </h3>

        {/* Description */}
        <p className="text-xs leading-relaxed line-clamp-2"
           style={{ color: "var(--brand-text-muted)" }}>
          {item.description}
        </p>

        {/* Price + Qty controls */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold" style={{ color: "var(--brand-text)" }}>
                ₹{digitalPrice.toFixed(0)}
              </span>
              {saving > 0 && (
                <span className="text-xs line-through" style={{ color: "var(--brand-text-muted)" }}>
                  ₹{item.priceOffline}
                </span>
              )}
            </div>
            {saving > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3" style={{ color: "#FF5757" }} />
                <span className="text-[10px] font-semibold" style={{ color: "#FF5757" }}>
                  Save ₹{saving.toFixed(0)}
                </span>
              </div>
            )}
          </div>

          {/* Add / Quantity stepper */}
          {item.isAvailable && (
            <div>
              {qty === 0 ? (
                <button
                  onClick={handleAdd}
                  className="flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-bold text-white active:scale-95 transition-transform touch-manipulation"
                  style={{ background: "#FF5757" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  ADD
                </button>
              ) : (
                <div className="flex items-center gap-0.5 rounded-lg p-0.5"
                     style={{ border: "1.5px solid #FF5757", background: "#FFF5F5" }}>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md active:bg-red-100 transition-colors touch-manipulation"
                    onClick={() => removeItem(item.id)}
                  >
                    <Minus className="h-3.5 w-3.5" style={{ color: "#B6212A" }} />
                  </button>
                  <span className="min-w-[22px] text-center text-sm font-bold"
                        style={{ color: "#B6212A" }}>
                    {qty}
                  </span>
                  <button
                    className="flex h-7 w-7 items-center justify-center rounded-md active:bg-red-100 transition-colors touch-manipulation"
                    onClick={handleAdd}
                  >
                    <Plus className="h-3.5 w-3.5" style={{ color: "#B6212A" }} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
