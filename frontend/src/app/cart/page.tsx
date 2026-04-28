"use client";
// src/app/cart/page.tsx
// MenEW Stitch Design — Checkout screen

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CartItemRow } from "@/components/cart/CartItem";
import { useCartStore } from "@/store/cartStore";
import { usePlaceOrder } from "@/hooks/useOrders";

export default function CartPage() {
  const router = useRouter();
  const items = useCartStore((s) => s.items);
  const tableId = useCartStore((s) => s.tableId);
  const orderType = useCartStore((s) => s.orderType);
  const specialInstructions = useCartStore((s) => s.specialInstructions);
  const setSpecialInstructions = useCartStore((s) => s.setSpecialInstructions);
  const clearCart = useCartStore((s) => s.clearCart);
  const pricingValid = useCartStore((s) => s.pricingValid);
  const breakdown = useCartStore((s) => s.breakdown);
  const restaurantId = useCartStore((s) => s.restaurantId);

  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const placeOrder = usePlaceOrder();

  const handleGoToMenu = () => {
    const slug = typeof window !== "undefined" ? localStorage.getItem("dc_restaurant_slug") || "test-bistro" : "test-bistro";
    let url = `/menu/${slug}`;
    if (tableId) url += `?table=${tableId}`;
    router.push(url);
  };

  const totalQty = items.reduce((s, i) => s + i.quantity, 0);

  // ── Empty cart state ──
  if (items.length === 0 && !placedOrderId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center bg-[#F9F9F9]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full"
             style={{ background: "#F3F3F3" }}>
          <ShoppingCart className="h-9 w-9" style={{ color: "var(--brand-text-muted)" }} />
        </div>
        <div>
          <h2 className="text-xl font-bold" style={{ color: "var(--brand-text)" }}>Your cart is empty</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--brand-text-muted)" }}>
            Add some delicious items from the menu.
          </p>
        </div>
        <button
          onClick={handleGoToMenu}
          className="btn-brand-primary max-w-xs"
          style={{ maxWidth: 280 }}
        >
          Browse Menu
        </button>
      </div>
    );
  }

  // ── Success state ──
  if (placedOrderId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center bg-[#F9F9F9]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full"
             style={{ background: "#D4EDDA" }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: "#2E7D32" }} />
        </div>
        <div>
          <h2 className="text-2xl font-bold" style={{ color: "var(--brand-text)" }}>Order Placed!</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--brand-text-muted)" }}>
            Your kitchen is already preparing it 🍳
          </p>
        </div>
        <div className="rounded-xl border px-6 py-3 text-sm bg-white"
             style={{ borderColor: "#E8E8E8" }}>
          <p style={{ color: "var(--brand-text-muted)" }}>Order ID</p>
          <p className="font-mono font-bold text-base mt-0.5" style={{ color: "var(--brand-text)" }}>
            {placedOrderId.split("-")[0].toUpperCase()}
          </p>
        </div>
        <button
          className="btn-brand-primary"
          style={{ maxWidth: 320 }}
          onClick={() => router.push(`/order-status?id=${placedOrderId}`)}
        >
          Track Order
        </button>
        <button
          className="text-sm font-medium"
          style={{ color: "var(--brand-text-muted)" }}
          onClick={() => { clearCart(); handleGoToMenu(); }}
        >
          Back to Menu
        </button>
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

    if (typeof window !== "undefined") {
      const storageKey = tableId ? `dc_session_orders_${tableId}` : "dc_session_orders";
      const existingStr = localStorage.getItem(storageKey);
      const existingParsed = existingStr ? JSON.parse(existingStr) : [];
      localStorage.setItem(storageKey, JSON.stringify([...existingParsed, order.order_id]));
      window.dispatchEvent(new Event("dc_orders_updated"));
    }

    clearCart();
    router.push(`/order-status?id=${order.order_id}`);
  }

  const isSubmitting = placeOrder.isPending;

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-32">

      {/* ── Header ── */}
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-white border-b border-[#E8E8E8] px-4 py-3"
           style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        <button
          onClick={() => router.back()}
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: "#F3F3F3" }}
        >
          <ArrowLeft className="h-4 w-4" style={{ color: "var(--brand-text)" }} />
        </button>
        <h1 className="text-base font-bold" style={{ color: "var(--brand-text)" }}>
          Your Cart
        </h1>
        <span className="ml-auto text-xs font-medium"
              style={{ color: "var(--brand-text-muted)" }}>
          {totalQty} item{totalQty !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">

        {/* ── Order Items ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] overflow-hidden"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div className="px-4 py-3 border-b border-[#F3F3F3]">
            <p className="text-sm font-bold" style={{ color: "var(--brand-text)" }}>Order Items</p>
          </div>
          <div className="divide-y divide-[#F3F3F3]">
            {items.map((item) => (
              <CartItemRow key={item.menuItemId} item={item} />
            ))}
          </div>
        </section>

        {/* ── Order Total Summary ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4 space-y-2.5"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-sm font-bold mb-1" style={{ color: "var(--brand-text)" }}>Bill Summary</p>
          <div className="flex justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
            <span>Subtotal</span>
            <span>₹{breakdown.subtotal.toFixed(2)}</span>
          </div>
          {breakdown.gst > 0 && (
            <div className="flex justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
              <span>GST (5%)</span>
              <span>₹{breakdown.gst.toFixed(2)}</span>
            </div>
          )}
          {breakdown.platformFee > 0 && (
            <div className="flex justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
              <span>Platform Fee</span>
              <span>₹{breakdown.platformFee.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-[#F3F3F3]"
               style={{ color: "var(--brand-text)" }}>
            <span>Total</span>
            <span>₹{breakdown.total.toFixed(2)}</span>
          </div>
        </section>

        {/* ── Special Instructions ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4 space-y-2"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <Label className="text-sm font-semibold" style={{ color: "var(--brand-text)" }}>
            Special Instructions
          </Label>
          <Textarea
            placeholder="Any allergies, preferences, or notes for the kitchen…"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="resize-none text-sm border-[#E8E8E8] focus:border-[#FF5757]"
            style={{ background: "#F9F9F9", fontFamily: "inherit" }}
            rows={3}
          />
        </section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="sticky-action-bar">
        <div className="mx-auto max-w-md">
          <button
            className="btn-brand-primary"
            disabled={isSubmitting || !pricingValid}
            onClick={handlePlaceOrder}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Sending to Kitchen…
              </>
            ) : (
              `Place Order · ₹${breakdown.total.toFixed(0)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
