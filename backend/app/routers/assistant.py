from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import List, Dict, Any

# Import the service and models
from app.services.ai_orchestrator_service import AIOrchestratorService, get_orchestrator_service, Message, ChatRequest
from app.models.user_context import UserContext
from app.dependencies import get_current_user

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
    # The user_context will now be injected by the dependency, not sent from the frontend.
    # user_context: UserContext = Field(..., description="The user context, including credentials.")


@router.post("/chat")
async def chat_with_assistant(
    request: ChatRequest,
    user: UserContext = Depends(get_current_user),
    orchestrator: AIOrchestratorService = Depends(get_orchestrator_service)
):
    # Overwrite any context from the request with the trusted, server-side context.
    request.user_context = user
    print("[DEBUG] /chat endpoint using server-injected user_context:", request.user_context)
    """
    The main endpoint for the AI assistant. It takes a user message,
    conversation history, and UI context, and returns a structured response.
    """
    response = await orchestrator.process_message(request)
    return response

@router.post("/execute_tool", summary="Execute an approved tool")
async def execute_tool_endpoint(
    request: ExecuteToolRequest,
    user: UserContext = Depends(get_current_user)
):
    print("[DEBUG] /execute_tool endpoint using server-injected user_context:", user)
    """
    Executes a tool that was previously drafted by the assistant and approved
    by the user on the frontend.
    """
    tool_to_execute = tool_registry.get(request.tool_name)
    
    if not tool_to_execute:
        raise HTTPException(status_code=404, detail=f"Tool '{request.tool_name}' not found.")

    try:
        # For async tools defined with @tool, the callable is stored in the .coroutine attribute.
        # The .func attribute will be None if only an async version is provided.
        original_func = tool_to_execute.coroutine
        
        if not original_func:
            # If .coroutine is somehow not present, raise a clear error.
            raise ValueError(f"Could not find an async function to call for tool '{request.tool_name}'.")

        # The tool function's arguments are in tool_input. We pass our server-side
        # user_context as a keyword argument.
        tool_kwargs = {**request.tool_input, "user_context": user}
        
        # Call the original async function directly.
        result = await original_func(**tool_kwargs)
        
        return result
    except Exception as e:
        # This will catch errors from the tool's execution itself.
        raise HTTPException(status_code=500, detail=f"Error executing tool '{request.tool_name}': {e}") 