"""
Google LLM Service - Google AI API Integration
Handles command routing and response generation
"""
import os
import logging
import json
import re
from typing import Dict, Any, Optional
from google.oauth2 import service_account
import google.generativeai as genai
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage

from .llm_base import AbstractLLMService

class GoogleLLMService(AbstractLLMService):
    def __init__(self, credentials_path: str, model: str = "gemini-1.5-flash"):
        self.credentials_path = credentials_path
        self.model_name = model
        self.llm = None
        self.genai_model = None
        
        # Check if credentials file exists
        if not os.path.exists(self.credentials_path):
            logging.warning(f"Credentials file not found at {self.credentials_path} - using mock mode")
            self.mock_mode = True
        else:
            try:
                # Initialize with service account credentials
                credentials = service_account.Credentials.from_service_account_file(
                    self.credentials_path,
                    scopes=['https://www.googleapis.com/auth/generative-language.retriever']
                )
                
                # Configure genai with credentials
                genai.configure(credentials=credentials)
                
                # Create direct model for testing
                self.genai_model = genai.GenerativeModel(self.model_name)
                
                # Initialize LangChain integration
                self.llm = ChatGoogleGenerativeAI(
                    model=self.model_name,
                    credentials=credentials,
                    temperature=0.7,
                    max_output_tokens=500
                )
                
                self.mock_mode = False
                logging.info("✅ Gemini LLM initialized successfully with service account")
                
                # Test connection
                test_response = self.genai_model.generate_content("Respond with 'Connected' if you can read this.")
                if "Connected" in test_response.text:
                    logging.info("✅ Connection test successful")
                else:
                    logging.warning("⚠️ Connection test returned unexpected response")
                    
            except Exception as e:
                logging.error(f"Failed to initialize LLM with service account: {e}")
                self.mock_mode = True
        
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

    async def process_command(self, user_input: str) -> Dict[str, Any]:
        """Process user voice command and return structured response"""
        try:
            if self.mock_mode:
                # Mock response for testing without credentials
                return self._mock_command_parsing(user_input)
            
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=user_input)
            ]
            
            # Get response from Gemini
            response = await self.llm.ainvoke(messages)
            
            # Parse JSON response
            try:
                # First try direct parsing
                try:
                    return json.loads(response.content)
                except json.JSONDecodeError:
                    # If that fails, try to extract JSON from code blocks or text
                    content = response.content
                    
                    # Try to extract JSON from code blocks
                    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(1))
                    
                    # Try to extract any JSON object
                    json_match = re.search(r'(\{.*?\})', content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(1))
                    
                    # If all parsing fails, use direct model
                    direct_response = self.genai_model.generate_content(
                        f"System: {self.system_prompt}\nUser: {user_input}"
                    )
                    
                    # Try to extract JSON from direct response
                    content = direct_response.text
                    json_match = re.search(r'(\{.*?\})', content, re.DOTALL)
                    if json_match:
                        return json.loads(json_match.group(1))
                    
                    # Final fallback
                    raise ValueError("Could not extract valid JSON from any response")
            except Exception as e:
                logging.error(f"JSON parsing error: {e}")
                # Fallback if JSON parsing fails
                return {
                    "platform": "general",
                    "action": "respond",
                    "params": {"text": response.content}
                }
                
        except Exception as e:
            logging.error(f"LLM processing error: {e}")
            return {
                "platform": "error",
                "action": "error",
                "params": {"message": f"Sorry, I couldn't process that command: {str(e)}"}
            }

    async def generate_text(self, prompt: str) -> str:
        """Generate plain text response without JSON parsing - for summarization, etc."""
        try:
            if self.mock_mode:
                return f"Mock response: {prompt[:100]}..."
            
            # Use the direct genai model for plain text generation
            if self.genai_model:
                response = self.genai_model.generate_content(prompt)
                return response.text
            else:
                # Fallback to LangChain if direct model not available
                messages = [HumanMessage(content=prompt)]
                response = await self.llm.ainvoke(messages)
                return response.content
                
        except Exception as e:
            logging.error(f"Text generation error: {e}")
            return f"Error generating text: {str(e)}"

    def _mock_command_parsing(self, user_input: str) -> Dict[str, Any]:
        """Mock command parsing for testing without credentials"""
        user_lower = user_input.lower()
        
        if any(word in user_lower for word in ["email", "gmail", "mail"]):
            if "read" in user_lower or "unread" in user_lower:
                return {"platform": "gmail", "action": "read_unread", "params": {}}
            elif "compose" in user_lower or "send" in user_lower:
                return {"platform": "gmail", "action": "compose", "params": {"to": "test@example.com", "subject": "test"}}
            else:
                return {"platform": "gmail", "action": "read_unread", "params": {}}
        
        elif any(word in user_lower for word in ["calendar", "schedule", "meeting"]):
            if "today" in user_lower or "schedule" in user_lower:
                return {"platform": "calendar", "action": "check_today", "params": {}}
            elif "create" in user_lower or "add" in user_lower:
                return {"platform": "calendar", "action": "create_event", "params": {"title": "Test Meeting"}}
            else:
                return {"platform": "calendar", "action": "check_today", "params": {}}
        
        else:
            return {
                "platform": "general",
                "action": "respond",
                "params": {"text": f"Mock response: I understood '{user_input}' but I'm in testing mode."}
            }

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current API usage for monitoring"""
        try:
            if self.mock_mode:
                return {
                    "model": "mock_mode",
                    "tier": "TESTING",
                    "status": "No credentials configured - using mock responses"
                }
        
            return {
                "model": self.model_name,
                "tier": "STANDARD",
                "authentication": "Service Account",
                "status": "Active - Real AI responses enabled"
            }
        except Exception as e:
            logging.error(f"Error getting usage stats: {e}")
            return {"status": f"Error: {e}"}