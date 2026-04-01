"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionBill, useCreateRazorpayOrder } from "@/hooks/useOrders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Loader2, ArrowLeft, Receipt, CreditCard, Banknote } from "lucide-react";
import { useCartStore } from "@/store/cartStore";

export default function PayBillPage() {
  const router = useRouter();
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const tableId = useCartStore((s) => s.tableId);
  const storageKey = tableId ? `dc_session_orders_${tableId}` : "dc_session_orders";

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setOrderIds(parsed);
        }
      } catch (e) {
        console.error("Failed to parse session orders", e);
      }
    }
  }, []);

  const { data: bill, isLoading, error } = useSessionBill(orderIds);
  const createRazorpayOrder = useCreateRazorpayOrder();

  const handlePayDigital = async () => {
    if (!bill || orderIds.length === 0) return;
    try {
      setIsPaying(true);
      const rzpData = await createRazorpayOrder.mutateAsync({ orderIds });
      
      if (typeof window !== "undefined" && window.Razorpay) {
        const rzp = new window.Razorpay({
          key: rzpData.keyId,
          amount: rzpData.amount,
          currency: rzpData.currency,
          name: "DigiCrave",
          description: `Session Payment`,
          order_id: rzpData.razorpayOrderId,
          handler: () => {
            setIsPaying(false);
            // Clear session and redirect to success
            localStorage.removeItem(storageKey);
            router.push("/menu"); // Or a success page
          },
          modal: { ondismiss: () => setIsPaying(false) },
          theme: { color: "#F97316" },
        });
        rzp.open();
      } else {
        setIsPaying(false);
      }
    } catch (e) {
      setIsPaying(false);
    }
  };

  const handlePayCash = () => {
    // For cash, just clear the session and go back to menu.
    // The backend already knows it's pending cash. Staff will collect it.
    localStorage.removeItem(storageKey);
    router.push("/menu");
  };

  if (orderIds.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <Receipt className="mb-4 h-12 w-12 text-muted-foreground" />
        <h2 className="text-xl font-bold">No Active Bill</h2>
        <p className="mt-2 text-sm text-muted-foreground mb-6">
          You haven't placed any orders in this session yet.
        </p>
        <Button onClick={() => router.push("/menu")} variant="outline">
          Return to Menu
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="p-4 text-center text-red-500">
        <p>Failed to load session bill.</p>
      </div>
    );
  }

  // If valid but total is 0 (maybe all orders were already paid)
  if (bill.total === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-4 text-center">
        <Receipt className="mb-4 h-12 w-12 text-green-500" />
        <h2 className="text-xl font-bold">Bill Settled</h2>
        <p className="mt-2 text-sm text-muted-foreground mb-6">
          All your orders for this session have been paid.
        </p>
        <Button onClick={() => {
            localStorage.removeItem(storageKey);
            router.push("/menu");
        }} variant="outline">
          Return to Menu
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 pb-32">
      <header className="sticky top-0 z-10 border-b bg-background/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="-ml-2 h-8 w-8 rounded-full">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold">Pay Bill</h1>
        </div>
      </header>

      <div className="mx-auto max-w-md space-y-6 p-4">
        {/* Session Items Summary */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>Order Summary</span>
              <span className="text-xs font-normal text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                {bill.items.length} items
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {bill.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div className="flex items-start gap-2 max-w-[70%]">
                    <span className="font-semibold text-orange-500">{item.quantity}×</span>
                    <span>
                      {item.name}
                      {item.specialNote && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-snug">Note: {item.specialNote}</p>
                      )}
                    </span>
                  </div>
                  <span className="font-medium">₹{item.totalPrice.toFixed(0)}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>₹{bill.subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>GST (5%)</span>
                <span>₹{bill.gst.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Platform Fee</span>
                <span>₹{bill.platformFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold pt-2 border-t">
                <span>Total Amount</span>
                <span>₹{bill.total.toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Customer Details */}
        <section className="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
          <div className="space-y-1">
            <h3 className="text-sm font-semibold">Your Details</h3>
            <p className="text-xs text-muted-foreground">Select how you'd like your receipt</p>
          </div>
          <div className="space-y-2.5 pt-1">
            <Input
              placeholder="Name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="h-10 text-sm"
            />
            <Input
              placeholder="Mobile number"
              type="tel"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-10 text-sm"
            />
          </div>

          <div className="flex items-start gap-2.5 pt-3">
            <Checkbox
              id="mktg"
              checked={marketingOptIn}
              onCheckedChange={(v) => setMarketingOptIn(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="mktg" className="cursor-pointer text-xs text-muted-foreground leading-relaxed">
              Join our VIP WhatsApp list for <span className="font-semibold text-orange-500">10% off</span> your next order.
            </label>
          </div>
        </section>
      </div>

      {/* Sticky Payment Actions */}
      <div className="fixed bottom-0 left-0 right-0 border-t bg-background p-4 shadow-lg backdrop-blur-md">
        <div className="mx-auto max-w-md space-y-3">
          <Button
            className="w-full bg-orange-500 hover:bg-orange-600 h-12 text-base font-bold text-white shadow"
            disabled={isPaying || createRazorpayOrder.isPending}
            onClick={handlePayDigital}
          >
            {isPaying || createRazorpayOrder.isPending ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Processing…</>
            ) : (
              <>
                <CreditCard className="mr-2 h-5 w-5" />
                Pay ₹{bill.total.toFixed(0)} via UPI/Card
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full h-11 text-sm border-dashed"
            disabled={isPaying || createRazorpayOrder.isPending}
            onClick={handlePayCash}
          >
            <Banknote className="mr-2 h-4 w-4 text-muted-foreground" />
            Pay Cash at Counter
          </Button>
        </div>
      </div>
    </div>
  );
}
