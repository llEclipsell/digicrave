"use client";
// src/components/menu/UpsellDialog.tsx
// Blueprint: "Pairs perfectly with…" pop-up when adding items (AOV Multiplier)

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MenuItem, getDigitalBasePrice } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { Sparkles } from "lucide-react";

interface UpsellDialogProps {
  open: boolean;
  onClose: () => void;
  suggestions: MenuItem[];
}

export function UpsellDialog({ open, onClose, suggestions }: UpsellDialogProps) {
  const addItem = useCartStore((s) => s.addItem);

  function handleAdd(item: MenuItem) {
    addItem(item);
    onClose();
  }

  if (suggestions.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm rounded-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-950">
              <Sparkles className="h-4 w-4 text-orange-500" />
            </div>
            <DialogTitle className="text-base">Pairs perfectly with…</DialogTitle>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-2 mt-1">
          {suggestions.map((item) => {
            const price = getDigitalBasePrice(item);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-xl border p-2.5"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-lg">🍽️</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">₹{price.toFixed(0)}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAdd(item)}
                  className="h-8 shrink-0 bg-orange-500 text-xs text-white hover:bg-orange-600"
                >
                  + Add
                </Button>
              </div>
            );
          })}
        </div>

        <Button variant="ghost" size="sm" onClick={onClose} className="mt-1 text-xs text-muted-foreground">
          No thanks
        </Button>
      </DialogContent>
    </Dialog>
  );
}
