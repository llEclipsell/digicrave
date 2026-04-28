"use client";
// src/app/menu/[slug]/page.tsx
// MenEW Stitch Design — Digital Menu screen

import { useState, useMemo, useEffect, use } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
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
    dietType: "veg",
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
  const router = useRouter();
  const tableId = searchParams.get("table");

  const { data, isLoading, isError } = useMenuBySlug(slug);
  const initSession = useCartStore((s) => s.initSession);
  const cartItems = useCartStore((s) => s.items);
  const cartQty = cartItems.reduce((s, i) => s + i.quantity, 0);

  const [activeCatId, setActiveCatId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [upsellItems, setUpsellItems] = useState<MenuItem[]>([]);

  const categories = data?.categories ?? [];
  const rawItems = data?.items ?? [];

  const catNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    categories.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [categories]);

  const allItems = useMemo(
    () => rawItems.map((r) => toMenuItem(r, catNameMap[r.category_id] ?? "")),
    [rawItems, catNameMap]
  );

  useEffect(() => {
    if (categories.length > 0 && !activeCatId) {
      setActiveCatId(categories[0].id);
    }
  }, [categories, activeCatId]);

  useEffect(() => {
    if (slug) {
      initSession(slug, tableId);
      localStorage.setItem("dc_restaurant_slug", slug);
    }
  }, [slug, tableId, initSession]);

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

  // Featured item = first available item in list
  const featuredItem = allItems.find((i) => i.isAvailable) ?? allItems[0];

  if (isError) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <p className="text-5xl">😕</p>
        <p className="text-xl font-bold text-foreground">Restaurant not found</p>
        <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
          We couldn&apos;t find a menu for &quot;{slug}&quot;. Check the URL and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background pb-36">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-30 bg-white border-b border-[#E8E8E8]"
           style={{ boxShadow: "0 1px 8px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-base font-bold capitalize" style={{ color: "var(--brand-text)" }}>
              {slug.replace(/-/g, " ")}
            </h1>
            {tableId && (
              <p className="text-xs" style={{ color: "var(--brand-text-muted)" }}>
                Table {tableId}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <OrdersDrawer />
            <span className="text-xs font-medium rounded-full px-2.5 py-0.5 border"
                  style={{ borderColor: "var(--brand-border)", color: "var(--brand-text-muted)" }}>
              Dine-in
            </span>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--brand-text-muted)" }} />
            <input
              placeholder="Search dishes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 rounded-lg pl-10 pr-9 text-sm border outline-none"
              style={{
                background: "#F3F3F3",
                border: "1.5px solid #E8E8E8",
                color: "var(--brand-text)",
                fontFamily: "inherit",
              }}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <X className="h-4 w-4" style={{ color: "var(--brand-text-muted)" }} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── TODAY'S SPECIAL Hero Banner ── */}
      {!isLoading && featuredItem && (
        <div className="mx-4 mt-4 rounded-xl overflow-hidden relative hero-gradient"
             style={{ minHeight: 140 }}>
          {featuredItem.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={featuredItem.imageUrl}
              alt={featuredItem.name}
              className="absolute inset-0 w-full h-full object-cover opacity-25"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-end pr-4 opacity-20 text-7xl">
              🍽️
            </div>
          )}
          <div className="relative z-10 p-4">
            <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase mb-2">
              Today&apos;s Special
            </span>
            <p className="text-white font-bold text-lg leading-tight line-clamp-1">
              {featuredItem.name}
            </p>
            <p className="text-white/80 text-xs mt-0.5 line-clamp-1">
              {featuredItem.description}
            </p>
            <p className="text-white font-bold text-base mt-2">
              ₹{featuredItem.priceOffline}
            </p>
          </div>
        </div>
      )}

      {/* ── Category Pills ── */}
      {!isLoading && categories.length > 0 && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCatId(cat.id)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition-all touch-manipulation",
                activeCatId === cat.id ? "pill-active" : "pill-inactive"
              )}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Menu Items ── */}
      <div className="px-4 pt-1 pb-4">
        {isLoading ? (
          <div className="flex flex-col gap-3 pt-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex gap-3 rounded-xl border p-3 bg-white border-[#E8E8E8]">
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
            <p className="text-sm" style={{ color: "var(--brand-text-muted)" }}>
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
