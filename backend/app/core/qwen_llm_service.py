"""
Qwen3 32B LLM Service - Enhanced Performance Option
Upgrade from Gemma 3n when higher intelligence is needed
Cost: ~$0.10/M input, $0.30/M output (~RM50-80 total)
"""
import os
import logging
import json
from typing import Dict, Any, Optional
from openai import AsyncOpenAI  # For OpenRouter integration

class Qwen32BLLMService:
    def __init__(self):
        self.api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("GROQ_API_KEY")
        self.provider = os.getenv("LLM_PROVIDER", "openrouter")  # openrouter or groq
        self.client = None
        self.model_name = "qwen/qwen-2.5-72b-instruct"  # Qwen3 32B equivalent
        
        if not self.api_key or self.api_key.startswith("placeholder_"):
            logging.warning("Qwen3 32B API key not set - falling back to mock mode")
            self.mock_mode = True
        else:
            try:
                if self.provider == "openrouter":
                    # OpenRouter integration
                    self.client = AsyncOpenAI(
                        base_url="https://openrouter.ai/api/v1",
                        api_key=self.api_key
                    )
                    self.model_name = "qwen/qwen-2.5-72b-instruct"
                    logging.info("✅ Qwen3 32B via OpenRouter initialized")
                elif self.provider == "groq":
                    # Groq integration for faster inference
                    self.client = AsyncOpenAI(
                        base_url="https://api.groq.com/openai/v1",
                        api_key=self.api_key
                    )
                    self.model_name = "llama-3.1-70b-versatile"  # Alternative on Groq
                    logging.info("✅ Qwen3 32B alternative via Groq initialized")
                
                self.mock_mode = False
            except Exception as e:
                logging.error(f"Failed to initialize Qwen3 32B: {e}")
                self.mock_mode = True
        
        self.enhanced_system_prompt = """You are Minus, an advanced voice-controlled AI assistant for professional accessibility, powered by Qwen3 32B for enhanced reasoning and understanding.

ENHANCED CAPABILITIES:
- Gmail: Advanced email management (read, compose, search, organize, filters, templates)
- Calendar: Intelligent scheduling (events, meetings, availability, conflicts, reminders)
- Google Docs: Document operations (create, edit, format, collaborate)
- Telegram: Message management (send, read, groups, channels, forwards)

ADVANCED FEATURES:
- Context awareness across commands
- Intelligent parameter extraction from natural language
- Multi-step task reasoning
- Professional communication optimization
- Accessibility-focused responses

RESPONSE FORMAT:
Always respond with valid JSON containing:
{
    "platform": "gmail|calendar|docs|telegram|general",
    "action": "specific_action_name", 
    "params": {
        "key": "extracted_value",
        "confidence": 0.95,
        "context": "additional_context"
    },
    "reasoning": "Brief explanation of command interpretation",
    "suggestions": ["alternative_interpretation_1", "alternative_interpretation_2"]
}

ENHANCED EXAMPLES:

User: "Read my urgent emails from last week about the Johnson project"
Assistant: {
    "platform": "gmail",
    "action": "advanced_search",
    "params": {
        "query": "from:johnson OR subject:johnson project",
        "time_range": "last_week",
        "priority": "urgent",
        "confidence": 0.92
    },
    "reasoning": "User wants specific emails filtered by sender/subject, timeframe, and priority",
    "suggestions": ["search_by_sender", "search_by_project"]
}

User: "Schedule a team meeting next Tuesday at 2 PM, check if everyone is free"
Assistant: {
    "platform": "calendar", 
    "action": "intelligent_schedule",
    "params": {
        "title": "Team Meeting",
        "date": "next_tuesday",
        "time": "2:00 PM",
        "check_availability": true,
        "attendees": ["team"],
        "confidence": 0.98
    },
    "reasoning": "Multi-step task: create event + check team availability",
    "suggestions": ["schedule_without_check", "find_alternative_time"]
}

Be precise, context-aware, and always provide reasoning for accessibility users."""

    async def process_command(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Enhanced command processing with Qwen3 32B reasoning"""
        try:
            if self.mock_mode:
                return self._enhanced_mock_parsing(user_input)
            
            # Enhanced prompt with context
            messages = [
                {"role": "system", "content": self.enhanced_system_prompt},
                {"role": "user", "content": f"Context: {context}\n\nCommand: {user_input}"}
            ]
            
            # Get response from Qwen3 32B
            response = await self.client.chat.completions.create(
                model=self.model_name,
                messages=messages,
                temperature=0.3,  # Lower temperature for more consistent JSON
                max_tokens=800,
                response_format={"type": "json_object"}  # Ensure JSON response
            )
            
            # Parse enhanced JSON response
            try:
                command_data = json.loads(response.choices[0].message.content)
                
                # Validate required fields
                if not all(key in command_data for key in ["platform", "action", "params"]):
                    raise ValueError("Missing required fields in LLM response")
                
                logging.info(f"Qwen3 32B parsed: {command_data['platform']}.{command_data['action']} (confidence: {command_data.get('params', {}).get('confidence', 'N/A')})")
                return command_data
                
            except json.JSONDecodeError as e:
                logging.error(f"Qwen3 32B JSON parse error: {e}")
                return self._fallback_response(user_input, "JSON parsing failed")
                
        except Exception as e:
            logging.error(f"Qwen3 32B processing error: {e}")
            return self._fallback_response(user_input, str(e))

    def _enhanced_mock_parsing(self, user_input: str) -> Dict[str, Any]:
        """Enhanced mock parsing with Qwen3 32B-style responses"""
        user_lower = user_input.lower()
        
        # Gmail enhanced parsing
        if any(word in user_lower for word in ["email", "gmail", "mail"]):
            if "urgent" in user_lower or "important" in user_lower:
                return {
                    "platform": "gmail",
                    "action": "read_priority",
                    "params": {
                        "priority": "high",
                        "confidence": 0.95
                    },
                    "reasoning": "User wants specific emails filtered by priority",
                    "suggestions": ["read_all", "read_unread"]
                }
            elif "compose" in user_lower or "send" in user_lower:
                # Enhanced recipient extraction
                recipient = "example@email.com"
                if "to " in user_lower:
                    words = user_input.split()
                    try:
                        to_index = words.index("to")
                        if to_index + 1 < len(words):
                            recipient = words[to_index + 1]
                    except ValueError:
                        pass
                
                return {
                    "platform": "gmail",
                    "action": "compose_enhanced",
                    "params": {
                        "to": recipient,
                        "subject": "Enhanced Email",
                        "confidence": 0.88
                    },
                    "reasoning": "User wants to compose email with recipient extraction",
                    "suggestions": ["compose_template", "quick_reply"]
                }
            else:
                return {
                    "platform": "gmail",
                    "action": "read_unread",
                    "params": {"confidence": 0.92},
                    "reasoning": "Default gmail action - read unread emails",
                    "suggestions": ["read_all", "search_specific"]
                }
        
        # Calendar enhanced parsing
        elif any(word in user_lower for word in ["calendar", "schedule", "meeting"]):
            if "check" in user_lower and "free" in user_lower:
                return {
                    "platform": "calendar",
                    "action": "check_availability",
                    "params": {
                        "time_range": "requested",
                        "confidence": 0.94
                    },
                    "reasoning": "User checking availability for scheduling",
                    "suggestions": ["suggest_times", "check_conflicts"]
                }
            elif "create" in user_lower or "schedule" in user_lower:
                return {
                    "platform": "calendar", 
                    "action": "create_intelligent",
                    "params": {
                        "title": "New Meeting",
                        "smart_scheduling": True,
                        "confidence": 0.90
                    },
                    "reasoning": "User wants to schedule with intelligent features",
                    "suggestions": ["create_simple", "create_recurring"]
                }
            else:
                return {
                    "platform": "calendar",
                    "action": "check_today",
                    "params": {"confidence": 0.96},
                    "reasoning": "Default calendar action - check today's schedule",
                    "suggestions": ["check_week", "check_upcoming"]
                }
        
        # General fallback
        else:
            return {
                "platform": "general",
                "action": "clarify",
                "params": {
                    "original_input": user_input,
                    "confidence": 0.60
                },
                "reasoning": "Command unclear, requesting clarification",
                "suggestions": ["gmail_action", "calendar_action", "docs_action"]
            }

    def _fallback_response(self, user_input: str, error: str) -> Dict[str, Any]:
        """Enhanced fallback response"""
        return {
            "platform": "error",
            "action": "processing_failed",
            "params": {
                "error_message": f"Enhanced LLM processing failed: {error}",
                "original_input": user_input,
                "confidence": 0.0
            },
            "reasoning": "LLM processing encountered an error",
            "suggestions": ["try_simpler_command", "rephrase_request"]
        }

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get enhanced LLM usage statistics"""
        if self.mock_mode:
            return {
                "model": "qwen3_32b_mock",
                "provider": "mock",
                "tier": "TESTING", 
                "status": "No API key configured - using enhanced mock responses",
                "features": ["enhanced_reasoning", "context_awareness", "multi_step_tasks"]
            }
        
        return {
            "model": self.model_name,
            "provider": self.provider,
            "tier": "PREMIUM",
            "cost_estimate": "$0.10/M input, $0.30/M output",
            "features": ["enhanced_reasoning", "context_awareness", "multi_step_tasks", "json_mode"],
            "status": "Active - Enhanced AI capabilities available"
        }

    def get_cost_estimate(self, input_tokens: int, output_tokens: int) -> Dict[str, Any]:
        """Calculate cost estimate for Qwen3 32B usage"""
        if self.mock_mode:
            return {"cost": 0.0, "currency": "USD", "note": "Mock mode - no actual costs"}
        
        input_cost = (input_tokens / 1_000_000) * 0.10  # $0.10 per M tokens
        output_cost = (output_tokens / 1_000_000) * 0.30  # $0.30 per M tokens
        total_cost = input_cost + output_cost
        
        return {
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "input_cost_usd": round(input_cost, 4),
            "output_cost_usd": round(output_cost, 4),
            "total_cost_usd": round(total_cost, 4),
            "estimated_rm": round(total_cost * 4.5, 2),  # Rough USD to RM conversion
            "provider": self.provider
        } 