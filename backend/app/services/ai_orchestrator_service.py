import os
import logging
from typing import Dict, Any, List

import google.generativeai as genai
from google.oauth2 import service_account

# LangChain Imports
from langchain.agents import AgentExecutor, create_tool_calling_agent
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, AIMessage, SystemMessage
from pydantic import BaseModel

# Internal Tool Imports
from app.tools.calendar_tools import get_calendar_events, create_calendar_event_draft

# --- Pydantic Models ---
class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    conversation_history: List[Message] = []
    ui_context: Dict[str, Any] = {}

# --- Service Class ---
class AIOrchestratorService:
    def __init__(self, credentials_path: str, model: str = "gemini-1.5-flash"):
        self.model_name = model
        self.llm = None
        self.agent_executor = None
        self.mock_mode = True

        if not os.path.exists(credentials_path):
            logging.warning(f"Gemini credentials not found at {credentials_path}. Orchestrator running in mock mode.")
            return

        try:
            # --- LLM Initialization ---
            credentials = service_account.Credentials.from_service_account_file(
                credentials_path,
                scopes=['https://www.googleapis.com/auth/generative-language.retriever']
            )
            genai.configure(credentials=credentials)
            self.llm = ChatGoogleGenerativeAI(model=self.model_name, temperature=0.7, convert_system_message_to_human=True)

            # --- Agent Initialization ---
            tools = [get_calendar_events, create_calendar_event_draft]
            prompt = ChatPromptTemplate.from_messages([
                ("system", """You are Minus, a powerful AI assistant. Your primary goal is to help users manage their schedule and communications.

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
            elif msg.role.lower() == 'assistant':
                history.append(AIMessage(content=msg.content))
        return history

    async def process_message(self, request: ChatRequest) -> Dict[str, Any]:
        if self.mock_mode or not self.agent_executor:
            return {
                "type": "text",
                "response": f"Orchestrator is in mock mode. Received: '{request.message}'"
            }
        
        chat_history = self._prepare_chat_history(request.conversation_history)
        
        try:
            # The agent executor handles the full conversational loop
            result = await self.agent_executor.ainvoke({
                "input": request.message,
                "chat_history": chat_history
            })

            # The 'output' from the agent executor is the final response to the user.
            # In the future, we can inspect `result['intermediate_steps']` to handle
            # the "Draft, Review, Approve" pattern more explicitly.
            return {
                "type": "text",
                "response": result.get("output", "I'm sorry, I couldn't generate a response.")
            }
        except Exception as e:
            logging.error(f"Error invoking agent executor: {e}", exc_info=True)
            return {
                "type": "error",
                "response": "Sorry, I encountered an error while processing your request."
            }

# --- Singleton Instantiation ---
CREDENTIALS_FILE = "credentials/gemini_credentials.json"
ai_orchestrator = AIOrchestratorService(credentials_path=CREDENTIALS_FILE)

def get_orchestrator_service():
    return ai_orchestrator 