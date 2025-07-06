import logging
from typing import List, Dict, Optional
from fastapi import WebSocket

logger = logging.getLogger(__name__)

class ConnectionManager:
    """Manages active WebSocket connections."""
    def __init__(self):
        # A dictionary to hold active connections, mapping a user_id to their WebSocket object.
        self.active_connections: Dict[str, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[user_id] = websocket
        logger.info(f"New WebSocket connection for user {user_id}. Total connections: {len(self.active_connections)}")

    def disconnect(self, user_id: str):
        """Disconnect a WebSocket."""
        if user_id in self.active_connections:
            del self.active_connections[user_id]
            logger.info(f"WebSocket disconnected for user {user_id}. Total connections: {len(self.active_connections)}")

    async def send_personal_message(self, message: str, user_id: str):
        """Send a message to a specific user."""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_text(message)
            logger.info(f"Sent message to user {user_id}: {message}")

    async def broadcast(self, message: str):
        """Send a message to all connected clients."""
        for user_id, websocket in self.active_connections.items():
            await websocket.send_text(message)
        logger.info(f"Broadcasted message to all {len(self.active_connections)} users: {message}")

    async def send_json(self, data: dict, user_id: str):
        """Send a JSON payload to a specific user."""
        if user_id in self.active_connections:
            websocket = self.active_connections[user_id]
            await websocket.send_json(data)
            logger.info(f"Sent JSON to user {user_id}: {data}")

# Create a single global instance of the ConnectionManager
manager = ConnectionManager() 