from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List, Dict, Any

# Import the service
from app.services.ai_orchestrator_service import AIOrchestratorService, get_orchestrator_service, Message, ChatRequest

router = APIRouter()

@router.post("/chat")
async def chat_with_assistant(
    request: ChatRequest,
    orchestrator: AIOrchestratorService = Depends(get_orchestrator_service)
):
    """
    The main endpoint for the AI assistant. It takes a user message,
    conversation history, and UI context, and returns a structured response.
    """
    response = await orchestrator.process_message(request)
    return response 