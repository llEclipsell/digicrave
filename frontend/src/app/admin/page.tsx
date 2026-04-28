"use client";
// src/app/admin/page.tsx
// Phase 6 — Owner Admin & Growth Dashboard
// Blueprint: Financial analytics, menu management, WhatsApp wallet, campaign manager

import { useState } from "react";
import {
  BarChart3,
  MessageCircle,
  UtensilsCrossed,
  Settings,
  TrendingUp,
  Send,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
  LogOut,
  ChevronDown,
  Loader2,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";

import { StatsCards } from "@/components/admin/StatsCards";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { WhatsAppWalletModal } from "@/components/admin/WhatsAppWalletModal";

import {
  useRevenueStats,
  useWhatsAppWallet,
  useCampaigns,
  useSendCampaign,
} from "@/hooks/useAdmin";
import { useMenuItems, useToggleItemAvailability } from "@/hooks/useMenu";
import { useConnectionBadge } from "./useConnectionBadge";
import { WhatsAppCampaign } from "@/types";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

// ── Channel breakdown mini-chart ─────────────────────────────────────
function ChannelBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">₹{value.toLocaleString("en-IN")}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all duration-500", color)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Campaign status badge ─────────────────────────────────────────────
const campaignBadge: Record<WhatsAppCampaign["status"], string> = {
  draft:     "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
  scheduled: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  sent:      "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  failed:    "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  queued:    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
};

