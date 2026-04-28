"use client";
// src/app/feedback/page.tsx
// MenEW Stitch Design — Order Summary & Feedback screen

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, CheckCircle2, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

type RatingKey = "food" | "service" | "ambience";

const RATINGS: { key: RatingKey; label: string; emoji: string }[] = [
  { key: "food",     label: "Food Quality",  emoji: "🍽️" },
  { key: "service",  label: "Service",        emoji: "⚡" },
  { key: "ambience", label: "Ambience",       emoji: "✨" },
];

function StarRow({
  label,
  emoji,
  value,
  onChange,
}: {
  label: string;
  emoji: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm font-semibold" style={{ color: "var(--brand-text)" }}>
          {label}
        </span>
      </div>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHovered(star)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(star)}
            className="touch-manipulation active:scale-110 transition-transform"
          >
            <Star
              className="h-6 w-6"
              style={{
                color: star <= (hovered || value) ? "#FFB800" : "#E8E8E8",
                fill: star <= (hovered || value) ? "#FFB800" : "transparent",
                transition: "color 0.1s, fill 0.1s",
              }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  const router = useRouter();
  const [ratings, setRatings] = useState<Record<RatingKey, number>>({
    food: 0,
    service: 0,
    ambience: 0,
  });
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function handleRate(key: RatingKey, value: number) {
    setRatings((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    setSubmitting(true);
    // Optimistic — no backend endpoint yet, just UI
    await new Promise((r) => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  }

  const canSubmit = Object.values(ratings).some((v) => v > 0);

  // ── Thank you state ──
  if (submitted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 p-6 text-center bg-[#F9F9F9]">
        <div className="flex h-20 w-20 items-center justify-center rounded-full"
             style={{ background: "#D4EDDA" }}>
          <CheckCircle2 className="h-10 w-10" style={{ color: "#2E7D32" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--brand-text)" }}>
            Thank You! 🎉
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--brand-text-muted)" }}>
            Your feedback helps us improve.
          </p>
        </div>
        <button
          className="btn-brand-primary"
          style={{ maxWidth: 280 }}
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
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F9F9F9] pb-36">

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
        <h1 className="text-base font-bold" style={{ color: "var(--brand-text)" }}>Feedback</h1>
      </div>

      <div className="mx-auto max-w-md px-4 pt-6 space-y-4">

        {/* ── Heading ── */}
        <div className="text-center py-2">
          <h2 className="text-2xl font-bold" style={{ color: "var(--brand-text)" }}>
            Thank You! 🙏
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--brand-text-muted)" }}>
            Your meal was served with love. How was your experience?
          </p>
        </div>

        {/* ── Star Ratings ── */}
        <div className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4 space-y-5"
             style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <p className="text-sm font-bold" style={{ color: "var(--brand-text)" }}>
            Rate Your Experience
          </p>
          {RATINGS.map(({ key, label, emoji }) => (
            <StarRow
              key={key}
              label={label}
              emoji={emoji}
              value={ratings[key]}
              onChange={(v) => handleRate(key, v)}
            />
          ))}
        </div>

        {/* ── Comment box ── */}
        <div className="rounded-xl bg-white border border-[#E8E8E8] px-4 py-4"
             style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <label className="text-sm font-bold block mb-2" style={{ color: "var(--brand-text)" }}>
            Additional Comments
          </label>
          <textarea
            placeholder="Tell us more about your experience…"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            className="w-full rounded-lg p-3 text-sm resize-none outline-none"
            style={{
              background: "#F9F9F9",
              border: "1.5px solid #E8E8E8",
              color: "var(--brand-text)",
              fontFamily: "inherit",
            }}
          />
        </div>

        {/* ── Loyalty cross-sell ── */}
        <div className="rounded-xl border border-[#FFE082] px-4 py-3 flex items-center gap-3"
             style={{ background: "#FFF8E1" }}>
          <span className="text-2xl">☕</span>
          <div>
            <p className="text-sm font-bold" style={{ color: "#856404" }}>
              Try our seasonal special
            </p>
            <p className="text-xs" style={{ color: "#856404" }}>
              Matcha Latte — limited availability
            </p>
          </div>
        </div>
      </div>

      {/* ── Sticky Submit ── */}
      <div className="sticky-action-bar">
        <div className="mx-auto max-w-md">
          <button
            className="btn-brand-primary"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Submitting…
              </span>
            ) : (
              "Submit Feedback"
            )}
          </button>
          {!canSubmit && (
            <p className="text-center text-xs mt-2" style={{ color: "var(--brand-text-muted)" }}>
              Please rate at least one category to submit
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
