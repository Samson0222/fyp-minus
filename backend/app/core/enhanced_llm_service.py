"""
Enhanced LLM Service with Multiple Model Support
Acts as a factory and wrapper for various LLM providers.
"""
import os
import logging
from typing import Dict, Any, Optional

# Import all available LLM service classes
from app.core.llm_service import GemmaLLMService
from app.core.lm_studio_llm_service import LMStudioLLMService
from app.core.qwen_llm_service import Qwen32BLLMService

# A mapping from the provider name in .env to the corresponding service class.
PROVIDER_MAP = {
    "lm_studio": LMStudioLLMService,
    "gemma": GemmaLLMService,
    "qwen": Qwen32BLLMService,
}

class EnhancedLLMService:
    def __init__(self):
        # Use LLM_PROVIDER to select the service (e.g., "lm_studio")
        self.provider = os.getenv("LLM_PROVIDER", "lm_studio").lower()
        # Use LLM_MODEL for the specific model name (e.g., "deepseek-ai/deepseek-coder-6.7b-instruct")
        self.model_name = os.getenv("LLM_MODEL")
        
        self.service_instance = None
        
        logging.info(f"Attempting to initialize LLM with provider: '{self.provider}' and model: '{self.model_name}'")

        # Get the service class from our mapping.
        service_class = PROVIDER_MAP.get(self.provider)

        if service_class:
            try:
                # Pass the model name to the service's constructor.
                self.service_instance = service_class(model=self.model_name)
            except Exception as e:
                logging.error(f"Failed to initialize LLM provider '{self.provider}': {e}", exc_info=True)
                self.service_instance = None
        else:
            logging.warning(
                f"Unknown LLM_PROVIDER: '{self.provider}'. "
                f"Valid options are: {', '.join(PROVIDER_MAP.keys())}."
            )
            
        if self.service_instance and getattr(self.service_instance, 'mock_mode', True):
            logging.warning(f"LLM Service '{self.provider}' is running in MOCK MODE. Check your environment variables.")
        elif self.service_instance:
            logging.info(f"✅ LLM Service '{self.provider}' initialized successfully.")
        else:
            logging.error("❌ LLM Service could not be initialized.")

    async def process_command(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Process command by delegating to the active service instance."""
        if not self.service_instance:
            logging.error("No LLM service instance available.")
            return {"error": "LLM service not initialized."}
        
        # Delegate to the appropriate method, handling context for Qwen
        if self.provider == "qwen":
             return await self.service_instance.process_command(user_input, context)
        return await self.service_instance.process_command(user_input)

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get usage statistics from the active service instance."""
        if not self.service_instance:
            return {"error": "LLM service not initialized."}
        return self.service_instance.get_usage_stats()
 
 