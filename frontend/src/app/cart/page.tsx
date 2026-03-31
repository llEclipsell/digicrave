"use client";
// src/app/cart/page.tsx
// Phase 2 — Cart review + dual-path checkout (Razorpay / Pay at Counter)
// Blueprint: Rule 1 (pricing shield) + Rule 2 (Razorpay Route split)

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Banknote, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { CartItemRow } from "@/components/cart/CartItem";
import { CartBreakdown } from "@/components/cart/CartBreakdown";
import { useCartStore } from "@/store/cartStore";
import { usePlaceOrder, useCreateRazorpayOrder } from "@/hooks/useOrders";
import { cn } from "@/lib/utils";

type CheckoutPath = "online" | "counter" | null;

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const breakdown = useCartStore((s) => s.breakdown);
  const tableId = useCartStore((s) => s.tableId);
  const orderType = useCartStore((s) => s.orderType);
  const specialInstructions = useCartStore((s) => s.specialInstructions);
  const setSpecialInstructions = useCartStore((s) => s.setSpecialInstructions);
  const clearCart = useCartStore((s) => s.clearCart);
  const pricingValid = useCartStore((s) => s.pricingValid);

  const restaurantId = useCartStore((s) => s.restaurantId);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const placeOrder = usePlaceOrder();
  
  const handleGoToMenu = () => {
    let url = restaurantId ? `/menu/${restaurantId}` : "/menu";
    if (tableId) {
      url += `?table=${tableId}`;
    }
    router.push(url);
  };

  if (items.length === 0 && !placedOrderId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">🛒</p>
        <h2 className="text-xl font-bold">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground">Add some items from the menu.</p>
        <Button onClick={handleGoToMenu} className="bg-orange-500 hover:bg-orange-600">
          Browse Menu
        </Button>
      </div>
    );
  }

  // ── Success state ──
  if (placedOrderId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-950">
          <CheckCircle2 className="h-10 w-10 text-green-600" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Order Placed!</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Your kitchen is already preparing it 🍳
          </p>
        </div>
        <div className="rounded-xl border bg-muted/40 px-6 py-3 text-sm">
          <p className="text-muted-foreground">Order ID</p>
          <p className="font-mono font-bold text-base">{placedOrderId}</p>
        </div>
        <Button
          className="w-full max-w-xs bg-orange-500 hover:bg-orange-600"
          onClick={() => router.push(`/order-status?id=${placedOrderId}`)}
        >
          Track Order
        </Button>
        <Button
          variant="ghost"
          className="w-full max-w-xs text-sm"
          onClick={() => { clearCart(); handleGoToMenu(); }}
        >
          Back to Menu
        </Button>
      </div>
    );
  }

  async function handlePlaceOrder() {
    const order = await placeOrder.mutateAsync({
      tableId,
      orderType,
      items: items.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        specialNote: i.specialNote,
      })),
      specialInstructions,
      paymentMethod: "cash",
    });
    
    // Track order ID in session array for cumulative billing later
    if (typeof window !== "undefined") {
      const existingStr = localStorage.getItem("dc_session_orders");
      const existingParsed = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem("dc_session_orders", JSON.stringify([...existingParsed, order.order_id]));
      window.dispatchEvent(new Event("dc_orders_updated"));
    }

    // Immediately redirect to order status
    clearCart();
    router.push(`/order-status?id=${order.order_id}`);
  }

  const isSubmitting = placeOrder.isPending;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-base font-bold">Your Cart</h1>
        <span className="ml-auto text-xs text-muted-foreground">
          {items.reduce((s, i) => s + i.quantity, 0)} items
        </span>
      </div>

      <div className="mx-auto max-w-md space-y-4 px-4 pt-4">
        {/* ── Cart Items ── */}
        <section className="space-y-2">
          {items.map((item) => (
            <CartItemRow key={item.menuItemId} item={item} />
          ))}
        </section>

        {/* ── Special Instructions ── */}
        <section className="space-y-1.5 pt-4">
          <Label className="text-sm font-medium">Special Instructions</Label>
          <Textarea
            placeholder="Any allergies, preferences, or notes for the kitchen…"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="resize-none text-sm"
            rows={3}
          />
        </section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="mx-auto max-w-md">
          <Button
            className="w-full bg-orange-500 text-white hover:bg-orange-600 h-12 text-lg font-bold"
            disabled={isSubmitting || !pricingValid}
            onClick={handlePlaceOrder}
          >
            {isSubmitting ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Sending to Kitchen…</>
            ) : (
              "Confirm & Place Order"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
