from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from app.core.websocket import manager
from app.core.security import decode_access_token
import json

router = APIRouter()


@router.websocket("/ws/{restaurant_id}/{role}")
async def websocket_endpoint(
    websocket: WebSocket,
    restaurant_id: str,
    role: str,
    token: str = Query(...),
):
    """
    Blueprint: /ws/{restaurant_id}/{role}
    Roles: kitchen | cashier | customer
    
    Connection URL example:
    ws://localhost:8000/api/v1/ws/restaurant-uuid/kitchen?token=jwt_token
    
    Blueprint Sync-on-Reconnect:
    Client sends: {event: "RESYNC_REQUEST", last_event_timestamp: "..."}
    Server responds with missed orders
    """
    # Validate JWT token
    token_data = decode_access_token(token)
    if not token_data:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Validate role
    valid_roles = ["kitchen", "cashier", "customer"]
    if role not in valid_roles:
        await websocket.close(code=4002, reason="Invalid role")
        return

    # Validate restaurant matches token
    if token_data.get("restaurant_id") != restaurant_id:
        await websocket.close(code=4003, reason="Restaurant mismatch")
        return

    client_id = token_data.get("sub")

    # Connect
    await manager.connect(websocket, restaurant_id, role, client_id)

    # Send welcome message
    await websocket.send_text(json.dumps({
        "event": "connected",
        "data": {
            "restaurant_id": restaurant_id,
            "role": role,
            "message": "Connected to DigiCrave real-time"
        }
    }))

    try:
        while True:
            # Listen for client messages
            raw = await websocket.receive_text()
            message = json.loads(raw)
            event = message.get("event")

            # Blueprint: Heartbeat
            if event == "PING":
                await websocket.send_text(json.dumps({
                    "event": "PONG",
                    "data": {}
                }))

            # Blueprint: Sync on reconnect
            elif event == "RESYNC_REQUEST":
                last_timestamp = message.get("last_event_timestamp")
                await websocket.send_text(json.dumps({
                    "event": "RESYNC_RESPONSE",
                    "data": {
                        "message": "Fetch GET /api/v1/staff/orders",
                        "since": last_timestamp,
                    }
                }))

    except WebSocketDisconnect:
        manager.disconnect(websocket, restaurant_id, role)
        print(f"[WS] Client disconnected: {role} @ {restaurant_id}")