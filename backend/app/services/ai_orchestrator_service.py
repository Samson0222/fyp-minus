import os
import logging
from typing import Dict, Any, List
from datetime import datetime
import pytz

import google.generativeai as genai
from google.oauth2 import service_account

# LangChain Imports
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from pydantic import BaseModel, Field
from langchain_core.agents import AgentAction, AgentFinish

# Internal Tool Imports
from app.tools.calendar_tools import get_calendar_events, create_calendar_event_draft
from app.models.user_context import UserContext

# --- Pydantic Models ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    input: str = Field(..., description="The user's input message.")
    chat_history: List[Message] = Field(default=[], description="The conversation history.")
    user_context: UserContext = Field(description="The user context, including credentials.")


# --- Service Class ---
class AIOrchestratorService:
    def __init__(self, model: str = "gemini-1.5-flash"):
        self.model_name = model
        self.llm = None
        self.agent_executor = None
        self.mock_mode = True

        api_key = os.environ.get("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            logging.warning("GOOGLE_GEMINI_API_KEY not found in environment. Orchestrator running in mock mode.")
            return

        try:
            # --- LLM Initialization ---
            self.llm = ChatGoogleGenerativeAI(
                model=self.model_name,
                google_api_key=api_key,
                temperature=0.7,
                convert_system_message_to_human=True
            )

            # --- Agent Initialization ---
            tools = [get_calendar_events, create_calendar_event_draft]
            
            # Get current time in Malaysia timezone
            malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
            current_time_my = datetime.now(malaysia_tz)
            
            prompt = ChatPromptTemplate.from_messages([
                ("system", f"""You are Minus, a powerful AI assistant. Your primary goal is to help users manage their schedule and communications efficiently.

The current date and time is: {current_time_my.strftime('%Y-%m-%d %H:%M:%S')} (Malaysia Time, GMT+8). Use this as the reference for any relative time queries.

When a user mentions creating a "task", "to-do", or "reminder", you must interpret it as a request to create a calendar event. Use the 'create_calendar_event_draft' tool. Do not simply state you are creating an event; instead, ask for the necessary details to schedule it. For example, if a user says, "Remind me to call the pharmacy," you should ask, "What time should I schedule that call for?"

Always use your tools to help the user. When drafting an event or response, always ask for the user's confirmation before finalizing it."""),
                ("placeholder", "{chat_history}"),
                ("human", "{input}"),
                ("placeholder", "{agent_scratchpad}"),
            ])
            agent = create_tool_calling_agent(self.llm, tools, prompt)
            self.agent = agent
            self.agent_executor = AgentExecutor(agent=agent, tools=tools, verbose=True)
            
            self.mock_mode = False
            logging.info("✅ AI Orchestrator Service initialized successfully with Gemini Agent.")
        except Exception as e:
            logging.error(f"Failed to initialize Gemini Agent for AI Orchestrator: {e}", exc_info=True)

    def _prepare_chat_history(self, conversation_history: List[Message]) -> List:
        history = []
        for msg in conversation_history:
            if msg.role.lower() == 'user':
                history.append(HumanMessage(content=msg.content))
            elif msg.role.lower() == 'assistant' or msg.role.lower() == 'model':
                history.append(AIMessage(content=msg.content))
        return history

    async def process_message(self, request: ChatRequest) -> Dict[str, Any]:
        """Processes the user's message, manages conversation history, and invokes the AI agent."""
        if self.mock_mode:
            return {"response": "Orchestrator is in mock mode.", "type": "text"}
        
        # Prepare the chat history
        chat_history = self._prepare_chat_history(request.chat_history)
        user_input = request.input
        user_context = request.user_context

        # Get current time in Malaysia timezone for the prompt on each request
        malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
        current_time_my = datetime.now(malaysia_tz)
        
        # Dynamically inject the current time into the prompt for each call
        try:
            response = await self.agent.ainvoke({
                "input": user_input,
                "chat_history": chat_history,
                "intermediate_steps": [], # This is required by the agent's prompt structure
                "user_context": user_context
            })

            # Handle the agent's response
            if isinstance(response, AgentFinish):
                # This is a final text response from the agent
                return {
                    "type": "text",
                    "response": response.return_values.get("output", "I'm not sure how to respond.")
                }

            # If it's not AgentFinish, it should be an AgentAction (or a list of them).
            # For our draft workflow, we only handle the first action.
            actions = response if isinstance(response, list) else [response]
            
            if actions and isinstance(actions[0], AgentAction):
                tool_call = actions[0]
                return {
                    "type": "tool_draft",
                    "tool_name": tool_call.tool,
                    "tool_input": tool_call.tool_input,
                    "assistant_message": "I can help with that. Here is the action I can take. Shall I proceed?"
                }

            # Fallback for any other unexpected response type from the agent.
            logging.error(f"Unexpected agent response type: {type(response)}")
            return {
                "type": "error",
                "response": "Sorry, I received an unexpected response from the AI."
            }
        except Exception as e:
            logging.error(f"Error invoking agent: {e}", exc_info=True)
            return {
                "type": "error",
                "response": "Sorry, I encountered an error while processing your request."
            }

# --- Singleton Instantiation ---
ai_orchestrator = AIOrchestratorService()

def get_orchestrator_service():
    return ai_orchestrator 