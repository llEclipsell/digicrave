"use client";
// src/components/menu/MenuItemCard.tsx
// Phase 2 — mobile-first item card

import { useState } from "react";
import { Plus, Minus, Leaf, Star, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
    // AOV upsell: if item has cross-sells, trigger parent callback
    if (item.crossSells.length > 0 && qty === 0) {
      onUpsellTrigger?.(item.crossSells);
    }
  }

  const dietColors: Record<string, string> = {
    veg: "text-green-600",
    non_veg: "text-red-500",
    vegan: "text-emerald-600",
  };

  const dietLabels: Record<string, string> = {
    veg: "Veg",
    non_veg: "Non-Veg",
    vegan: "Vegan",
  };

  return (
    <div
      className={cn(
        "group flex gap-3 rounded-xl border bg-card p-3 transition-all",
        !item.isAvailable && "opacity-50",
        qty > 0 && "border-orange-300 bg-orange-50/40 dark:border-orange-800 dark:bg-orange-950/20"
      )}
    >
      {/* Image */}
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
        {item.imageUrl && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.name}
            className="h-full w-full object-cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl">🍽️</div>
        )}
        {item.isPopular && (
          <div className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold text-white">
            <Star className="h-2 w-2 fill-current" />
            HOT
          </div>
        )}
        {!item.isAvailable && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/60">
            <span className="text-xs font-semibold text-white">Sold Out</span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        {/* Diet indicator + name */}
        <div className="flex items-start justify-between gap-1">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Leaf className={cn("h-3 w-3 shrink-0", dietColors[item.dietType])} />
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide", dietColors[item.dietType])}>
                {dietLabels[item.dietType]}
              </span>
            </div>
            <h3 className="text-sm font-semibold leading-tight text-foreground line-clamp-2">
              {item.name}
            </h3>
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
          {item.description}
        </p>

        {/* Tags */}
        {item.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="h-4 px-1.5 text-[9px]">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Pricing + Qty */}
        <div className="mt-auto flex items-center justify-between">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-bold text-foreground">
                ₹{digitalPrice.toFixed(0)}
              </span>
              {saving > 0 && (
                <span className="text-xs text-muted-foreground line-through">
                  ₹{item.priceOffline}
                </span>
              )}
            </div>
            {saving > 0 && (
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-orange-500" />
                <span className="text-[10px] font-medium text-orange-600">
                  Save ₹{saving.toFixed(0)}
                </span>
              </div>
            )}
          </div>

          {/* Add / Qty controls */}
          {item.isAvailable && (
            <div className="flex items-center gap-0">
              {qty === 0 ? (
                <Button
                  size="sm"
                  onClick={handleAdd}
                  className="h-8 rounded-lg bg-orange-500 px-4 text-xs font-bold text-white hover:bg-orange-600 active:scale-95 transition-transform"
                >
                  <Plus className="mr-1 h-3 w-3" />
                  ADD
                </Button>
              ) : (
                <div className="flex items-center gap-1 rounded-lg border border-orange-300 bg-orange-50 dark:bg-orange-950/40 p-0.5">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-md text-orange-600 hover:bg-orange-100"
                    onClick={() => removeItem(item.id)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="min-w-[20px] text-center text-sm font-bold text-orange-600">
                    {qty}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 rounded-md text-orange-600 hover:bg-orange-100"
                    onClick={handleAdd}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
