"use client";
// src/components/cart/CartBreakdown.tsx
// Phase 2 — Transparent pricing breakdown per Blueprint

import { Info, Tag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CartBreakdown as CartBreakdownType } from "@/types";
import { cn } from "@/lib/utils";

interface CartBreakdownProps {
  breakdown: CartBreakdownType;
  className?: string;
}

interface LineItemProps {
  label: string;
  value: string;
  tooltip?: string;
  emphasis?: boolean;
  positive?: boolean;
  muted?: boolean;
}

function LineItem({ label, value, tooltip, emphasis, positive, muted }: LineItemProps) {
  return (
    <div className={cn("flex items-center justify-between text-sm", muted && "text-muted-foreground")}>
      <div className="flex items-center gap-1">
        <span className={cn(emphasis && "font-semibold text-foreground")}>{label}</span>
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-3 w-3 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[200px] text-xs">
                {tooltip}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      <span
        className={cn(
          emphasis && "font-bold text-base text-foreground",
          positive && "font-medium text-green-600"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function CartBreakdown({ breakdown, className }: CartBreakdownProps) {
  return (
    <div className={cn("rounded-xl border bg-card p-4 space-y-2.5", className)}>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Bill Summary
      </p>

      <LineItem label="Subtotal" value={`₹${breakdown.subtotal.toFixed(2)}`} muted />

      <LineItem
        label="GST (5%)"
        value={`₹${breakdown.gst.toFixed(2)}`}
        tooltip="5% GST applied on food subtotal as per government norms."
        muted
      />

      <LineItem
        label="Platform Fee"
        value={`₹${breakdown.platformFee.toFixed(2)}`}
        tooltip="A flat ₹3 fee that helps us maintain this ordering platform — always transparent."
        muted
      />

      <LineItem
        label="Payment Gateway (2%)"
        value={`₹${breakdown.gatewayFee.toFixed(2)}`}
        tooltip="2% charged by Razorpay for secure digital payment processing."
        muted
      />

      <Separator />

      <LineItem
        label="Total"
        value={`₹${breakdown.total.toFixed(2)}`}
        emphasis
      />

      {/* Savings callout — Blueprint Rule 1: QR price < offline price */}
      {breakdown.savings > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 dark:bg-green-950/30 dark:border-green-800">
          <Tag className="h-3.5 w-3.5 text-green-600 shrink-0" />
          <p className="text-xs font-medium text-green-700 dark:text-green-400">
            You save{" "}
            <span className="font-bold">₹{breakdown.savings.toFixed(2)}</span>{" "}
            vs. offline menu price 🎉
          </p>
        </div>
      )}


    </div>
  );
}
