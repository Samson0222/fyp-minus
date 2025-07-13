import os
import logging
from typing import Dict, Any, List
from datetime import datetime
import pytz
import functools

import google.generativeai as genai
from google.oauth2 import service_account

# LangChain Imports
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, AIMessage
from pydantic import BaseModel, Field
from langchain.tools import StructuredTool

# Internal Tool Imports
from app.tools.calendar_tools import get_calendar_events, create_calendar_event_draft, edit_calendar_event
from app.models.user_context import UserContext
from app.models.conversation_state import ConversationState

# --- Pydantic Models ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    input: str = Field(..., description="The user's input message.")
    chat_history: List[Message] = Field(default=[], description="The conversation history.")
    user_context: UserContext = Field(description="The user context, including credentials.")
    conversation_state: ConversationState = Field(default_factory=ConversationState, description="The state of the current conversation.")

# --- Service Class ---
class AIOrchestratorService:
    def __init__(self, model: str = "gemini-1.5-flash"):
        self.model_name = model
        self.llm = None
        self.base_tools = []
        self.prompt = None
        self.mock_mode = True

        api_key = os.environ.get("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            logging.warning("GOOGLE_GEMINI_API_KEY not found. Running in mock mode.")
            return

        try:
            self.llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                google_api_key=api_key,
                temperature=0.7,
                convert_system_message_to_human=True
            )
            
            self.base_tools = [get_calendar_events, create_calendar_event_draft, edit_calendar_event]
            
            # --- REFINED PROMPT: Stricter instructions to prevent lazy agent ---
            self.prompt = ChatPromptTemplate.from_messages([
                ("system", """You are Minus, a powerful and proactive AI assistant. Your primary goal is to help users by taking action.

- **Core Directive:** You MUST use a tool to fulfill any user request that involves creating, reading, or changing information. Do not just say you have done something; you must actually call the appropriate tool.
- **Context is Key:** If the user refers to "that event" or "it", use the `event_id` provided in the prompt. If no `event_id` is provided, you MUST use the `get_calendar_events` tool to find it before attempting to edit.
- **Tool Usage:**
  - To create an event: `Calendar_draft`
  - To view events: `get_calendar_events`
  - To change an event: `edit_calendar_event`
- Current date and time: {current_time}."""),
                ("placeholder", "{chat_history}"),
                ("human", "{input}"),
                ("placeholder", "{agent_scratchpad}"),
            ])
            
            self.mock_mode = False
            logging.info("✅ AI Orchestrator Service initialized successfully.")
        except Exception as e:
            logging.error(f"Failed to initialize Gemini Agent: {e}", exc_info=True)

    def _prepare_chat_history(self, conversation_history: List[Message]) -> List:
        history = []
        for msg in conversation_history:
            if msg.role.lower() == 'user':
                history.append(HumanMessage(content=msg.content))
            elif msg.role.lower() in ('assistant', 'model'):
                history.append(AIMessage(content=msg.content))
        return history
    
    # --- REFINED: State updater now handles edits correctly ---
    async def _update_state_from_tool_output(self, state: ConversationState, tool_output: List) -> ConversationState:
        """Inspects tool output and updates the conversation state."""
        if not tool_output:
            return state

        last_tool_call = tool_output[-1]
        tool_name = last_tool_call[0].tool
        observation = last_tool_call[1]

        event_id = None
        if tool_name == "create_calendar_event_draft" and observation.get("status") == "event_created":
            event_id = observation.get("details", {}).get("event_id")
        
        elif tool_name == "edit_calendar_event" and observation.get("status") == "event_updated":
            event_id = observation.get("details", {}).get("event_id")

        elif tool_name == "get_calendar_events" and isinstance(observation, list) and len(observation) == 1:
            event_id = observation[0].get("id")

        if event_id:
            print(f"State Updated: last_event_id set to '{event_id}' from tool '{tool_name}'")
            state.last_event_id = event_id
            
        return state

    def _prepare_input_with_state(self, user_input: str, state: ConversationState) -> str:
        """Injects context from the state into the user's input for the AI."""
        vague_phrases = ["that event", "this event", "change the time", "add a description", "delete it", "to it"]
        is_vague = any(phrase in user_input.lower() for phrase in vague_phrases)

        if is_vague and state.last_event_id:
            print(f"Injecting context: Found last_event_id '{state.last_event_id}'")
            return f"{user_input} (referring to event_id: {state.last_event_id})"
        
        return user_input

    async def process_message(self, request: ChatRequest) -> Dict[str, Any]:
        if self.mock_mode or not self.llm:
            return {"response": "Orchestrator is in mock mode.", "type": "text", "state": request.conversation_state.dict()}

        chat_history = self._prepare_chat_history(request.chat_history)
        user_context = request.user_context
        conversation_state = request.conversation_state

        user_input_with_context = self._prepare_input_with_state(request.input, conversation_state)
        
        print("\n--- New Request ---")
        print(f"Original User Input: {request.input}")
        print(f"Input with Context: {user_input_with_context}")
        print(f"Initial State: {conversation_state.dict()}")
        
        try:
            request_tools = []
            for tool_def in self.base_tools:
                tool_with_context = functools.partial(tool_def.coroutine, user_context=user_context)
                request_tools.append(StructuredTool.from_function(
                    coroutine=tool_with_context, name=tool_def.name,
                    description=tool_def.description, args_schema=tool_def.args_schema
                ))

            malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
            current_time_str = datetime.now(malaysia_tz).strftime('%Y-%m-%d %H:%M:%S')
            prompt_with_time = self.prompt.partial(current_time=f"{current_time_str} (Malaysia Time, GMT+8)")

            agent = create_tool_calling_agent(self.llm, request_tools, prompt_with_time)
            agent_executor = AgentExecutor(agent=agent, tools=request_tools, verbose=True, return_intermediate_steps=True)

            response = await agent_executor.ainvoke({
                "input": user_input_with_context,
                "chat_history": chat_history,
            })
            
            intermediate_steps = response.get("intermediate_steps", [])
            updated_state = await self._update_state_from_tool_output(conversation_state, intermediate_steps)
            print(f"Final State: {updated_state.dict()}")
            
            final_response = response.get("output", "I'm not sure how to respond.")
            
            print(f"Final AI Response: {final_response}")
            print("--- End Request ---\n")
            
            return {
                "type": "text",
                "response": final_response,
                "state": updated_state.dict()
            }

        except Exception as e:
            logging.error(f"Error invoking agent executor: {e}", exc_info=True)
            print(f"Error during agent execution: {e}")
            return {
                "type": "error",
                "response": "Sorry, I encountered an error.",
                "state": conversation_state.dict()
            }
# --- Singleton Instantiation ---
ai_orchestrator = AIOrchestratorService()

def get_orchestrator_service():
    return ai_orchestrator 