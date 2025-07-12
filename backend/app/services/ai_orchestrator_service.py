import os
import logging
from typing import Dict, Any, List
from datetime import datetime

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
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are Minus, a powerful AI assistant. Your primary goal is to help users manage their schedule and communications.

The current date is: {current_date}

IMPORTANT INSTRUCTION: The user may use words like "task", "to-do", or "reminder". You must interpret all of these as a request to create a calendar event. Use the 'create_calendar_event_draft' tool for this purpose. Do not tell the user you are creating an event instead of a task; simply ask for the details needed to schedule it.

Example:
User: "Remind me to call the pharmacy tomorrow."
You: "Okay, what time tomorrow should I schedule the call to the pharmacy?"

Always use your tools to help the user. If you create a draft for something, always ask the user for confirmation before proceeding."""),
                ("placeholder", "{chat_history}"),
                ("human", "{input}"),
                ("placeholder", "{agent_scratchpad}"),
            ])
            agent = create_tool_calling_agent(self.llm, tools, prompt)
            self.agent = agent # Store the agent
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
        if self.mock_mode or not self.agent:
            return {
                "type": "text",
                "response": f"Orchestrator is in mock mode. Received: '{request.input}'"
            }
        
        chat_history = self._prepare_chat_history(request.chat_history)
        current_date_str = datetime.now().strftime("%Y-%m-%d")
        
        try:
            # Invoke the agent to get the next action or response, but don't execute tools yet.
            agent_response = await self.agent.ainvoke({
                "input": request.input,
                "chat_history": chat_history,
                "intermediate_steps": [], # This is required by the agent's prompt
                "current_date": current_date_str # Pass the current date to the prompt
            })

            # The agent returns AgentFinish when it has a final answer,
            # or AgentAction when it needs to use a tool.
            if isinstance(agent_response, AgentFinish):
                # The agent is done, return the final response.
                return {
                    "type": "text",
                    "response": agent_response.return_values.get("output", "I'm not sure how to respond.")
                }

            # If it's not AgentFinish, it should be an AgentAction (or a list of them).
            # For our draft workflow, we only handle the first action.
            actions = agent_response if isinstance(agent_response, list) else [agent_response]
            
            if actions and isinstance(actions[0], AgentAction):
                tool_call = actions[0]
                return {
                    "type": "tool_draft",
                    "tool_name": tool_call.tool,
                    "tool_input": tool_call.tool_input,
                    "assistant_message": "I can help with that. Here is the action I can take. Shall I proceed?"
                }

            # Fallback for any other unexpected response type from the agent.
            logging.error(f"Unexpected agent response type: {type(agent_response)}")
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