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

  const [checkoutPath, setCheckoutPath] = useState<CheckoutPath>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [placedOrderId, setPlacedOrderId] = useState<string | null>(null);

  const placeOrder = usePlaceOrder();
  const createRazorpayOrder = useCreateRazorpayOrder();

  if (items.length === 0 && !placedOrderId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <p className="text-5xl">🛒</p>
        <h2 className="text-xl font-bold">Your cart is empty</h2>
        <p className="text-sm text-muted-foreground">Add some items from the menu.</p>
        <Button onClick={() => router.push("/menu")} className="bg-orange-500 hover:bg-orange-600">
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
          onClick={() => { clearCart(); router.push("/menu"); }}
        >
          Back to Menu
        </Button>
      </div>
    );
  }

  async function handleCashOrder() {
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
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      marketingOptIn,
    });
    clearCart();
    setPlacedOrderId(order.orderNumber);
  }

  async function handleOnlinePayment() {
    // Step 1: create internal order
    const order = await placeOrder.mutateAsync({
      tableId,
      orderType,
      items: items.map((i) => ({
        menuItemId: i.menuItemId,
        quantity: i.quantity,
        specialNote: i.specialNote,
      })),
      specialInstructions,
      paymentMethod: "online",
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      marketingOptIn,
    });

    // Step 2: create Razorpay order (Blueprint Rule 2: ₹3 routed to platform)
    const rzpData = await createRazorpayOrder.mutateAsync(order.id);

    if (typeof window !== "undefined" && window.Razorpay) {
      const rzp = new window.Razorpay({
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: "DigiCrave",
        description: `Order ${order.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        prefill: { contact: customerPhone },
        handler: () => {
          clearCart();
          setPlacedOrderId(order.orderNumber);
        },
        modal: { ondismiss: () => {} },
        theme: { color: "#F97316" },
      });
      rzp.open();
    }
  }

  const isSubmitting = placeOrder.isPending || createRazorpayOrder.isPending;

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
        <section className="space-y-1.5">
          <Label className="text-sm font-medium">Special Instructions</Label>
          <Textarea
            placeholder="Any allergies, preferences, or notes for the kitchen…"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
            className="resize-none text-sm"
            rows={2}
          />
        </section>

        {/* ── Customer Details ── */}
        <section className="space-y-3 rounded-xl border p-4">
          <p className="text-sm font-semibold">Your Details (optional)</p>
          <div className="space-y-2">
            <Input
              placeholder="Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-9 text-sm"
            />
            <Input
              placeholder="Mobile number"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-9 text-sm"
            />
          </div>

          {/* Blueprint: DPDP-compliant marketing opt-in */}
          <div className="flex items-start gap-2.5">
            <Checkbox
              id="mktg"
              checked={marketingOptIn}
              onCheckedChange={(v) => setMarketingOptIn(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="mktg" className="cursor-pointer text-xs text-muted-foreground leading-relaxed">
              Join our VIP WhatsApp list for{" "}
              <span className="font-semibold text-orange-500">10% off</span> your
              next order. (DPDP compliant — unsubscribe anytime)
            </label>
          </div>
        </section>

        {/* ── Bill Summary ── */}
        <CartBreakdown breakdown={breakdown} />

        {/* ── Checkout Path Selection ── */}
        <section className="space-y-2">
          <p className="text-sm font-semibold">How would you like to pay?</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setCheckoutPath("online")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                checkoutPath === "online"
                  ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                  : "hover:border-muted-foreground/40"
              )}
            >
              <CreditCard className={cn("h-5 w-5", checkoutPath === "online" ? "text-orange-500" : "text-muted-foreground")} />
              <span className="text-xs font-semibold">Pay Online</span>
              <span className="text-[10px] text-muted-foreground text-center">UPI, Cards via Razorpay</span>
            </button>
            <button
              onClick={() => setCheckoutPath("counter")}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border p-3 transition-all",
                checkoutPath === "counter"
                  ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                  : "hover:border-muted-foreground/40"
              )}
            >
              <Banknote className={cn("h-5 w-5", checkoutPath === "counter" ? "text-orange-500" : "text-muted-foreground")} />
              <span className="text-xs font-semibold">Pay at Counter</span>
              <span className="text-[10px] text-muted-foreground text-center">Cash / Card / UPI</span>
            </button>
          </div>
        </section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4">
        <div className="mx-auto max-w-md">
          {checkoutPath === "online" ? (
            <Button
              className="w-full bg-orange-500 text-white hover:bg-orange-600 h-12 text-base font-bold"
              disabled={isSubmitting || !pricingValid}
              onClick={handleOnlinePayment}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing…</>
              ) : (
                <>Pay ₹{breakdown.total.toFixed(2)} Online</>
              )}
            </Button>
          ) : checkoutPath === "counter" ? (
            <Button
              className="w-full bg-slate-800 text-white hover:bg-slate-700 h-12 text-base font-bold dark:bg-slate-100 dark:text-slate-900"
              disabled={isSubmitting}
              onClick={handleCashOrder}
            >
              {isSubmitting ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Placing Order…</>
              ) : (
                "Place Order — Pay at Counter"
              )}
            </Button>
          ) : (
            <Button className="w-full h-12 text-base font-bold" disabled>
              Select a payment method
            </Button>
          )}
          <p className="mt-2 text-center text-[10px] text-muted-foreground">
            ₹3 platform fee included · Digital price is always lower than menu price
          </p>
        </div>
      </div>
    </div>
  );
}
