import os
import logging
import json
import re
from typing import Dict, Any, Optional

from openai import AsyncOpenAI
from langchain_openai import ChatOpenAI
from langchain.schema import HumanMessage, SystemMessage

from .llm_base import AbstractLLMService


class LMStudioLLMService(AbstractLLMService):
    """LLM service for OpenAI-compatible APIs like LM Studio."""

    def __init__(self, base_url: str, model: Optional[str] = None):
        self.api_base = base_url
        # The model name can be passed in or loaded from env vars.
        self.model_name = model or os.getenv("LM_STUDIO_MODEL_NAME")
        self.llm = None
        
        if not self.api_base or not self.model_name:
            logging.warning("LM Studio API base or model name not set - service disabled.")
            self.mock_mode = True
        else:
            try:
                # Use LangChain's ChatOpenAI for compatibility
                self.llm = ChatOpenAI(
                    model=self.model_name,
                    temperature=0.7,
                    openai_api_base=self.api_base,
                    openai_api_key="not-needed",  # API key is not required for local server
                )
                self.mock_mode = False
                logging.info(
                    f"✅ LM Studio LLM initialized: model={self.model_name}"
                )
            except Exception as e:
                logging.error(f"Failed to initialize LM Studio LLM: {e}")
                self.mock_mode = True

        # Re-use the same system prompt
        self.system_prompt = """You are Minus, a voice-controlled AI assistant for professional accessibility.
        
                                CAPABILITIES:
                                - Gmail: read emails, compose messages, search
                                - Calendar: check schedule, create events, set reminders  
                                - Google Docs: create/edit documents
                                - Telegram: send messages, read chats

                                RESPONSE FORMAT:
                                1. Determine the platform (gmail/calendar/docs/telegram)
                                2. Extract the action and parameters
                                3. Respond with JSON: {"platform": "gmail", "action": "read_unread", "params": {...}}

                                EXAMPLES:
                                User: "Read my unread emails"
                                Assistant: {"platform": "gmail", "action": "read_unread", "params": {}}

                                User: "What's my schedule today?"
                                Assistant: {"platform": "calendar", "action": "check_today", "params": {}}

                                User: "Compose email to john about meeting"
                                Assistant: {"platform": "gmail", "action": "compose", "params": {"to": "john", "subject": "meeting"}}

                                IMPORTANT: Return ONLY the JSON object without any markdown formatting, code blocks, or additional text."""

    async def process_command(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process user command via LM Studio and return structured response."""
        if self.mock_mode:
            return {"error": "LM Studio service is not configured."}
        
        messages = [
            SystemMessage(content=self.system_prompt),
            HumanMessage(content=user_input)
        ]
        
        try:
            response = await self.llm.ainvoke(messages)
            content = response.content

            # Attempt to parse JSON from the response
            try:
                # Handle potential markdown code blocks
                json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(1))
                
                # Handle raw JSON
                return json.loads(content)
            except json.JSONDecodeError:
                logging.error(f"Failed to decode JSON from LM Studio response: {content}")
                return {"error": "Invalid JSON response from LLM."}
        except Exception as e:
            logging.error(f"LM Studio processing error: {e}")
            return {"error": f"Command processing failed: {str(e)}"}

    def get_usage_stats(self) -> Dict[str, Any]:
        """Return status for the LM Studio service."""
        if self.mock_mode:
            return {
                "model": "lm-studio (disabled)",
                "status": "Not configured. Set LM_STUDIO_API_BASE and LM_STUDIO_MODEL_NAME."
            }
        
        return {
            "model": self.model_name,
            "api_base": self.api_base,
            "status": "Active - Using local LM Studio server"
        } 
 
 