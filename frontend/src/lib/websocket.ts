// src/lib/websocket.ts
// Phase 5 — WebSocket manager
//
// Blueprint requirements implemented:
//  • PING every 30s, expect PONG
//  • Exponential backoff on disconnect (max 30s)
//  • RESYNC_REQUEST with last_event_timestamp on reconnect
//  • Typed event subscriptions

import { WSEvent, WSEventType } from "@/types";

type EventHandler<T = unknown> = (event: WSEvent<T>) => void;
type ConnectionHandler = () => void;

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:8000";
const PING_INTERVAL_MS = 30_000;
const INITIAL_RECONNECT_MS = 1_000;
const MAX_RECONNECT_MS = 30_000;

class DigiCraveWebSocket {
  private socket: WebSocket | null = null;
  private restaurantId = "";
  private role = "customer";
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private lastEventTimestamp: string | null = null;
  private intentionalClose = false;

  private handlers: Map<WSEventType, Set<EventHandler<unknown>>> = new Map();
  private connectHandlers: Set<ConnectionHandler> = new Set();
  private disconnectHandlers: Set<ConnectionHandler> = new Set();

  // ── Public API ────────────────────────────────────────────────────
  connect(restaurantId: string, role: "kitchen" | "cashier" | "customer" = "customer") {
    this.restaurantId = restaurantId;
    this.role = role;
    this.intentionalClose = false;
    this._connect();
  }

  disconnect() {
    this.intentionalClose = true;
    this._cleanup();
    this.socket?.close(1000, "Client disconnect");
    this.socket = null;
  }

  on<T>(event: WSEventType, handler: EventHandler<T>) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as EventHandler<unknown>);
  }

  off<T>(event: WSEventType, handler: EventHandler<T>) {
    this.handlers.get(event)?.delete(handler as EventHandler<unknown>);
  }

  onConnect(handler: ConnectionHandler) { this.connectHandlers.add(handler); }
  onDisconnect(handler: ConnectionHandler) { this.disconnectHandlers.add(handler); }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  // ── Internal ──────────────────────────────────────────────────────
  private _connect() {
    if (this.socket?.readyState === WebSocket.OPEN) return;

    const token = typeof window !== "undefined"
      ? localStorage.getItem("dc_access_token") ?? ""
      : "";

    const url = `${WS_URL}/api/v1/ws/${this.restaurantId}/${this.role}?token=${token}`;
    this.socket = new WebSocket(url);

    this.socket.onopen = () => {
      console.log("[WS] Connected");
      this.reconnectAttempts = 0;
      this._startPing();
      this._resync();
      this.connectHandlers.forEach((h) => h());
    };

    this.socket.onmessage = (evt) => {
      try {
        const data = JSON.parse(evt.data as string) as WSEvent<unknown>;

        // Handle PONG
        if ((data as unknown as { event: string }).event === "PONG") return;

        this.lastEventTimestamp = data.timestamp;
        const listeners = this.handlers.get(data.event);
        listeners?.forEach((h) => h(data));
      } catch {
        console.warn("[WS] Unparseable message", evt.data);
      }
    };

    this.socket.onclose = (evt) => {
      console.warn("[WS] Closed", evt.code, evt.reason);
      this._cleanup();
      this.disconnectHandlers.forEach((h) => h());
      if (!this.intentionalClose) this._scheduleReconnect();
    };

    this.socket.onerror = (err) => {
      console.error("[WS] Error", err);
      this.socket?.close();
    };
  }

  private _startPing() {
    this._stopPing();
    this.pingTimer = setInterval(() => {
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ event: "PING" }));
      }
    }, PING_INTERVAL_MS);
  }

  private _stopPing() {
    if (this.pingTimer !== null) clearInterval(this.pingTimer);
    this.pingTimer = null;
  }

  private _resync() {
    // Blueprint: emit RESYNC_REQUEST with last_event_timestamp on reconnect
    if (this.lastEventTimestamp && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(
        JSON.stringify({
          event: "RESYNC_REQUEST",
          last_event_timestamp: this.lastEventTimestamp,
        })
      );
    }
  }

  private _scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(
      INITIAL_RECONNECT_MS * 2 ** this.reconnectAttempts,
      MAX_RECONNECT_MS
    );
    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempts += 1;
      this._connect();
    }, delay);
  }

  private _cleanup() {
    this._stopPing();
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Singleton — one connection per browser tab
export const wsManager = new DigiCraveWebSocket();
