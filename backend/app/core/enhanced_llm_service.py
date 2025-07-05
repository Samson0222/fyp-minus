"""
Enhanced LLM Service with Multiple Model Support
Supports both Gemma (via Service Account) and Qwen3 32B (Premium) 
"""
import os
import logging
import json
from typing import Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from google.oauth2 import service_account
import google.generativeai as genai

class EnhancedLLMService:
    def __init__(self):
        # Model selection based on environment
        self.model_type = os.getenv("LLM_MODEL", "gemma").lower()  # gemma or qwen
        self.credentials_path = os.getenv("GEMINI_CREDENTIALS_PATH", "credentials/gemini_credentials.json")
        self.api_key = None
        self.llm = None
        self.genai_model = None
        self.mock_mode = True
        
        if self.model_type == "gemma":
            self._init_gemma()
        elif self.model_type == "qwen":
            self._init_qwen()
        else:
            logging.error(f"Unknown model type: {self.model_type}")
            self._init_gemma()  # Fallback to Gemma
        
        self.enhanced_system_prompt = self._get_enhanced_prompt()

    def _init_gemma(self):
        """Initialize Gemma with service account"""
        if not os.path.exists(self.credentials_path):
            logging.warning(f"Credentials file not found at {self.credentials_path} - using Gemma mock mode")
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
                self.genai_model = genai.GenerativeModel('gemini-1.5-flash')
                
                # Initialize LangChain integration
                self.llm = ChatGoogleGenerativeAI(
                    model="gemini-1.5-flash",
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
                logging.error(f"Failed to initialize Gemma with service account: {e}")
                self.mock_mode = True

    def _init_qwen(self):
        """Initialize Qwen3 32B (Premium)"""
        self.api_key = os.getenv("OPENROUTER_API_KEY")
        
        if not self.api_key or self.api_key.startswith("placeholder_"):
            logging.warning("OPENROUTER_API_KEY not set - using Qwen mock mode")
            self.mock_mode = True
        else:
            try:
                # TODO: Implement OpenRouter integration for Qwen3 32B
                # For now, use mock mode
                logging.info("⚠️ Qwen3 32B mock mode (implementation needed)")
                self.mock_mode = True
            except Exception as e:
                logging.error(f"Failed to initialize Qwen: {e}")
                self.mock_mode = True

    def _get_enhanced_prompt(self) -> str:
        """Get enhanced system prompt based on model type"""
        base_prompt = """You are Minus, a voice-controlled AI assistant for professional accessibility.

CAPABILITIES:
- Gmail: read emails, compose messages, search, organize
- Calendar: check schedule, create events, set reminders, check availability
- Google Docs: create/edit documents, format text
- Telegram: send messages, read chats, manage groups

RESPONSE FORMAT:
Always respond with valid JSON:
{
    "platform": "gmail|calendar|docs|telegram|general",
    "action": "specific_action_name",
    "params": {...},
    "confidence": 0.95"""
        
        if self.model_type == "qwen":
            base_prompt += """,
    "reasoning": "Brief explanation of interpretation",
    "suggestions": ["alternative_1", "alternative_2"]"""
        
        base_prompt += """
}

EXAMPLES:
User: "Read my unread emails"
Assistant: {"platform": "gmail", "action": "read_unread", "params": {}}

User: "What's my schedule today?"
Assistant: {"platform": "calendar", "action": "check_today", "params": {}}

User: "Compose email to john about meeting"
Assistant: {"platform": "gmail", "action": "compose", "params": {"to": "john", "subject": "meeting"}}

Be concise, accessible, and always respond in JSON format."""
        
        return base_prompt

    async def process_command(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process command with enhanced features based on model type"""
        try:
            if self.mock_mode:
                return self._enhanced_mock_parsing(user_input)
            
            if self.model_type == "gemma":
                return await self._process_with_gemma(user_input, context)
            elif self.model_type == "qwen":
                return await self._process_with_qwen(user_input, context)
                
        except Exception as e:
            logging.error(f"Enhanced LLM processing error: {e}")
            return {
                "platform": "error",
                "action": "error",
                "params": {"message": f"Processing failed: {str(e)}"}
            }

    async def _process_with_gemma(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process with Gemma"""
        from langchain.schema import HumanMessage, SystemMessage
        
        # Include context if provided
        content = user_input
        if context:
            content = f"Context: {json.dumps(context)}\n\nCommand: {user_input}"
        
        messages = [
            SystemMessage(content=self.enhanced_system_prompt),
            HumanMessage(content=content)
        ]
        
        response = await self.llm.ainvoke(messages)
        
        try:
            return json.loads(response.content)
        except json.JSONDecodeError:
            # Try direct model if LangChain fails
            try:
                direct_response = self.genai_model.generate_content(
                    f"System: {self.enhanced_system_prompt}\nUser: {content}"
                )
                # Extract JSON from response
                import re
                json_match = re.search(r'\{.*\}', direct_response.text, re.DOTALL)
                if json_match:
                    return json.loads(json_match.group(0))
            except:
                pass
                
            return {
                "platform": "general",
                "action": "respond", 
                "params": {"text": response.content}
            }

    async def _process_with_qwen(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process with Qwen3 32B (Enhanced)"""
        # TODO: Implement OpenRouter integration
        # For now, return enhanced mock
        return self._enhanced_mock_parsing(user_input, enhanced=True)

    def _enhanced_mock_parsing(self, user_input: str, enhanced: bool = False) -> Dict[str, Any]:
        """Enhanced mock parsing with optional advanced features"""
        user_lower = user_input.lower()
        
        # Base response structure
        response = {
            "platform": "general",
            "action": "respond",
            "params": {},
            "confidence": 0.85
        }
        
        # Add enhanced fields for Qwen mode
        if enhanced or self.model_type == "qwen":
            response["reasoning"] = "Mock reasoning"
            response["suggestions"] = []
        
        # Gmail commands
        if any(word in user_lower for word in ["email", "gmail", "mail"]):
            if "read" in user_lower or "unread" in user_lower:
                response.update({
                    "platform": "gmail",
                    "action": "read_unread",
                    "params": {},
                    "confidence": 0.95
                })
                if enhanced:
                    response["reasoning"] = "User wants to read unread emails"
                    response["suggestions"] = ["read_all", "read_priority"]
                    
            elif "compose" in user_lower or "send" in user_lower:
                # Enhanced recipient extraction
                recipient = "example@email.com"
                if "to" in user_input:
                    words = user_input.split()
                    try:
                        to_index = next(i for i, word in enumerate(words) if "to" in word.lower())
                        if to_index + 1 < len(words):
                            recipient = words[to_index + 1].replace(",", "")
                    except (StopIteration, IndexError):
                        pass
                
                response.update({
                    "platform": "gmail",
                    "action": "compose",
                    "params": {"to": recipient, "subject": ""},
                    "confidence": 0.88
                })
                if enhanced:
                    response["reasoning"] = f"User wants to compose email to {recipient}"
                    response["suggestions"] = ["compose_template", "quick_reply"]
                    
        # Calendar commands  
        elif any(word in user_lower for word in ["calendar", "schedule", "meeting"]):
            if "today" in user_lower or "schedule" in user_lower:
                response.update({
                    "platform": "calendar",
                    "action": "check_today",
                    "params": {},
                    "confidence": 0.96
                })
                if enhanced:
                    response["reasoning"] = "User wants to check today's schedule"
                    response["suggestions"] = ["check_week", "check_upcoming"]
                    
            elif "create" in user_lower or "add" in user_lower:
                response.update({
                    "platform": "calendar",
                    "action": "create_event", 
                    "params": {"title": "New Event"},
                    "confidence": 0.90
                })
                if enhanced:
                    response["reasoning"] = "User wants to create a new calendar event"
                    response["suggestions"] = ["create_meeting", "create_reminder"]
        
        # Enhanced general response
        if response["platform"] == "general":
            response["params"]["text"] = f"{'Enhanced ' if enhanced else ''}Mock response: I understood '{user_input}' but I'm in testing mode."
            if enhanced:
                response["reasoning"] = "Command not clearly categorized, providing general response"
                response["suggestions"] = ["gmail_command", "calendar_command", "clarify_request"]
        
        return response

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics for current model"""
        base_stats = {
            "model_type": self.model_type,
            "mock_mode": self.mock_mode
        }
        
        if self.mock_mode:
            base_stats.update({
                "model": f"{self.model_type}_mock",
                "tier": "TESTING",
                "status": f"No API key configured - using {self.model_type} mock responses"
            })
        else:
            if self.model_type == "gemma":
                base_stats.update({
                    "model": "gemini-1.5-flash",
                    "tier": "FREE", 
                    "provider": "Google AI",
                    "daily_limit": "14,400 requests",
                    "rate_limit": "30 RPM, 15,000 TPM"
                })
            elif self.model_type == "qwen":
                base_stats.update({
                    "model": "qwen-2.5-72b-instruct",
                    "tier": "PREMIUM",
                    "provider": "OpenRouter",
                    "cost": "$0.10/M input, $0.30/M output",
                    "features": ["enhanced_reasoning", "context_awareness"]
                })
        
        return base_stats

    def switch_model(self, new_model: str) -> bool:
        """Switch between models dynamically"""
        if new_model.lower() in ["gemma", "qwen"]:
            old_model = self.model_type
            self.model_type = new_model.lower()
            
            if self.model_type == "gemma":
                self._init_gemma()
            else:
                self._init_qwen()
                
            self.enhanced_system_prompt = self._get_enhanced_prompt()
            
            logging.info(f"Switched LLM model from {old_model} to {self.model_type}")
            return True
        else:
            logging.error(f"Unknown model: {new_model}")
            return False 