// ─────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const [period, setPeriod] = useState<"week" | "month" | "year">("month");
  const [walletOpen, setWalletOpen] = useState(false);
  const [newCampaignSegment, setNewCampaignSegment] =
    useState<WhatsAppCampaign["targetSegment"]>("all");

  const { data: stats, isLoading: statsLoading } = useRevenueStats(period);
  const { data: wallet, isLoading: walletLoading } = useWhatsAppWallet();
  const { data: campaigns = [], isLoading: campaignsLoading } = useCampaigns();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems();
  const toggleItem = useToggleItemAvailability();
  const sendCampaign = useSendCampaign();

  const totalChannel = stats
    ? Object.values(stats.channelBreakdown).reduce((s, v) => s + v, 0)
    : 0;

  async function handleQuickCampaign() {
    await sendCampaign.mutateAsync({
      name: `Campaign ${format(new Date(), "dd MMM HH:mm")}`,
      templateId: "tmpl_reorder_v1",
      targetSegment: newCampaignSegment,
    });
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* ── Top Nav ── */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <UtensilsCrossed className="h-4 w-4 text-white" />
            </div>
            <span className="text-base font-bold tracking-tight">DigiCrave</span>
            <Badge variant="outline" className="text-xs font-medium">Admin</Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* Aggregator placeholder */}
            <Badge
              variant="outline"
              className="text-xs text-muted-foreground cursor-not-allowed opacity-60"
              title="UrbanPiper integration — coming after deployment"
            >
              Swiggy/Zomato Sync 🔜
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 text-sm">
                  Restaurant
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 lg:px-6">
        {/* ── Billing debt warning (Blueprint: Debt Lock) ── */}
        {wallet && wallet.balance < 50 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>
                WhatsApp wallet balance is critically low (₹{wallet.balance.toFixed(2)}). Recharge to continue campaigns.
              </span>
              <Button
                size="sm"
                variant="destructive"
                className="ml-4 shrink-0 h-7 text-xs"
                onClick={() => setWalletOpen(true)}
              >
                Recharge Now
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="analytics">
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:grid-cols-none lg:inline-flex">
            <TabsTrigger value="analytics" className="gap-1.5 text-xs lg:text-sm">
              <BarChart3 className="h-3.5 w-3.5" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="menu" className="gap-1.5 text-xs lg:text-sm">
              <UtensilsCrossed className="h-3.5 w-3.5" />
              Menu
            </TabsTrigger>
            <TabsTrigger value="marketing" className="gap-1.5 text-xs lg:text-sm">
              <MessageCircle className="h-3.5 w-3.5" />
              Marketing
            </TabsTrigger>
            <TabsTrigger value="growth" className="gap-1.5 text-xs lg:text-sm">
              <TrendingUp className="h-3.5 w-3.5" />
              Growth
            </TabsTrigger>
          </TabsList>

          {/* ══ Analytics Tab ══════════════════════════════════════════ */}
          <TabsContent value="analytics" className="mt-4 space-y-4">
            {/* Stats cards */}
            <StatsCards stats={stats} isLoading={statsLoading} />

            <div className="grid gap-4 lg:grid-cols-3">
              {/* Revenue chart */}
              <Card className="lg:col-span-2">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-semibold">Revenue Overview</CardTitle>
                  <Select
                    value={period}
                    onValueChange={(v) => setPeriod(v as typeof period)}
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">This Week</SelectItem>
                      <SelectItem value="month">This Month</SelectItem>
                      <SelectItem value="year">This Year</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <RevenueChart
                    data={stats?.dailyData ?? []}
                    isLoading={statsLoading}
                  />
                </CardContent>
              </Card>

              {/* Channel breakdown */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">Revenue by Channel</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {statsLoading ? (
                    <div className="space-y-3">
                      {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-8 w-full" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <ChannelBar
                        label="QR Scan (Dine-in)"
                        value={stats?.channelBreakdown.qrScan ?? 0}
                        total={totalChannel}
                        color="bg-orange-500"
                      />
                      <ChannelBar
                        label="POS (Walk-in)"
                        value={stats?.channelBreakdown.posManual ?? 0}
                        total={totalChannel}
                        color="bg-blue-500"
                      />
                      <ChannelBar
                        label="Swiggy"
                        value={stats?.channelBreakdown.swiggy ?? 0}
                        total={totalChannel}
                        color="bg-orange-300"
                      />
                      <ChannelBar
                        label="Zomato"
                        value={stats?.channelBreakdown.zomato ?? 0}
                        total={totalChannel}
                        color="bg-red-400"
                      />
                      <Separator />
                      {/* Platform fee collected — Blueprint Rule 2 */}
                      <div className="rounded-lg bg-muted/60 p-3 space-y-1.5">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          Platform Fees Collected
                        </p>
                        {statsLoading ? (
                          <Skeleton className="h-5 w-20" />
                        ) : (
                          <p className="text-lg font-bold text-orange-600">
                            ₹
                            {stats?.dailyData
                              .reduce((s, d) => s + d.platformFeeCollected, 0)
                              .toLocaleString("en-IN") ?? 0}
                          </p>
                        )}
                        <p className="text-[10px] text-muted-foreground">
                          ₹3 per digital order via Razorpay Route
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Top items */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Top Selling Items</CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stats?.topItems.map((item, rank) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-3 rounded-lg px-3 py-2 hover:bg-muted/50 transition-colors"
                      >
                        <span className="text-xs font-bold text-muted-foreground w-5">
                          #{rank + 1}
                        </span>
                        <span className="flex-1 text-sm font-medium">{item.name}</span>
                        <span className="text-xs text-muted-foreground">{item.count} sold</span>
                        <span className="text-sm font-bold">
                          ₹{item.revenue.toLocaleString("en-IN")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ Menu Tab ════════════════════════════════════════════════ */}
          <TabsContent value="menu" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">Menu Management</h2>
                <p className="text-xs text-muted-foreground">
                  Toggle availability — updates reflect instantly on QR menu
                </p>
              </div>
              {/* UrbanPiper sync — placeholder per blueprint */}
              <Button
                variant="outline"
                size="sm"
                disabled
                title="Swiggy/Zomato sync via UrbanPiper — coming after deployment"
                className="gap-2 text-xs opacity-50 cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" />
                Sync to Aggregators 🔜
              </Button>
            </div>

            <Card>
              <ScrollArea className="max-h-[480px]">
                <div className="divide-y">
                  {itemsLoading
                    ? Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-4 py-3">
                          <Skeleton className="h-10 w-10 rounded-lg" />
                          <div className="flex-1 space-y-1.5">
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-3 w-24" />
                          </div>
                          <Skeleton className="h-7 w-16" />
                        </div>
                      ))
                    : menuItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
                        >
                          {/* Thumbnail */}
                          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                            {item.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.imageUrl}
                                alt={item.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm">
                                🍽️
                              </div>
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{item.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.categoryName} ·{" "}
                              <span className="font-medium">₹{item.priceOffline}</span>
                              {item.qrDiscountPercent > 0 && (
                                <span className="text-orange-500 ml-1">
                                  -{item.qrDiscountPercent}% QR
                                </span>
                              )}
                            </p>
                          </div>

                          {/* Cross-sells count */}
                          {item.crossSells.length > 0 && (
                            <Badge variant="secondary" className="text-[10px] shrink-0">
                              {item.crossSells.length} upsell
                            </Badge>
                          )}

                          {/* Toggle */}
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-7 gap-1.5 text-xs shrink-0",
                              item.isAvailable
                                ? "text-green-600 hover:text-green-700"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            disabled={toggleItem.isPending}
                            onClick={() =>
                              toggleItem.mutate({
                                itemId: item.id,
                                isAvailable: !item.isAvailable,
                              })
                            }
                          >
                            {item.isAvailable ? (
                              <ToggleRight className="h-4 w-4" />
                            ) : (
                              <ToggleLeft className="h-4 w-4" />
                            )}
                            {item.isAvailable ? "Available" : "Hidden"}
                          </Button>
                        </div>
                      ))}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          {/* ══ Marketing Tab ══════════════════════════════════════════ */}
          <TabsContent value="marketing" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Wallet card */}
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      WhatsApp Wallet
                    </CardTitle>
                    <Button
                      size="sm"
                      className="h-7 bg-green-600 hover:bg-green-700 text-xs"
                      onClick={() => setWalletOpen(true)}
                    >
                      Recharge
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {walletLoading ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <>
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-2xl font-bold">
                            ₹{wallet?.balance.toFixed(2) ?? "0.00"}
                          </p>
                          <p className="text-xs text-muted-foreground">Current balance</p>
                        </div>
                        <Badge
                          className={cn(
                            "text-xs",
                            (wallet?.balance ?? 0) < 100
                              ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                              : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"
                          )}
                        >
                          {(wallet?.balance ?? 0) < 100 ? "⚠ Low" : "✓ Healthy"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-lg bg-muted/50 p-2.5">
                          <p className="text-muted-foreground">Msgs Remaining</p>
                          <p className="text-base font-bold mt-0.5">
                            ~{wallet?.estimatedMessagesRemaining ?? 0}
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2.5">
                          <p className="text-muted-foreground">Sent This Month</p>
                          <p className="text-base font-bold mt-0.5">
                            {wallet?.messagesThisMonth ?? 0}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Quick campaign */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Send className="h-4 w-4 text-blue-500" />
                    Quick Campaign
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Send a WhatsApp blast to opted-in customers.{" "}
                    <span className="font-medium text-foreground">DPDP compliant</span> —
                    only reaches users with{" "}
                    <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                      marketing_opt_in = true
                    </code>
                    .
                  </p>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium">Target Segment</p>
                    <Select
                      value={newCampaignSegment}
                      onValueChange={(v) =>
                        setNewCampaignSegment(v as WhatsAppCampaign["targetSegment"])
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All opted-in customers</SelectItem>
                        <SelectItem value="high_value">High-value customers</SelectItem>
                        <SelectItem value="churned">Churned (30+ days)</SelectItem>
                        <SelectItem value="new">New customers</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    className="w-full h-8 bg-green-600 hover:bg-green-700 text-xs font-bold gap-2"
                    disabled={sendCampaign.isPending || (wallet?.balance ?? 0) < 10}
                    onClick={handleQuickCampaign}
                  >
                    {sendCampaign.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="h-3.5 w-3.5" />
                    )}
                    Send WhatsApp Blast
                  </Button>
                  {(wallet?.balance ?? 0) < 10 && (
                    <p className="text-xs text-destructive text-center">
                      Insufficient wallet balance — please recharge first.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Campaign history */}
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Campaign History</CardTitle>
                  <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs">
                    <Plus className="h-3 w-3" />
                    New
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {campaignsLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full" />
                    ))}
                  </div>
                ) : campaigns.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    No campaigns yet. Send your first blast above.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {campaigns.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center gap-3 rounded-xl border px-3 py-2.5"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {c.targetSegment.replace("_", " ")} ·{" "}
                            {c.scheduledAt
                              ? format(parseISO(c.scheduledAt), "dd MMM, HH:mm")
                              : "Instant"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.sentCount > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {c.sentCount} sent
                            </span>
                          )}
                          <Badge className={cn("text-[10px]", campaignBadge[c.status])}>
                            {c.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ══ Growth Tab ══════════════════════════════════════════════ */}
          <TabsContent value="growth" className="mt-4 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Aggregator integration — placeholder */}
              <Card className="opacity-70">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-sm font-semibold">
                      Aggregator Integration
                    </CardTitle>
                    <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300">
                      Coming Soon
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    UrbanPiper middleware for Swiggy &amp; Zomato will be integrated
                    post-deployment. This will enable:
                  </p>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {[
                      "Single-click menu sync to both platforms",
                      "Unified order feed (QR + Swiggy + Zomato)",
                      "Auto-accept engine based on kitchen load",
                      "Global on/off toggle for delivery apps",
                      "Rider status tracking in POS & KDS",
                      "SLA timer with critical alerts",
                    ].map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <span className="mt-0.5 text-muted-foreground/50">○</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled
                    className="w-full text-xs cursor-not-allowed opacity-60 mt-2"
                  >
                    Configure UrbanPiper (disabled)
                  </Button>
                </CardContent>
              </Card>

              {/* SaaS billing */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">SaaS Billing</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Platform fee: ₹3 is automatically routed to the platform account
                    via Razorpay Route on every digital order.
                  </p>
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">This month's fees</span>
                      <span className="font-bold">
                        ₹
                        {statsLoading ? "…" :
                          stats?.dailyData
                            .reduce((s, d) => s + d.platformFeeCollected, 0)
                            .toLocaleString("en-IN") ?? "0"}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Pending manual debt</span>
                      <span className="font-bold text-amber-600">₹0.00</span>
                    </div>
                  </div>
                  <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 px-3 py-2">
                    <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                      ✓ All digital orders settled via Razorpay Route
                    </p>
                    <p className="text-[10px] text-green-600/80 mt-0.5">
                      Cash orders accumulate as platform debt until manual payment.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* WhatsApp wallet modal */}
      <WhatsAppWalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
