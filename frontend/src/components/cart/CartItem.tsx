"use client";
// src/components/cart/CartItem.tsx

import { Minus, Plus, Trash2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CartItem as CartItemType } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CartItemProps {
  item: CartItemType;
}

const dietDot: Record<string, string> = {
  veg: "bg-green-500",
  non_veg: "bg-red-500",
  vegan: "bg-emerald-500",
};

export function CartItemRow({ item }: CartItemProps) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const updateNote = useCartStore((s) => s.updateNote);
  const [showNote, setShowNote] = useState(!!item.specialNote);

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card p-3">
      <div className="flex items-start gap-3">
        {/* Diet dot */}
        <div className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-sm border-2", dietDot[item.dietType])} />

        {/* Name + price */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">{item.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            ₹{item.digitalPrice.toFixed(2)} each
          </p>
        </div>

        {/* Qty controls */}
        <div className="flex items-center gap-1 rounded-lg border border-orange-200 bg-orange-50 p-0.5 dark:border-orange-800 dark:bg-orange-950/30">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-orange-600 hover:bg-orange-100"
            onClick={() => {
              if (item.quantity === 1) removeItem(item.menuItemId);
              else updateQuantity(item.menuItemId, item.quantity - 1);
            }}
          >
            {item.quantity === 1 ? (
              <Trash2 className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
          </Button>
          <span className="min-w-[20px] text-center text-sm font-bold text-orange-600">
            {item.quantity}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-md text-orange-600 hover:bg-orange-100"
            onClick={() => updateQuantity(item.menuItemId, item.quantity + 1)}
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {/* Line total */}
        <p className="min-w-[52px] text-right text-sm font-bold">
          ₹{(item.digitalPrice * item.quantity).toFixed(2)}
        </p>
      </div>

      {/* Special note */}
      <div className="pl-5">
        {!showNote ? (
          <button
            onClick={() => setShowNote(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <MessageSquare className="h-3 w-3" />
            Add special instructions
          </button>
        ) : (
          <Input
            placeholder="e.g. no onions, extra spicy…"
            value={item.specialNote}
            onChange={(e) => updateNote(item.menuItemId, e.target.value)}
            className="h-8 text-xs"
            autoFocus={!item.specialNote}
          />
        )}
      </div>
    </div>
  );
}
