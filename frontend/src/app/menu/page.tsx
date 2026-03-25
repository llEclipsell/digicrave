"use client";
// src/app/menu/page.tsx
// Phase 2 — Customer QR Menu (mobile-first)

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryTabs } from "@/components/menu/CategoryTabs";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { FloatingCartBar } from "@/components/menu/FloatingCartBar";
import { UpsellDialog } from "@/components/menu/UpsellDialog";
import { useCategories, useMenuItems } from "@/hooks/useMenu";
import { useCartStore } from "@/store/cartStore";
import { MenuItem } from "@/types";
import { cn } from "@/lib/utils";

export default function MenuPage() {
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");
  const restaurantId =
    searchParams.get("rid") ??
    process.env.NEXT_PUBLIC_RESTAURANT_ID ??
    "";

  const initSession = useCartStore((s) => s.initSession);

  useEffect(() => {
    initSession(restaurantId, tableId);
    if (restaurantId)
      localStorage.setItem("dc_restaurant_id", restaurantId);
  }, [restaurantId, tableId, initSession]);

  const { data: categories = [], isLoading: catsLoading } = useCategories();
  const [activeCatId, setActiveCatId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [dietFilter, setDietFilter] = useState<"all" | "veg" | "non_veg">("all");
  const [upsellItems, setUpsellItems] = useState<MenuItem[]>([]);

  // Set first category active once loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCatId) {
      setActiveCatId(categories[0].id);
    }
  }, [categories, activeCatId]);

  const { data: menuItems = [], isLoading: itemsLoading } =
    useMenuItems(activeCatId || undefined);

  // Filter items client-side
  const filtered = menuItems.filter((item) => {
    const matchSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase());
    const matchDiet =
      dietFilter === "all" || item.dietType === dietFilter;
    return matchSearch && matchDiet;
  });

  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  return (
    <div className="relative min-h-screen bg-background pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Menu</h1>
            {tableId && (
              <p className="text-xs text-muted-foreground">Table {tableId}</p>
            )}
          </div>
          {/* Aggregator badge — placeholder per blueprint */}
          <Badge variant="outline" className="text-xs text-muted-foreground">
            Dine-in
          </Badge>
        </div>

        {/* Search */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search dishes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 pl-9 pr-8 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2"
              >
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Diet filter pills */}
        <div className="flex gap-2 px-4 pb-3">
          {(["all", "veg", "non_veg"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setDietFilter(f)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                dietFilter === f
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {f === "all" ? "All" : f === "veg" ? "🟢 Veg" : "🔴 Non-Veg"}
            </button>
          ))}
          <Filter className="ml-auto h-4 w-4 self-center text-muted-foreground" />
        </div>
      </div>

      {/* ── Category Tabs ── */}
      {!catsLoading && (
        <CategoryTabs
          categories={categories}
          activeId={activeCatId}
          onChange={setActiveCatId}
        />
      )}

      {/* ── Items ── */}
      <div className="px-4 pt-4">
        {catsLoading || itemsLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl border p-3">
                <Skeleton className="h-24 w-24 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-2 pt-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-8 w-20 ml-auto" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <p className="text-4xl">🔍</p>
            <p className="text-base font-semibold">No items found</p>
            <p className="text-sm text-muted-foreground">
              Try a different category or clear your search.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((item) => (
              <div
                key={item.id}
                ref={(el) => { sectionRefs.current[item.id] = el; }}
              >
                <MenuItemCard
                  item={item}
                  onUpsellTrigger={(crossSellIds) => {
                    const suggestions = menuItems.filter((m) =>
                      crossSellIds.includes(m.id) && m.isAvailable
                    );
                    if (suggestions.length > 0) setUpsellItems(suggestions);
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── AOV Upsell Dialog ── */}
      <UpsellDialog
        open={upsellItems.length > 0}
        onClose={() => setUpsellItems([])}
        suggestions={upsellItems}
      />

      {/* ── Floating Cart Bar ── */}
      <FloatingCartBar />
    </div>
  );
}
