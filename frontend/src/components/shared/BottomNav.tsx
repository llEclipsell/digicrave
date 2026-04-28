"use client";
// src/components/shared/BottomNav.tsx
// MenEW DigiCrave — Mobile bottom navigation bar
// 4 tabs: Menu, Cart, Orders, Profile
// Active tab uses --color-primary-brand (#FF5757)

import { usePathname, useRouter } from "next/navigation";
import { useCartStore } from "@/store/cartStore";
import { cn } from "@/lib/utils";

interface NavTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  href: string;
  /** Match these path prefixes to mark tab as active */
  matchPrefixes: string[];
}

function MenuIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="11" width="18" height="2" rx="1" fill="currentColor" />
      <rect x="3" y="17" width="18" height="2" rx="1" fill="currentColor" />
    </svg>
  );
}

function CartIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M6 2L3 6V20C3 20.5304 3.21071 21.0391 3.58579 21.4142C3.96086 21.7893 4.46957 22 5 22H19C19.5304 22 20.0391 21.7893 20.4142 21.4142C20.7893 21.0391 21 20.5304 21 20V6L18 2H6Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 6H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M16 10C16 11.0609 15.5786 12.0783 14.8284 12.8284C14.0783 13.5786 13.0609 14 12 14C10.9391 14 9.92172 13.5786 9.17157 12.8284C8.42143 12.0783 8 11.0609 8 10"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function OrdersIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M14 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V8L14 2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M14 2V8H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 13H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 17H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10 9H8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const cartItems = useCartStore((s) => s.items);
  const cartQty = cartItems.reduce((s, i) => s + i.quantity, 0);

  // Determine the base slug from the current path or localStorage
  const slugMatch = pathname.match(/^\/menu\/([^/]+)/);
  const slug = slugMatch?.[1] || (typeof window !== "undefined" ? localStorage.getItem("dc_restaurant_slug") : null) || "test-bistro";

  const tabs: NavTab[] = [
    {
      id: "menu",
      label: "Menu",
      icon: <MenuIcon active={false} />,
      href: slug ? `/menu/${slug}` : "/",
      matchPrefixes: ["/menu"],
    },
    {
      id: "cart",
      label: "Cart",
      icon: <CartIcon active={false} />,
      href: "/cart",
      matchPrefixes: ["/cart"],
    },
    {
      id: "orders",
      label: "Orders",
      icon: <OrdersIcon active={false} />,
      href: "/pay-bill",
      matchPrefixes: ["/pay-bill", "/order-status"],
    },
    {
      id: "profile",
      label: "Profile",
      icon: <ProfileIcon active={false} />,
      href: "#",
      matchPrefixes: ["/profile"],
    },
  ];

  const isActive = (tab: NavTab) =>
    tab.matchPrefixes.some((prefix) => pathname.startsWith(prefix));

  // Hide on staff/admin pages
  const isStaffPage = pathname.startsWith("/staff") || pathname.startsWith("/admin");
  if (isStaffPage) return null;

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{
        background: "var(--color-bg-elevated)",
        borderTop: "1px solid var(--color-border-subtle)",
        boxShadow: "0 -2px 12px rgba(0,0,0,0.06)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto grid max-w-[430px] grid-cols-4" style={{ height: 56 }}>
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <button
              key={tab.id}
              id={`bottom-nav-${tab.id}`}
              onClick={() => {
                if (tab.href !== "#") router.push(tab.href);
              }}
              className={cn(
                "bottom-nav-tab relative touch-manipulation",
                active ? "bottom-nav-tab-active" : "bottom-nav-tab-inactive"
              )}
              aria-label={tab.label}
              aria-current={active ? "page" : undefined}
            >
              {/* Active indicator dot */}
              {active && (
                <span
                  className="absolute top-1 left-1/2 -translate-x-1/2 h-[3px] w-5 rounded-full"
                  style={{ background: "var(--color-primary-brand)" }}
                />
              )}

              {/* Icon */}
              <span className="relative">
                {tab.icon}
                {/* Cart badge */}
                {tab.id === "cart" && cartQty > 0 && (
                  <span
                    className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-bold text-white"
                    style={{ background: "var(--color-primary-brand)" }}
                  >
                    {cartQty > 99 ? "99+" : cartQty}
                  </span>
                )}
              </span>

              {/* Label */}
              <span
                className="text-[10px] leading-none"
                style={{ fontWeight: active ? 700 : 500 }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
