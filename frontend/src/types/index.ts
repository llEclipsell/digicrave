// src/types/index.ts
// Full domain model from Master Blueprint

export type DietType = "veg" | "non_veg" | "vegan";
export type OrderSource = "qr_scan" | "pos_manual" | "zomato" | "swiggy";
export type OrderType = "dine_in" | "takeaway" | "delivery";
export type KitchenStatus = "received" | "preparing" | "ready" | "served";
export type PaymentStatus = "pending" | "paid_digital" | "paid_cash";
export type TableStatus = "empty" | "seated" | "waiting_for_food" | "payment_pending";

// ─── Menu ─────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  restaurantId: string;
  name: string;
  sortOrder: number;
  imageUrl: string | null;
}

export interface MenuItem {
  id: string;
  restaurantId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  priceOffline: number;
  qrDiscountPercent: number;
  imageUrl: string | null;
  dietType: DietType;
  isPopular: boolean;
  isRecommended: boolean;
  isAvailable: boolean;
  preparationTimeMinutes: number;
  tags: string[];
  crossSells: string[];
  aggregatorMappingId: string | null; // UrbanPiper placeholder
}

export function getDigitalBasePrice(item: MenuItem): number {
  return Math.round(item.priceOffline * (1 - item.qrDiscountPercent / 100) * 100) / 100;
}

// ─── Cart ─────────────────────────────────────────────────────────────
export interface CartItem {
  menuItemId: string;
  name: string;
  priceOffline: number;
  digitalPrice: number;
  quantity: number;
  imageUrl: string | null;
  dietType: DietType;
  specialNote: string;
}

export interface CartBreakdown {
  subtotal: number;
  gst: number;
  platformFee: number;   // flat ₹3
  gatewayFee: number;    // 2% of subtotal
  total: number;
  offlineTotal: number;
  savings: number;       // must be > 0 (Blueprint Rule 1)
}

export function computeBreakdown(items: CartItem[]): CartBreakdown {
  const subtotal = items.reduce((s, i) => s + i.digitalPrice * i.quantity, 0);
  const offlineTotal = items.reduce((s, i) => s + i.priceOffline * i.quantity, 0);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const platformFee = 3;
  const gatewayFee = Math.round(subtotal * 0.02 * 100) / 100;
  const total = Math.round((subtotal + gst + platformFee + gatewayFee) * 100) / 100;
  const savings = Math.round((offlineTotal - total) * 100) / 100;
  return { subtotal, gst, platformFee, gatewayFee, total, offlineTotal, savings };
}

// ─── Orders ───────────────────────────────────────────────────────────
export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  specialNote: string;
  dietType: DietType;
}

export interface Order {
  id: string;
  orderNumber: string;
  restaurantId: string;
  tableId: string | null;
  tableLabel: string | null;
  source: OrderSource;
  orderType: OrderType;
  kitchenStatus: KitchenStatus;
  paymentStatus: PaymentStatus;
  items: OrderItem[];
  subtotal: number;
  gst: number;
  platformFee: number;
  gatewayFee: number;
  total: number;
  savings: number;
  specialInstructions: string;
  customerName: string | null;
  customerPhone: string | null;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
  aggregatorOrderId: string | null;     // UrbanPiper placeholder
  aggregatorSlaDeadline: string | null; // UrbanPiper placeholder
}

export interface KDSOrder extends Order {
  elapsedSeconds: number;
  isUrgent: boolean;
}

// ─── Tables ───────────────────────────────────────────────────────────
export interface Table {
  id: string;
  restaurantId: string;
  tableNumber: string;
  status: TableStatus;
  currentOrderId: string | null;
  qrCodeUrl: string;
  capacity: number;
}

// ─── Admin / Analytics ───────────────────────────────────────────────
export interface DailyRevenue {
  date: string;
  grossRevenue: number;
  netSettlement: number;
  platformFeeCollected: number;
  orderCount: number;
  avgOrderValue: number;
}

export interface RevenueStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  growthPercent: number;
  totalOrders: number;
  avgOrderValue: number;
  channelBreakdown: { qrScan: number; posManual: number; swiggy: number; zomato: number };
  topItems: { name: string; count: number; revenue: number }[];
  dailyData: DailyRevenue[];
}

export interface WhatsAppWallet {
  balance: number;
  lastRechargeAt: string | null;
  messagesThisMonth: number;
  estimatedMessagesRemaining: number;
}

// ─── WebSocket ────────────────────────────────────────────────────────
export type WSEventType =
  | "order.new"
  | "order.status_changed"
  | "order.payment_received"
  | "menu.item_toggled"
  | "table.status_changed"
  | "billing.debt_warning"
  | "aggregator.order_received"; // placeholder

export interface WSEvent<T = unknown> {
  event: WSEventType;
  restaurantId: string;
  payload: T;
  timestamp: string;
}

// ─── Image Validation ────────────────────────────────────────────────
export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function validateImage(file: File): { valid: boolean; error?: string } {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { valid: false, error: "Only JPG, PNG and WebP images are allowed." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { valid: false, error: "Image must be under 5 MB." };
  }
  return { valid: true };
}

// ─── API ──────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data: T;
  message: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}
