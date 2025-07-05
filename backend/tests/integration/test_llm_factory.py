import os
import pytest
from unittest.mock import patch

from app.core.llm_factory import get_llm_service
from app.core.llm_service import GemmaLLMService
from app.core.lm_studio_llm_service import LMStudioLLMService

# Mark all tests in this file as async
pytestmark = pytest.mark.asyncio

def test_llm_factory_defaults_to_gemma():
    """Test that the factory returns GemmaLLMService by default."""
    with patch.dict(os.environ, {"LLM_PROVIDER": ""}, clear=True):
        service = get_llm_service()
        assert isinstance(service, GemmaLLMService)
        assert service.mock_mode is True # Expect mock mode without credentials

def test_llm_factory_selects_gemma():
    """Test that the factory explicitly selects GemmaLLMService."""
    with patch.dict(os.environ, {"LLM_PROVIDER": "GEMMA"}, clear=True):
        service = get_llm_service()
        assert isinstance(service, GemmaLLMService)
        assert service.mock_mode is True

def test_llm_factory_selects_lm_studio():
    """Test that the factory selects LMStudioLLMService."""
    # Mock the env vars needed for LMStudioLLMService to avoid mock_mode
    with patch.dict(os.environ, {
        "LLM_PROVIDER": "LM_STUDIO",
        "LM_STUDIO_API_BASE": "http://localhost:1234/v1",
        "LM_STUDIO_MODEL_NAME": "test-model"
    }):
        service = get_llm_service()
        assert isinstance(service, LMStudioLLMService)
        assert service.mock_mode is False

@pytest.mark.skipif(
    not os.getenv("LLM_PROVIDER") or os.getenv("LLM_PROVIDER").upper() != "LM_STUDIO",
    reason="This test is only for when LLM_PROVIDER is LM_STUDIO"
)
async def test_lm_studio_integration_process_command():
    """
    Integration test for LMStudioLLMService.
    Requires a running LM Studio server and correctly set .env variables.
    """
    # This test will use the actual environment variables
    service = get_llm_service()
    assert isinstance(service, LMStudioLLMService)
    assert service.mock_mode is False, "LM Studio service should not be in mock mode for this test."

    # A simple command to test the connection and JSON parsing
    test_command = "What's my schedule today?"
    
    # This will make a real API call to your local LM Studio server
    result = await service.process_command(test_command)

    assert isinstance(result, dict)
    assert "error" not in result, f"LLM processing returned an error: {result.get('error')}"
    assert "platform" in result
    assert "action" in result
    assert result["platform"] == "calendar"
    assert result["action"] == "check_today" 
import pytest
from unittest.mock import patch

from app.core.llm_factory import get_llm_service
from app.core.llm_service import GemmaLLMService
from app.core.lm_studio_llm_service import LMStudioLLMService

# Mark all tests in this file as async
pytestmark = pytest.mark.asyncio

def test_llm_factory_defaults_to_gemma():
    """Test that the factory returns GemmaLLMService by default."""
    with patch.dict(os.environ, {"LLM_PROVIDER": ""}, clear=True):
        service = get_llm_service()
        assert isinstance(service, GemmaLLMService)
        assert service.mock_mode is True # Expect mock mode without credentials

def test_llm_factory_selects_gemma():
    """Test that the factory explicitly selects GemmaLLMService."""
    with patch.dict(os.environ, {"LLM_PROVIDER": "GEMMA"}, clear=True):
        service = get_llm_service()
        assert isinstance(service, GemmaLLMService)
        assert service.mock_mode is True

def test_llm_factory_selects_lm_studio():
    """Test that the factory selects LMStudioLLMService."""
    # Mock the env vars needed for LMStudioLLMService to avoid mock_mode
    with patch.dict(os.environ, {
        "LLM_PROVIDER": "LM_STUDIO",
        "LM_STUDIO_API_BASE": "http://localhost:1234/v1",
        "LM_STUDIO_MODEL_NAME": "test-model"
    }):
        service = get_llm_service()
        assert isinstance(service, LMStudioLLMService)
        assert service.mock_mode is False

@pytest.mark.skipif(
    not os.getenv("LLM_PROVIDER") or os.getenv("LLM_PROVIDER").upper() != "LM_STUDIO",
    reason="This test is only for when LLM_PROVIDER is LM_STUDIO"
)
async def test_lm_studio_integration_process_command():
    """
    Integration test for LMStudioLLMService.
    Requires a running LM Studio server and correctly set .env variables.
    """
    # This test will use the actual environment variables
    service = get_llm_service()
    assert isinstance(service, LMStudioLLMService)
    assert service.mock_mode is False, "LM Studio service should not be in mock mode for this test."

    # A simple command to test the connection and JSON parsing
    test_command = "What's my schedule today?"
    
    # This will make a real API call to your local LM Studio server
    result = await service.process_command(test_command)

    assert isinstance(result, dict)
    assert "error" not in result, f"LLM processing returned an error: {result.get('error')}"
    assert "platform" in result
    assert "action" in result
    assert result["platform"] == "calendar"
    assert result["action"] == "check_today" 
 
 