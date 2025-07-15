import pytest
import httpx
import os
import uuid

# This is an integration test that calls the live API.
# It requires the backend server to be running.
# You can run it with: pytest backend/tests/integration/test_assistant_flow.py

# The base URL for the running FastAPI application
BASE_URL = "http://127.0.0.1:8000"

# A hardcoded user ID that should exist in your test setup (e.g., in Supabase)
# and have a corresponding `token_google_{user_id}.json` file in the `tokens/` directory.
# This now matches the default in `app/dependencies.py`.
TEST_USER_ID = "test_user_001"

@pytest.mark.asyncio
async def test_assistant_schedule_event_end_to_end():
    """
    Tests the full flow of scheduling a calendar event using natural language.
    1. Sends a natural language request to the assistant.
    2. The assistant should internally use the datetime converter tool.
    3. The assistant should then use the create_calendar_event tool.
    4. The final response should be a success message with a link to the event.
    """
    async with httpx.AsyncClient() as client:
        # A unique session ID for the conversation
        session_id = str(uuid.uuid4())
        
        # The natural language command
        message = "Can you schedule a meeting with test@example.com for tomorrow at 3pm to discuss the Q3 report?"
        
        headers = {
            "X-User-Id": TEST_USER_ID,
            "Content-Type": "application/json"
        }
        
        payload = {
            "message": message,
            "session_id": session_id
        }
        
        response = await client.post(
            f"{BASE_URL}/api/v1/assistant/chat",
            json=payload,
            headers=headers,
            timeout=60  # Allow a long timeout for the LLM to process
        )
        
        # Assert that the request was successful
        assert response.status_code == 200
        
        response_data = response.json()
        
        # Assert that the response contains the expected structure for a final answer
        assert response_data["type"] == "text"
        assert "assistant_response" in response_data
        
        # Check that the final response indicates success.
        # This is an indirect way of verifying the tool call worked.
        # A more robust test would mock the tool and assert it was called.
        final_message = response_data["assistant_response"].lower()
        assert "event has been scheduled" in final_message or "i've scheduled" in final_message
        assert "https://calendar.google.com" in final_message
        
        print(f"Assistant's final response: {response_data['assistant_response']}")

# To run this test:
# 1. Make sure your FastAPI server is running: `uvicorn app.main:app --reload`
# 2. Run pytest from the root directory: `pytest backend/tests/integration/` 