"use client";
// src/app/pay-bill/page.tsx
// MenEW Stitch Design — Table Bill & Payment screen

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSessionBill, useCreateRazorpayOrder } from "@/hooks/useOrders";
import { Loader2, ArrowLeft, Receipt, Smartphone, CreditCard, Banknote, Users } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type PayMethod = "upi" | "card" | "cash";

export default function PayBillPage() {
  const router = useRouter();
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(true);
  const [isPaying, setIsPaying] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PayMethod>("upi");
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
          description: "Session Payment",
          order_id: rzpData.razorpayOrderId,
          handler: () => {
            setIsPaying(false);
            localStorage.removeItem(storageKey);
            router.push("/pay-bill/success");
          },
          modal: { ondismiss: () => setIsPaying(false) },
          theme: { color: "#FF5757" },
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
    localStorage.removeItem(storageKey);
    router.push("/pay-bill/success");
  };

  // ── No active bill ──
  if (orderIds.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center bg-[#F9F9F9]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full mb-4"
             style={{ background: "#F3F3F3" }}>
          <Receipt className="h-9 w-9" style={{ color: "var(--brand-text-muted)" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--brand-text)" }}>No Active Bill</h2>
        <p className="mt-2 text-sm mb-6" style={{ color: "var(--brand-text-muted)" }}>
          You haven&apos;t placed any orders in this session yet.
        </p>
        <button
          onClick={() => router.push("/menu")}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold border-2"
          style={{ borderColor: "#B6212A", color: "#B6212A", background: "#FFFFFF", fontFamily: "inherit" }}
        >
          Return to Menu
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F9F9F9]">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#FF5757" }} />
      </div>
    );
  }

  if (error || !bill) {
    return (
      <div className="p-6 text-center bg-[#F9F9F9] min-h-screen flex items-center justify-center">
        <p style={{ color: "#BA1A1A" }}>Failed to load session bill.</p>
      </div>
    );
  }

  if (bill.total === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center p-6 text-center bg-[#F9F9F9]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full mb-4"
             style={{ background: "#D4EDDA" }}>
          <Receipt className="h-9 w-9" style={{ color: "#2E7D32" }} />
        </div>
        <h2 className="text-xl font-bold" style={{ color: "var(--brand-text)" }}>Bill Settled</h2>
        <p className="mt-2 text-sm mb-6" style={{ color: "var(--brand-text-muted)" }}>
          All your orders for this session have been paid.
        </p>
        <button
          onClick={() => { localStorage.removeItem(storageKey); router.push("/menu"); }}
          className="rounded-lg px-6 py-2.5 text-sm font-semibold border-2"
          style={{ borderColor: "#B6212A", color: "#B6212A", background: "#FFFFFF", fontFamily: "inherit" }}
        >
          Return to Menu
        </button>
      </div>
    );
  }

  const paymentMethods: { key: PayMethod; label: string; sublabel: string; Icon: React.ElementType }[] = [
    { key: "upi",  label: "UPI",        sublabel: "GPay, PhonePe, Paytm", Icon: Smartphone },
    { key: "card", label: "Card",       sublabel: "Credit / Debit card",  Icon: CreditCard },
    { key: "cash", label: "Cash",       sublabel: "Pay at counter",       Icon: Banknote   },
  ];

  const handlePay = () => {
    if (selectedMethod === "cash") handlePayCash();
    else handlePayDigital();
  };

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-40">

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
        <div>
          <h1 className="text-base font-bold leading-tight" style={{ color: "var(--brand-text)" }}>
            {tableId ? `Table ${tableId} - Final Bill` : "Final Bill"}
          </h1>
          <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>TABLE NO. {tableId}</p>
        </div>
      </div>

      <div className="mx-auto max-w-md px-4 pt-4 space-y-4">

        {/* ── Table info chip ── */}
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: "#B6212A" }} />
          <span className="text-sm font-medium" style={{ color: "var(--brand-text)" }}>
            {tableId ? `Table ${tableId}` : "Dine-in"}
          </span>
          <span className="ml-auto text-xs font-semibold rounded-full px-2.5 py-0.5"
                style={{ background: "#FFF3CD", color: "#856404" }}>
            Payment Pending
          </span>
        </div>

        {/* ── Order History ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] overflow-hidden"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div className="px-4 py-3 flex items-center gap-2 border-b border-[#F3F3F3]">
            <Receipt className="h-4 w-4" style={{ color: "#B6212A" }} />
            <p className="text-sm font-bold" style={{ color: "var(--brand-text)" }}>Order History</p>
            <span className="ml-auto text-xs" style={{ color: "var(--brand-text-muted)" }}>
              {bill.items.length} items
            </span>
          </div>
          <div className="px-4 py-3 space-y-3">
            {bill.items.map((item, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm">
                <div className="flex items-start gap-2 max-w-[70%]">
                  <span className="font-bold shrink-0" style={{ color: "#FF5757" }}>
                    {item.quantity}×
                  </span>
                  <div>
                    <p style={{ color: "var(--brand-text)" }}>{item.name}</p>
                    {item.specialNote && (
                      <p className="text-xs mt-0.5 leading-snug" style={{ color: "var(--brand-text-muted)" }}>
                        {item.specialNote}
                      </p>
                    )}
                  </div>
                </div>
                <span className="font-semibold" style={{ color: "var(--brand-text)" }}>
                  ₹{item.totalPrice.toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Total Summary ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4 space-y-2"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-sm font-bold mb-2" style={{ color: "var(--brand-text)" }}>Total Summary</p>
          <div className="flex justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
            <span>Subtotal</span><span>₹{bill.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
            <span>GST (5%)</span><span>₹{bill.gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm" style={{ color: "var(--brand-text-muted)" }}>
            <span>Platform Fee</span><span>₹{bill.platformFee.toFixed(2)}</span>
          </div>
          <div className="flex justify-between font-bold text-base pt-2.5 border-t border-[#F3F3F3]"
               style={{ color: "var(--brand-text)" }}>
            <span>Total Due</span>
            <span style={{ color: "#B6212A" }}>₹{bill.total.toFixed(0)}</span>
          </div>
        </section>

        {/* ── Payment Method Selector ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-sm font-bold mb-3" style={{ color: "var(--brand-text)" }}>
            Choose Payment Method
          </p>
          <div className="grid grid-cols-3 gap-2">
            {paymentMethods.map(({ key, label, sublabel, Icon }) => (
              <button
                key={key}
                onClick={() => setSelectedMethod(key)}
                className="flex flex-col items-center gap-1.5 rounded-xl py-3 px-2 border-2 transition-all touch-manipulation"
                style={{
                  borderColor: selectedMethod === key ? "#B6212A" : "#E8E8E8",
                  background: selectedMethod === key ? "#FFF5F5" : "#F9F9F9",
                }}
              >
                <Icon
                  className="h-5 w-5"
                  style={{ color: selectedMethod === key ? "#B6212A" : "#9E9E9E" }}
                />
                <span className="text-xs font-bold"
                      style={{ color: selectedMethod === key ? "#B6212A" : "var(--brand-text)" }}>
                  {label}
                </span>
                <span className="text-[9px] text-center leading-tight"
                      style={{ color: "var(--brand-text-muted)" }}>
                  {sublabel}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* ── Customer Details ── */}
        <section className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4 space-y-3"
                 style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--brand-text)" }}>Your Details</p>
          <input
            placeholder="Name (optional)"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full h-10 rounded-lg px-3 text-sm border outline-none"
            style={{
              background: "#F9F9F9",
              border: "1.5px solid #E8E8E8",
              color: "var(--brand-text)",
              fontFamily: "inherit",
            }}
          />
          <input
            placeholder="Mobile number (optional)"
            type="tel"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
            className="w-full h-10 rounded-lg px-3 text-sm border outline-none"
            style={{
              background: "#F9F9F9",
              border: "1.5px solid #E8E8E8",
              color: "var(--brand-text)",
              fontFamily: "inherit",
            }}
          />
          <div className="flex items-start gap-2.5 pt-1">
            <Checkbox
              id="mktg"
              checked={marketingOptIn}
              onCheckedChange={(v) => setMarketingOptIn(!!v)}
              className="mt-0.5"
            />
            <label htmlFor="mktg" className="cursor-pointer text-xs leading-relaxed"
                   style={{ color: "var(--brand-text-muted)" }}>
              Join our VIP WhatsApp list for{" "}
              <span className="font-bold" style={{ color: "#FF5757" }}>10% off</span>
              {" "}your next order.
            </label>
          </div>
        </section>
      </div>

      {/* ── Sticky CTA ── */}
      <div className="sticky-action-bar">
        <div className="mx-auto max-w-md">
          <button
            className="btn-brand-primary"
            disabled={isPaying || createRazorpayOrder.isPending}
            onClick={handlePay}
          >
            {isPaying || createRazorpayOrder.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processing…
              </>
            ) : (
              `Pay & Settle Bill · ₹${bill.total.toFixed(0)}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
