import { create } from "zustand";

interface SessionState {
  sessionToken: string | null;
  restaurantId: string | null;
  tableNumber: number | null;
  isVerified: boolean;
  setSession: (token: string, rid: string, table: number) => void;
  clearSession: () => void;
}

export const useSessionStore = create<SessionState>()((set) => ({
  sessionToken: null,
  restaurantId: null,
  tableNumber: null,
  isVerified: false,
  
  setSession: (token: string, rid: string, table: number) => set({
    sessionToken: token,
    restaurantId: rid,
    tableNumber: table,
    isVerified: true
  }),
  
  clearSession: () => set({
    sessionToken: null,
    restaurantId: null,
    tableNumber: null,
    isVerified: false
  })
}));
