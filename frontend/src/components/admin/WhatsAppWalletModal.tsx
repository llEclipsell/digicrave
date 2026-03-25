"use client";
// src/components/admin/WhatsAppWalletModal.tsx
// Phase 6 — Razorpay recharge modal for MSG91 WhatsApp credits

import { useState } from "react";
import { MessageCircle, Zap, RefreshCcw, IndianRupee } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useWhatsAppWallet, useRechargeWallet } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";

const PRESETS = [199, 499, 999, 1999];
const COST_PER_MESSAGE = 0.35; // approx MSG91 rate in INR

interface WhatsAppWalletModalProps {
  open: boolean;
  onClose: () => void;
}

export function WhatsAppWalletModal({ open, onClose }: WhatsAppWalletModalProps) {
  const { data: wallet, isLoading } = useWhatsAppWallet();
  const recharge = useRechargeWallet();
  const [amount, setAmount] = useState<number | "">("");

  const estimatedMessages = amount
    ? Math.floor(Number(amount) / COST_PER_MESSAGE)
    : 0;

  const balancePct = wallet
    ? Math.min(100, (wallet.balance / 2000) * 100)
    : 0;

  function handleRecharge() {
    if (!amount || Number(amount) < 99) return;
    recharge.mutate(Number(amount));
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-green-100 p-2 dark:bg-green-950">
              <MessageCircle className="h-4 w-4 text-green-600" />
            </div>
            <div>
              <DialogTitle>WhatsApp Marketing Wallet</DialogTitle>
              <DialogDescription className="text-xs">
                Powered by MSG91 · DPDP compliant
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── Current balance ── */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
          {isLoading ? (
            <div className="h-16 animate-pulse rounded-lg bg-muted" />
          ) : (
            <>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Current Balance</p>
                  <p className="text-2xl font-bold flex items-baseline gap-0.5">
                    <IndianRupee className="h-4 w-4 mb-0.5" />
                    {wallet?.balance.toFixed(2) ?? "0.00"}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "text-xs",
                    (wallet?.balance ?? 0) < 100
                      ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                      : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                  )}
                >
                  {(wallet?.balance ?? 0) < 100 ? "Low Balance" : "Active"}
                </Badge>
              </div>
              <Progress value={balancePct} className="h-1.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>~{wallet?.estimatedMessagesRemaining ?? 0} messages remaining</span>
                <span>{wallet?.messagesThisMonth ?? 0} sent this month</span>
              </div>
            </>
          )}
        </div>

        <Separator />

        {/* ── Recharge ── */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Top Up</p>

          {/* Preset amounts */}
          <div className="grid grid-cols-4 gap-2">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setAmount(p)}
                className={cn(
                  "rounded-lg border py-2 text-sm font-semibold transition-all",
                  amount === p
                    ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                    : "hover:border-muted-foreground/40"
                )}
              >
                ₹{p}
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Or enter custom amount (min ₹99)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="number"
                min={99}
                placeholder="Custom amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value ? Number(e.target.value) : "")}
                className="pl-8 text-sm"
              />
            </div>
          </div>

          {/* Estimate */}
          {estimatedMessages > 0 && (
            <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2">
              <Zap className="h-3.5 w-3.5 text-blue-500 shrink-0" />
              <p className="text-xs text-blue-700 dark:text-blue-400">
                ₹{amount} ≈{" "}
                <span className="font-bold">{estimatedMessages.toLocaleString()} WhatsApp messages</span>
              </p>
            </div>
          )}

          <Button
            className="w-full bg-green-600 hover:bg-green-700 h-10 font-bold"
            disabled={!amount || Number(amount) < 99 || recharge.isPending}
            onClick={handleRecharge}
          >
            {recharge.isPending ? (
              <><RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> Opening Razorpay…</>
            ) : (
              <>Recharge ₹{amount || "—"} via Razorpay</>
            )}
          </Button>

          <p className="text-center text-[10px] text-muted-foreground">
            Payments secured by Razorpay · Credits valid for 12 months
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
