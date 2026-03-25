from typing import Dict, List
from fastapi import WebSocket
import json


class ConnectionManager:
    """
    Blueprint: /ws/{restaurant_id}/{role}
    Roles: kitchen | cashier | customer
    
    Structure:
    connections = {
        "restaurant_id": {
            "kitchen": [ws1, ws2],
            "cashier": [ws1],
            "customer": {customer_id: ws1}
        }
    }
    """

    def __init__(self):
        self.connections: Dict[str, Dict[str, List[WebSocket]]] = {}

    async def connect(
        self,
        websocket: WebSocket,
        restaurant_id: str,
        role: str,
        client_id: str = None
    ):
        await websocket.accept()

        if restaurant_id not in self.connections:
            self.connections[restaurant_id] = {
                "kitchen": [],
                "cashier": [],
                "customer": [],
            }

        if role not in self.connections[restaurant_id]:
            self.connections[restaurant_id][role] = []

        self.connections[restaurant_id][role].append(websocket)
        print(f"[WS] Connected: {role} @ restaurant {restaurant_id}")

    def disconnect(
        self,
        websocket: WebSocket,
        restaurant_id: str,
        role: str,
    ):
        if restaurant_id in self.connections:
            if role in self.connections[restaurant_id]:
                conns = self.connections[restaurant_id][role]
                if websocket in conns:
                    conns.remove(websocket)
                    print(f"[WS] Disconnected: {role} @ restaurant {restaurant_id}")

    async def emit_to_role(
        self,
        restaurant_id: str,
        role: str,
        event: str,
        data: dict,
    ):
        """Send event to all connections of a specific role"""
        if restaurant_id not in self.connections:
            return

        if role not in self.connections[restaurant_id]:
            return

        message = json.dumps({"event": event, "data": data})
        dead_connections = []

        for ws in self.connections[restaurant_id][role]:
            try:
                await ws.send_text(message)
            except Exception:
                dead_connections.append(ws)

        # Clean up dead connections
        for ws in dead_connections:
            self.connections[restaurant_id][role].remove(ws)

    async def emit_to_all(
        self,
        restaurant_id: str,
        event: str,
        data: dict,
    ):
        """Broadcast to ALL roles in a restaurant"""
        for role in ["kitchen", "cashier", "customer"]:
            await self.emit_to_role(restaurant_id, role, event, data)


# Global instance — shared across all routes
manager = ConnectionManager()