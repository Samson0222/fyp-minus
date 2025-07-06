"""
Enhanced Voice API with Dual Input Support
Handles both voice and text commands with state management
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Depends
from pydantic import BaseModel
from typing import Dict, List, Optional
import logging
import json
import asyncio
import time

# Import voice assistant and LLM service
from voice_server import get_voice_assistant
from app.core.enhanced_llm_service import EnhancedLLMService

# This is the dependency provider. It will be initialized by main.py
def get_llm_service() -> EnhancedLLMService:
    # This will be replaced by the actual dependency injection in main.py
    # For now, it allows the router to load without circular imports.
    # The real instance will be provided by the FastAPI app.
    raise NotImplementedError("This should be overridden by the application startup.")

router = APIRouter()

class TextCommand(BaseModel):
    text: str
    
class VoiceState(BaseModel):
    state: str
    listening: bool
    timestamp: float

class DualInputResponse(BaseModel):
    success: bool
    response: str
    state: str
    input_method: str  # "voice" or "text"
    usage_stats: dict

# WebSocket connection manager for real-time state updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast_state(self, state_data: dict):
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(state_data))
            except Exception as e:
                logging.error(f"WebSocket broadcast error: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

@router.post("/text-command", response_model=DualInputResponse)
async def process_text_command(
    command: TextCommand,
    llm_service: EnhancedLLMService = Depends(get_llm_service)
):
    """Process text command (bypasses voice pipeline)"""
    try:
        voice_assistant = get_voice_assistant()
        
        # Process text directly
        response = await voice_assistant.handle_text_input(command.text)
        
        # Get LLM usage stats
        try:
            stats = llm_service.get_usage_stats()
        except Exception as e:
            logging.warning(f"Failed to get LLM stats: {e}")
            stats = {"status": "unavailable"}
        
        return DualInputResponse(
            success=True,
            response=response,
            state="idle",
            input_method="text",
            usage_stats=stats
        )
        
    except Exception as e:
        logging.error(f"Text command processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/activate-voice")
async def activate_voice_mode():
    """Manually activate voice mode (alternative to wake word)"""
    try:
        voice_assistant = get_voice_assistant()
        await voice_assistant.activate_voice_mode()
        
        # Broadcast state change to WebSocket clients
        state_data = {
            "state": "listening",
            "listening": True,
            "timestamp": time.time()
        }
        await manager.broadcast_state(state_data)
        
        return {"success": True, "message": "Voice mode activated"}
    except Exception as e:
        logging.error(f"Voice activation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deactivate-voice")
async def deactivate_voice_mode():
    """Manually deactivate voice mode"""
    try:
        voice_assistant = get_voice_assistant()
        await voice_assistant.deactivate_voice_mode()
        
        # Broadcast state change to WebSocket clients
        state_data = {
            "state": "idle",
            "listening": False,
            "timestamp": time.time()
        }
        await manager.broadcast_state(state_data)
        
        return {"success": True, "message": "Voice mode deactivated"}
    except Exception as e:
        logging.error(f"Voice deactivation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state")
async def get_current_state():
    """Get current voice assistant state"""
    try:
        voice_assistant = get_voice_assistant()
        return {
            "state": voice_assistant.state.value,
            "listening": voice_assistant.state.value == "listening",
            "wake_words": voice_assistant.wake_words,
            "stop_words": voice_assistant.stop_words
        }
    except Exception as e:
        logging.error(f"State retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/state-updates")
async def websocket_state_updates(websocket: WebSocket):
    """WebSocket endpoint for real-time state updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and wait for messages
            data = await websocket.receive_text()
            # Echo back or handle any incoming messages if needed
            await websocket.send_text(f"Echo: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logging.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)

@router.get("/health")
async def voice_health_check(llm_service: EnhancedLLMService = Depends(get_llm_service)):
    """Health check for voice services"""
    try:
        # Test LLM service
        stats = llm_service.get_usage_stats()
        
        # Test voice assistant
        voice_assistant = get_voice_assistant()
        voice_status = voice_assistant.state.value
        
        return {
            "status": "healthy",
            "llm_service": stats.get("model", "unknown"),
            "voice_state": voice_status,
            "stats": stats
        }
    except Exception as e:
        logging.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }

@router.post("/test-llm")
async def test_llm_integration(llm_service: EnhancedLLMService = Depends(get_llm_service)):
    """Test endpoint for LLM integration"""
    try:
        test_command = "Read my unread emails"
        result = await llm_service.process_command(test_command)
        
        return {
            "test_command": test_command,
            "llm_response": result,
            "status": "success"
        }
    except Exception as e:
        logging.error(f"LLM test failed: {e}")
        return {
            "status": "failed",
            "error": str(e)
        } 