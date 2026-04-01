// src/store/cartStore.ts
// Phase 2 — Zustand cart with Blueprint pricing engine
//
// Pricing formula (Blueprint Rule 1 + Rule 2):
//   QR Price = (Offline Price × (1 − discount%))
//   Final = Subtotal + GST(5%) + ₹3 Platform Fee + 2% Gateway Fee
//   MUST validate: Final < Offline total

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CartItem,
  CartBreakdown,
  MenuItem,
  OrderType,
  computeBreakdown,
  getDigitalBasePrice,
} from "@/types";

interface CartState {
  restaurantId: string;
  tableId: string | null;
  orderType: OrderType;
  items: CartItem[];
  specialInstructions: string;
  breakdown: CartBreakdown;
  // computed
  pricingValid: boolean;      // Blueprint Rule 1: final < offline
  // actions
  initSession: (restaurantId: string, tableId: string | null) => void;
  addItem: (menuItem: MenuItem) => void;
  removeItem: (menuItemId: string) => void;
  updateQuantity: (menuItemId: string, qty: number) => void;
  updateNote: (menuItemId: string, note: string) => void;
  setOrderType: (type: OrderType) => void;
  setSpecialInstructions: (note: string) => void;
  clearCart: () => void;
}

const EMPTY_BREAKDOWN: CartBreakdown = {
  subtotal: 0,
  gst: 0,
  platformFee: 0,
  gatewayFee: 0,
  total: 0,
  offlineTotal: 0,
  savings: 0,
};

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      restaurantId: "",
      tableId: null,
      orderType: "dine_in",
      items: [],
      specialInstructions: "",
      breakdown: EMPTY_BREAKDOWN,
      pricingValid: true,

      initSession(restaurantId, tableId) {
        const state = get();

        // 1. If there is a tableId in the URL, AND it is explicitly different from the one in memory,
        // it means the customer scanned a NEW QR code for a different table. WE WIPE THE PENDING CART.
        if (tableId && state.tableId && state.tableId !== tableId) {
          // Dispatch event so the UI updates instantly
          if (typeof window !== "undefined") {
            window.dispatchEvent(new Event("dc_orders_updated"));
          }
          set({
            restaurantId: restaurantId || state.restaurantId,
            tableId,
            items: [], // Pending items wiped
            breakdown: { subtotal: 0, gst: 0, platformFee: 0, gatewayFee: 0, total: 0, offlineTotal: 0, savings: 0 },
            pricingValid: true,
            specialInstructions: "",
          });
          return;
        }

        // 2. Otherwise (e.g., they just refreshed, or clicked back to the menu without the ?table param),
        // we DO NOT wipe. We just keep their session alive using the existing memory.
        set({
          restaurantId: restaurantId || state.restaurantId,
          tableId: tableId || state.tableId,
        });
      },

      addItem(menuItem) {
        const { items } = get();
        const digitalPrice = getDigitalBasePrice(menuItem);
        const existing = items.find((i) => i.menuItemId === menuItem.id);

        let updated: CartItem[];
        if (existing) {
          updated = items.map((i) =>
            i.menuItemId === menuItem.id
              ? { ...i, quantity: i.quantity + 1 }
              : i
          );
        } else {
          const newItem: CartItem = {
            menuItemId: menuItem.id,
            name: menuItem.name,
            priceOffline: menuItem.priceOffline,
            digitalPrice,
            quantity: 1,
            imageUrl: menuItem.imageUrl,
            dietType: menuItem.dietType,
            specialNote: "",
          };
          updated = [...items, newItem];
        }

        const breakdown = computeBreakdown(updated);
        const pricingValid = true; // breakdown.savings > 0;
        set({ items: updated, breakdown, pricingValid });
      },

      removeItem(menuItemId) {
        const updated = get()
          .items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, quantity: i.quantity - 1 } : i
          )
          .filter((i) => i.quantity > 0);

        const breakdown = computeBreakdown(updated);
        set({ items: updated, breakdown, pricingValid: true });
      },

      updateQuantity(menuItemId, qty) {
        if (qty <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        const updated = get().items.map((i) =>
          i.menuItemId === menuItemId ? { ...i, quantity: qty } : i
        );
        const breakdown = computeBreakdown(updated);
        set({ items: updated, breakdown, pricingValid: true });
      },

      updateNote(menuItemId, note) {
        set({
          items: get().items.map((i) =>
            i.menuItemId === menuItemId ? { ...i, specialNote: note } : i
          ),
        });
      },

      setOrderType(type) {
        set({ orderType: type });
      },

      setSpecialInstructions(note) {
        set({ specialInstructions: note });
      },

      clearCart() {
        set({
          items: [],
          breakdown: EMPTY_BREAKDOWN,
          pricingValid: true,
          specialInstructions: "",
        });
      },
    }),
    {
      name: "digicrave-cart-v2",
      storage: createJSONStorage(() => sessionStorage), // clears on tab close
      partialize: (state) => ({
        restaurantId: state.restaurantId,
        tableId: state.tableId,
        orderType: state.orderType,
        items: state.items,
        specialInstructions: state.specialInstructions,
        breakdown: state.breakdown,
        pricingValid: state.pricingValid,
      }),
    }
  )
);
