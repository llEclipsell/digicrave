"use client";
// src/app/menu/[slug]/page.tsx
// Dynamic route: /menu/{restaurant-slug}
// Calls GET /api/v1/menu/{slug} and renders the full menu with Add-to-Cart.

import { useState, useMemo, useEffect, use } from "react";
import { useSearchParams } from "next/navigation";
import { Search, X, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuItemCard } from "@/components/menu/MenuItemCard";
import { FloatingCartBar } from "@/components/menu/FloatingCartBar";
import { UpsellDialog } from "@/components/menu/UpsellDialog";
import { OrdersDrawer } from "@/components/menu/OrdersDrawer";
import { useMenuBySlug } from "@/hooks/useMenu";
import { useCartStore } from "@/store/cartStore";
import { MenuItem } from "@/types";
import { cn } from "@/lib/utils";

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Maps the snake_case API response items to the camelCase MenuItem type
 * that MenuItemCard expects.
 */
function toMenuItem(raw: {
  id: string;
  name: string;
  description: string | null;
  price_offline: number;
  qr_discount_percent: number;
  is_available: boolean;
  image_url: string | null;
  category_id: string;
}, categoryName: string): MenuItem {
  return {
    id: raw.id,
    restaurantId: "",
    categoryId: raw.category_id,
    categoryName,
    name: raw.name,
    description: raw.description ?? "",
    priceOffline: Number(raw.price_offline),
    qrDiscountPercent: Number(raw.qr_discount_percent),
    imageUrl: raw.image_url,
    dietType: "veg",           // Backend doesn't send this yet
    isPopular: false,
    isRecommended: false,
    isAvailable: raw.is_available,
    preparationTimeMinutes: 0,
    tags: [],
    crossSells: [],
    aggregatorMappingId: null,
  };
}

export default function MenuBySlugPage({ params }: SlugPageProps) {
  const { slug } = use(params);
  const searchParams = useSearchParams();
  const tableId = searchParams.get("table");

  const { data, isLoading, isError } = useMenuBySlug(slug);
  const initSession = useCartStore((s) => s.initSession);

  const [activeCatId, setActiveCatId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [upsellItems, setUpsellItems] = useState<MenuItem[]>([]);

  const categories = data?.categories ?? [];
  const rawItems = data?.items ?? [];

  // Build category name lookup
  const catNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  // Map raw API items → MenuItem type
  const allItems = useMemo(
    () => rawItems.map((r) => toMenuItem(r, catNameMap[r.category_id] ?? "")),
    [rawItems, catNameMap]
  );

  // Auto-select first category once loaded
  useEffect(() => {
    if (categories.length > 0 && !activeCatId) {
      setActiveCatId(categories[0].id);
    }
  }, [categories, activeCatId]);

  // Initialize cart session so Zustand store knows the restaurant
  useEffect(() => {
    if (slug) {
      // Use slug as restaurant identifier; tableId from QR query param
      initSession(slug, tableId);
      localStorage.setItem("dc_restaurant_id", slug);
    }
  }, [slug, tableId, initSession]);

  // Filter by category + search
  const filtered = useMemo(() => {
    return allItems.filter((item) => {
      const matchCat = !activeCatId || item.categoryId === activeCatId;
      const matchSearch =
        !search ||
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        item.description.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [allItems, activeCatId, search]);

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-4 text-center">
        <p className="text-4xl">😕</p>
        <p className="text-lg font-semibold">Restaurant not found</p>
        <p className="text-sm text-muted-foreground">
          We couldn&apos;t find a menu for &quot;{slug}&quot;. Check the URL and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight capitalize">
              {slug.replace(/-/g, " ")}
            </h1>
            {tableId && (
              <p className="text-xs text-muted-foreground">Table {tableId}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <OrdersDrawer />
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Dine-in
            </Badge>
          </div>
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
      </div>

      {/* ── Category Tabs ── */}
      {!isLoading && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCatId(cat.id)}
              className={cn(
                "whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-all",
                activeCatId === cat.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Items ── */}
      <div className="px-4 pt-2">
        {isLoading ? (
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
              <MenuItemCard
                key={item.id}
                item={item}
                onUpsellTrigger={(crossSellIds) => {
                  const suggestions = allItems.filter(
                    (m) => crossSellIds.includes(m.id) && m.isAvailable
                  );
                  if (suggestions.length > 0) setUpsellItems(suggestions);
                }}
              />
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
