// src/store/posStore.ts
// POS-specific state: table-scoped cart + persistence

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { MenuItem } from "@/types";

export interface POSCartItem {
  item: MenuItem;
  qty: number;
}

interface TableOrder {
  tableLabel: string;
  cart: POSCartItem[];
  payMethod: string;
}

interface POSState {
  // persisted
  selectedTable: string;
  tableOrders: Record<string, TableOrder>; // keyed by tableLabel

  // derived helpers (not persisted, computed from tableOrders)
  getCart: (table: string) => POSCartItem[];
  getPayMethod: (table: string) => string;

  // actions
  selectTable: (label: string) => void;
  clearTableSelection: () => void;
  addToCart: (table: string, item: MenuItem) => void;
  removeFromCart: (table: string, itemId: string) => void;
  clearTableCart: (table: string) => void;
  setPayMethod: (table: string, method: string) => void;
}

export const usePOSStore = create<POSState>()(
  persist(
    (set, get) => ({
      selectedTable: "",
      tableOrders: {},

      getCart(table) {
        return get().tableOrders[table]?.cart ?? [];
      },

      getPayMethod(table) {
        return get().tableOrders[table]?.payMethod ?? "cash";
      },

      selectTable(label) {
        set({ selectedTable: label });
      },

      clearTableSelection() {
        set({ selectedTable: "" });
      },

      addToCart(table, item) {
        if (!table) return;
        set((state) => {
          const existing: TableOrder = state.tableOrders[table] ?? {
            tableLabel: table,
            cart: [],
            payMethod: "cash",
          };
          const cartIdx = existing.cart.findIndex((e) => e.item.id === item.id);
          const updatedCart =
            cartIdx >= 0
              ? existing.cart.map((e, i) =>
                  i === cartIdx ? { ...e, qty: e.qty + 1 } : e
                )
              : [...existing.cart, { item, qty: 1 }];

          return {
            tableOrders: {
              ...state.tableOrders,
              [table]: { ...existing, cart: updatedCart },
            },
          };
        });
      },

      removeFromCart(table, itemId) {
        if (!table) return;
        set((state) => {
          const existing = state.tableOrders[table];
          if (!existing) return state;
          const updatedCart = existing.cart
            .map((e) => (e.item.id === itemId ? { ...e, qty: e.qty - 1 } : e))
            .filter((e) => e.qty > 0);
          return {
            tableOrders: {
              ...state.tableOrders,
              [table]: { ...existing, cart: updatedCart },
            },
          };
        });
      },

      clearTableCart(table) {
        if (!table) return;
        set((state) => {
          const next = { ...state.tableOrders };
          delete next[table];
          return {
            tableOrders: next,
            // also deselect if we just cleared the active table
            selectedTable: state.selectedTable === table ? "" : state.selectedTable,
          };
        });
      },

      setPayMethod(table, method) {
        if (!table) return;
        set((state) => {
          const existing: TableOrder = state.tableOrders[table] ?? {
            tableLabel: table,
            cart: [],
            payMethod: method,
          };
          return {
            tableOrders: {
              ...state.tableOrders,
              [table]: { ...existing, payMethod: method },
            },
          };
        });
      },
    }),
    {
      name: "digicrave-pos",
      storage: createJSONStorage(() => localStorage), // survives refresh
      partialize: (s) => ({
        selectedTable: s.selectedTable,
        tableOrders: s.tableOrders,
      }),
    }
  )
);
