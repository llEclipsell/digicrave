"use client";
// src/app/pay-bill/success/page.tsx
// MenEW Stitch Design — Final Bill / Receipt (Payment Successful)

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function PaymentSuccessPage() {
  const router = useRouter();
  const [refNumber] = useState(() =>
    Math.floor(Math.random() * 900000 + 100000).toString()
  );

  // Animate the checkmark on mount
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F9F9F9] px-6 text-center">

      {/* ── Animated success circle ── */}
      <div
        className="relative flex items-center justify-center rounded-full transition-all duration-500"
        style={{
          width: 120,
          height: 120,
          background: visible ? "#D4EDDA" : "#F3F3F3",
          transform: visible ? "scale(1)" : "scale(0.7)",
          opacity: visible ? 1 : 0,
        }}
      >
        {/* Outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "3px solid #2E7D32",
            opacity: visible ? 1 : 0,
            transition: "opacity 0.5s 0.2s",
          }}
        />
        {/* Checkmark SVG */}
        <svg
          viewBox="0 0 52 52"
          fill="none"
          style={{ width: 52, height: 52 }}
        >
          <polyline
            points="14,26 22,34 38,18"
            stroke="#2E7D32"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="60"
            strokeDashoffset={visible ? 0 : 60}
            style={{ transition: "stroke-dashoffset 0.5s 0.3s ease-out" }}
          />
        </svg>
      </div>

      <div
        className="mt-6 space-y-2 transition-all duration-500"
        style={{ opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(16px)" }}
      >
        <h1 className="text-2xl font-bold" style={{ color: "var(--brand-text)" }}>
          Payment Successful!
        </h1>
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          Thank you for dining with us. See you again!
        </p>
      </div>

      {/* ── Bill Reference ── */}
      <div
        className="mt-6 rounded-xl bg-white border border-[#E8E8E8] px-6 py-4 w-full max-w-xs text-center"
        style={{
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s 0.5s",
        }}
      >
        <p className="text-xs font-semibold uppercase tracking-widest"
           style={{ color: "var(--brand-text-muted)" }}>
          Bill Reference
        </p>
        <p className="text-2xl font-bold font-mono mt-1" style={{ color: "var(--brand-text)" }}>
          #{refNumber}
        </p>
        <p className="text-xs mt-1" style={{ color: "var(--brand-text-muted)" }}>
          Payment settled via {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      {/* ── Loyalty nudge ── */}
      <div
        className="mt-4 rounded-xl px-4 py-3 w-full max-w-xs flex items-center gap-3"
        style={{
          background: "#FFF8E1",
          border: "1px solid #FFE082",
          opacity: visible ? 1 : 0,
          transition: "opacity 0.5s 0.7s",
        }}
      >
        <span className="text-2xl">🎁</span>
        <div className="text-left">
          <p className="text-xs font-bold" style={{ color: "#856404" }}>Join Loyalty</p>
          <p className="text-xs" style={{ color: "#856404" }}>Get 10% back on next order</p>
        </div>
      </div>

      {/* ── CTAs ── */}
      <div
        className="mt-8 w-full max-w-xs space-y-3"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 0.5s 0.8s" }}
      >
        <button
          className="btn-brand-primary"
          onClick={() => {
            const slug =
              typeof window !== "undefined"
                ? localStorage.getItem("dc_restaurant_slug") || "menu"
                : "menu";
            router.push(`/menu/${slug}`);
          }}
        >
          Back to Home
        </button>
        <button
          className="w-full text-sm font-medium py-2"
          style={{ color: "var(--brand-text-muted)", fontFamily: "inherit" }}
          onClick={() => router.push("/feedback")}
        >
          Leave Feedback →
        </button>
      </div>
    </div>
  );
}
