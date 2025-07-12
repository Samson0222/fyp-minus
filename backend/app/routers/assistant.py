from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any

# Import the service and models
from app.services.ai_orchestrator_service import AIOrchestratorService, get_orchestrator_service, Message, ChatRequest
from app.models.user_context import UserContext

# Import the tools to create a registry
from app.tools.calendar_tools import get_calendar_events, create_calendar_event_draft

router = APIRouter()

# --- Tool Registry ---
# A simple dictionary to map tool names to their invokable function objects.
# This allows the /execute_tool endpoint to dynamically call the correct tool.
tool_registry = {
    "get_calendar_events": get_calendar_events,
    "create_calendar_event_draft": create_calendar_event_draft,
}

# --- Pydantic Models for Tool Execution ---
class ExecuteToolRequest(BaseModel):
    tool_name: str = Field(..., description="The name of the tool to execute.")
    tool_input: Dict[str, Any] = Field(..., description="The dictionary of arguments for the tool.")
    user_context: UserContext = Field(..., description="The user context, including credentials.")


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

@router.post("/execute_tool", summary="Execute an approved tool")
async def execute_tool_endpoint(request: ExecuteToolRequest):
    """
    Executes a tool that was previously drafted by the assistant and approved
    by the user on the frontend.
    """
    tool_to_execute = tool_registry.get(request.tool_name)
    
    if not tool_to_execute:
        raise HTTPException(status_code=404, detail=f"Tool '{request.tool_name}' not found.")

    try:
        # The tool function expects all arguments, including the user_context,
        # to be in a single dictionary. We merge them here.
        tool_kwargs = {**request.tool_input, "user_context": request.user_context}
        
        result = await tool_to_execute.ainvoke(tool_kwargs)
        
        return result
    except Exception as e:
        # This will catch errors from the tool's execution itself.
        raise HTTPException(status_code=500, detail=f"Error executing tool '{request.tool_name}': {e}") 