from abc import ABC, abstractmethod
from typing import Dict, Any, Optional

class AbstractLLMService(ABC):
    """
    An abstract base class that defines the contract for all LLM services.
    Every LLM service MUST implement these methods.
    """
    @abstractmethod
    async def process_command(self, user_input: str, context: Optional[Dict] = None) -> Dict[str, Any]:
        """Processes the user input and returns the LLM's response."""
        pass

    @abstractmethod
    async def generate_text(self, prompt: str) -> str:
        """Generate plain text response without JSON parsing - for summarization, etc."""
        pass

    @abstractmethod
    def get_usage_stats(self) -> Dict[str, Any]:
        """Returns usage statistics for the service."""
        pass 