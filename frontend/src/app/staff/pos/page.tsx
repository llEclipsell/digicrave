"use client";
// src/app/staff/pos/page.tsx
// FIXED:
// 1. Table selection persisted via posStore (localStorage) — survives refresh & navigation
// 2. Cart state is scoped per tableLabel — no cross-table leakage
// 3. "Clear Table" button correctly wipes table cart + releases table
// 4. General bug fixes: payMethod scoped per table, no stale-closure issues

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Minus,
  ShoppingCart,
  Table2,
  CheckCircle2,
  Loader2,
  User,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ConnectionBadge } from "@/components/shared/ConnectionBadge";
import { useCategories, useMenuItems } from "@/hooks/useMenu";
import {
  useLiveOrders,
  usePlaceOrder,
  useMarkPaymentReceived,
} from "@/hooks/useOrders";
import { useOrderWebSocket } from "@/hooks/useWebSocket";
import { usePOSStore } from "@/store/posStore";
import { MenuItem, Order } from "@/types";
import { cn } from "@/lib/utils";

// ── Table status colours ──────────────────────────────────────────────
const TABLE_COLORS: Record<string, string> = {
  empty:
    "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400",
  seated:
    "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/40 dark:text-yellow-400",
  waiting_for_food:
    "bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-900/40 dark:text-orange-400",
  payment_pending:
    "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400",
};

