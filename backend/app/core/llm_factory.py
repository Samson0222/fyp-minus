# app/core/llm_factory.py
import os
import logging
from typing import Optional

# Import the contract and all concrete service classes
from .llm_base import AbstractLLMService
from .google_llm_service import GoogleLLMService
from .lm_studio_llm_service import LMStudioLLMService
from .openrouter_llm_service import OpenRouterLLMService

# A single function to create and return the correct LLM service instance
def get_llm_service() -> Optional[AbstractLLMService]:
    """
    Factory function that reads environment variables and returns the
    configured LLM service instance.
    """
    provider = os.getenv("LLM_PROVIDER", "").lower()
    model = os.getenv("LLM_MODEL")
    logging.info(f"Attempting to initialize LLM with provider: '{provider}' and model: '{model}'")

    try:
        if provider == "google" or provider == "gemma":
            # Handles Gemma and other Google models via API Key
            api_key = os.getenv("GOOGLE_GEMINI_API_KEY")
            if not api_key:
                logging.error("GOOGLE_GEMINI_API_KEY not set for Google provider.")
                return None
            
            if not model:
                logging.warning("LLM_MODEL not set, will use a default in GoogleLLMService.")

            return GoogleLLMService(api_key=api_key, model=model)

        elif provider == "openrouter" or provider == "qwen":
            # Handles Qwen (or any other model on OpenRouter)
            api_key = os.getenv("OPENROUTER_API_KEY")
            if not api_key:
                logging.error("OPENROUTER_API_KEY not set for OpenRouter provider.")
                return None
            if not model:
                logging.error("LLM_MODEL must be set for OpenRouter provider.")
                return None
            return OpenRouterLLMService(api_key=api_key, model=model)

        elif provider == "lm_studio":
            base_url = os.getenv("LM_STUDIO_API_BASE")
            model_name = os.getenv("LM_STUDIO_MODEL_NAME")
            if not base_url:
                logging.error("LM_STUDIO_API_BASE not set for LM Studio provider.")
                return None
            # LM Studio doesn't always need an explicit model name in the env,
            # but the service class requires it.
            if not model_name:
                logging.error("LM_STUDIO_MODEL_NAME must be set for LM Studio provider.")
                return None
            return LMStudioLLMService(base_url=base_url, model=model_name)

        else:
            logging.warning(f"Unknown or missing LLM_PROVIDER: '{provider}'. Valid options: google, openrouter, lm_studio.")
            return None

    except Exception as e:
        logging.error(f"❌ Failed to initialize LLM provider '{provider}': {e}", exc_info=True)
        return None 