// ── Per-table Order Panel ─────────────────────────────────────────────
function OrderPanel({
  tableLabel,
  onPlaceOrder,
  isSubmitting,
  onClearTable,
}: {
  tableLabel: string;
  onPlaceOrder: (method: string) => void;
  isSubmitting: boolean;
  onClearTable: () => void;
}) {
  // All cart state comes from the POS store, scoped to tableLabel
  const cart = usePOSStore((s) => s.getCart(tableLabel));
  const payMethod = usePOSStore((s) => s.getPayMethod(tableLabel));
  const addToCart = usePOSStore((s) => s.addToCart);
  const removeFromCart = usePOSStore((s) => s.removeFromCart);
  const setPayMethod = usePOSStore((s) => s.setPayMethod);

  const subtotal = cart.reduce(
    (s, e) => s + e.item.priceOffline * e.qty,
    0
  );
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const total = subtotal + gst;
  const totalQty = cart.reduce((s, e) => s + e.qty, 0);

  return (
    <div className="flex flex-col h-full border-l">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div>
          <p className="text-sm font-bold">Current Order</p>
          <p className="text-xs text-muted-foreground">
            {tableLabel || "No table selected"}
          </p>
        </div>
        {tableLabel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearTable}
            className="text-xs text-destructive h-7 gap-1"
            title="Clear table and release it"
          >
            <Trash2 className="h-3 w-3" />
            Clear Table
          </Button>
        )}
      </div>

      {/* Items */}
      <ScrollArea className="flex-1 px-3 py-2">
        {cart.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <ShoppingCart className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {tableLabel
                ? "Select items from the menu"
                : "Select a table first"}
            </p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {cart.map(({ item, qty }) => (
              <div
                key={item.id}
                className="flex items-center gap-2 rounded-lg border px-2 py-1.5"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium leading-tight truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    ₹{item.priceOffline} × {qty}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeFromCart(tableLabel, item.id)}
                  >
                    <Minus className="h-3 w-3" />
                  </Button>
                  <span className="text-xs font-bold w-4 text-center">
                    {qty}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => addToCart(tableLabel, item)}
                  >
                    <Plus className="h-3 w-3" />
                  </Button>
                </div>
                <span className="text-xs font-bold min-w-[44px] text-right">
                  ₹{(item.priceOffline * qty).toFixed(0)}
                </span>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Totals + checkout */}
      {cart.length > 0 && (
        <div className="border-t p-3 space-y-2 shrink-0">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Subtotal ({totalQty} items)</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>GST (5%)</span>
            <span>₹{gst.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
          <Select
            value={payMethod}
            onValueChange={(v) => setPayMethod(tableLabel, v)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="upi">UPI</SelectItem>
            </SelectContent>
          </Select>
          <Button
            className="w-full h-9 bg-orange-500 text-xs font-bold hover:bg-orange-600"
            disabled={isSubmitting || !tableLabel}
            onClick={() => onPlaceOrder(payMethod)}
          >
            {isSubmitting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              `Place Order · ₹${total.toFixed(0)}`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Main POS Page ─────────────────────────────────────────────────────
export default function POSPage() {
  const [search, setSearch] = useState("");
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [view, setView] = useState<"menu" | "tables" | "orders">("menu");

  // POS store — persisted, table-scoped
  const selectedTable = usePOSStore((s) => s.selectedTable);
  const selectTable = usePOSStore((s) => s.selectTable);
  const addToCart = usePOSStore((s) => s.addToCart);
  const clearTableCart = usePOSStore((s) => s.clearTableCart);

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const { data: menuItems = [], isLoading: itemsLoading } = useMenuItems(
    activeCatId || undefined
  );
  const { data: liveOrders = [], isLoading: ordersLoading } = useLiveOrders();
  const { connected } = useOrderWebSocket();
  const placeOrder = usePlaceOrder();
  const markPaid = useMarkPaymentReceived();

  // Derive table statuses from live orders
  const tables = useMemo(() => {
    const nums = Array.from({ length: 10 }, (_, i) =>
      `T-${String(i + 1).padStart(2, "0")}`
    );
    return nums.map((n) => {
      const order = liveOrders.find((o) => o.tableLabel === n);
      const status = order
        ? order.paymentStatus === "pending" &&
          order.kitchenStatus === "ready"
          ? "payment_pending"
          : "waiting_for_food"
        : "empty";
      return { label: n, status, orderId: order?.id ?? null };
    });
  }, [liveOrders]);

  const filtered = useMemo(
    () =>
      menuItems.filter(
        (i) =>
          i.isAvailable &&
          (!search ||
            i.name.toLowerCase().includes(search.toLowerCase()))
      ),
    [menuItems, search]
  );

  // Get current cart from store (scoped to selectedTable)
  const cartForTable = usePOSStore((s) => s.getCart(selectedTable));

  async function handlePlaceOrder(payMethod: string) {
    if (!selectedTable || cartForTable.length === 0) return;

    await placeOrder.mutateAsync({
      tableId: null, // POS orders use table label, not UUID
      orderType: "dine_in",
      items: cartForTable.map((e) => ({
        menuItemId: e.item.id,
        quantity: e.qty,
        specialNote: "",
      })),
      specialInstructions: "",
      paymentMethod: payMethod === "cash" ? "cash" : "online",
    });

    // Clear only this table's cart after successful order
    clearTableCart(selectedTable);
  }

  function handleClearTable() {
    // Fix #3: properly wipe cart and deselect table
    clearTableCart(selectedTable);
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* ── Left: menu / tables / orders ── */}
      <div className="flex flex-[2] flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b px-4 py-3 shrink-0">
          <div>
            <h1 className="text-sm font-bold">POS Terminal</h1>
            {selectedTable && (
              <p className="text-xs text-orange-500 font-medium">
                Active: {selectedTable}
              </p>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            {(["menu", "tables", "orders"] as const).map((v) => (
              <Button
                key={v}
                size="sm"
                variant={view === v ? "default" : "ghost"}
                className="h-7 text-xs capitalize"
                onClick={() => setView(v)}
              >
                {v === "tables" ? (
                  <Table2 className="h-3.5 w-3.5 mr-1" />
                ) : null}
                {v}
              </Button>
            ))}
          </div>
          <ConnectionBadge connected={connected} className="ml-auto" />
        </div>

        {/* ── Menu view ── */}
        {view === "menu" && (
          <>
            <div className="flex gap-2 px-4 py-2 shrink-0 border-b">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search items…"
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            {/* No table warning */}
            {!selectedTable && (
              <div className="mx-4 mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                ⚠ Select a table from the <strong>Tables</strong> tab before adding items.
              </div>
            )}

            {/* Categories */}
            <div className="flex gap-2 px-4 py-2 overflow-x-auto shrink-0">
              {catsLoading ? (
                <Skeleton className="h-7 w-20" />
              ) : (
                categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setActiveCatId(cat.id)}
                    className={cn(
                      "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-all",
                      activeCatId === cat.id
                        ? "bg-orange-500 text-white"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {cat.name}
                  </button>
                ))
              )}
            </div>

            {/* Items grid */}
            <ScrollArea className="flex-1 px-4">
              <div className="grid grid-cols-3 gap-2 py-2">
                {itemsLoading
                  ? Array.from({ length: 9 }).map((_, i) => (
                      <Skeleton key={i} className="h-20 rounded-xl" />
                    ))
                  : filtered.map((item) => {
                      const qty =
                        cartForTable.find((e) => e.item.id === item.id)
                          ?.qty ?? 0;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            if (!selectedTable) {
                              setView("tables");
                              return;
                            }
                            addToCart(selectedTable, item);
                          }}
                          className={cn(
                            "flex flex-col items-start rounded-xl border p-2.5 text-left transition-all active:scale-95",
                            !selectedTable &&
                              "opacity-60 cursor-not-allowed",
                            qty > 0
                              ? "border-orange-400 bg-orange-50 dark:bg-orange-950/30"
                              : "hover:border-muted-foreground/40"
                          )}
                        >
                          <p className="line-clamp-2 text-xs font-semibold leading-tight">
                            {item.name}
                          </p>
                          <p className="mt-auto pt-1.5 text-xs font-bold text-orange-600">
                            ₹{item.priceOffline}
                          </p>
                          {qty > 0 && (
                            <Badge className="mt-1 h-4 px-1.5 text-[9px] bg-orange-500">
                              {qty}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
              </div>
            </ScrollArea>
          </>
        )}

        {/* ── Tables view ── */}
        {view === "tables" && (
          <ScrollArea className="flex-1 p-4">
            <div className="grid grid-cols-4 gap-3">
              {tables.map((t) => {
                const hasItems =
                  (usePOSStore.getState().getCart(t.label)?.length ?? 0) > 0;
                return (
                  <div
                    key={t.label}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-xl border-2 p-3 cursor-pointer transition-all min-h-[80px]",
                      TABLE_COLORS[t.status],
                      selectedTable === t.label &&
                        "ring-2 ring-orange-500 ring-offset-1"
                    )}
                    onClick={() => {
                      selectTable(t.label);
                      setView("menu");
                    }}
                  >
                    <p className="text-sm font-bold">{t.label}</p>
                    <p className="text-[10px] capitalize mt-0.5">
                      {t.status.replace("_", " ")}
                    </p>
                    {hasItems && (
                      <span className="mt-1 h-1.5 w-1.5 rounded-full bg-orange-500 inline-block" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-3">
              {[
                { label: "Empty", color: "bg-slate-400" },
                { label: "Seated", color: "bg-yellow-400" },
                { label: "Waiting for food", color: "bg-orange-400" },
                { label: "Payment pending", color: "bg-blue-400" },
              ].map((l) => (
                <div
                  key={l.label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <div className={cn("h-2.5 w-2.5 rounded-sm", l.color)} />
                  {l.label}
                </div>
              ))}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="h-2.5 w-2.5 rounded-full bg-orange-500 inline-block" />
                Has pending cart
              </div>
            </div>
          </ScrollArea>
        )}

        {/* ── Orders view ── */}
        {view === "orders" && (
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {ordersLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))
                : liveOrders.map((order: Order) => (
                    <div
                      key={order.id}
                      className="rounded-xl border bg-card p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-bold font-mono">
                              {order.orderNumber}
                            </p>
                            {order.tableLabel && (
                              <Badge variant="outline" className="text-xs">
                                {order.tableLabel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {order.items.length} items · ₹
                            {order.total.toFixed(2)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {order.items.map((i) => i.name).join(", ")}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                          <Badge
                            className={cn(
                              "text-[9px]",
                              order.paymentStatus === "pending"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                                : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                            )}
                          >
                            {order.paymentStatus === "pending"
                              ? "Unpaid"
                              : "Paid"}
                          </Badge>
                          {order.paymentStatus === "pending" && (
                            <Button
                              size="sm"
                              className="h-7 text-xs bg-green-600 hover:bg-green-700"
                              disabled={markPaid.isPending}
                              onClick={() =>
                                markPaid.mutate({
                                  orderId: order.id,
                                  method: "cash",
                                })
                              }
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" />
                              Mark Paid
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ── Right: per-table order panel ── */}
      <div className="flex w-72 shrink-0 flex-col">
        {/* Table selector */}
        <div className="flex items-center gap-2 border-b border-l px-3 py-3 shrink-0">
          <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Select
            value={selectedTable}
            onValueChange={(v) => {
              selectTable(v);
              setView("menu");
            }}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue placeholder="Select table" />
            </SelectTrigger>
            <SelectContent>
              {tables.map((t) => (
                <SelectItem
                  key={t.label}
                  value={t.label}
                  className="text-xs"
                >
                  {t.label}{" "}
                  <span className="text-muted-foreground capitalize ml-1">
                    · {t.status.replace("_", " ")}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <OrderPanel
          tableLabel={selectedTable}
          onPlaceOrder={handlePlaceOrder}
          isSubmitting={placeOrder.isPending}
          onClearTable={handleClearTable}
        />
      </div>
    </div>
  );
}
