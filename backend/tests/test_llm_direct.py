"""
Test the LLM service directly with voice commands
"""
import sys
import os
import json
import asyncio
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.llm_service import GemmaLLMService

async def test_llm_command(text):
    """Test the LLM service with a voice command"""
    print(f"\n🎤 TESTING LLM WITH COMMAND")
    print("=" * 50)
    print(f"Command: '{text}'")
    
    # Initialize the LLM service
    llm_service = GemmaLLMService()
    
    # Check if using mock mode
    if llm_service.mock_mode:
        print("⚠️ Warning: Using mock mode - service account not configured")
    else:
        print("✅ Using real AI with service account")
    
    # Process the command
    result = await llm_service.process_command(text)
    
    # Print the result
    print("\n📊 LLM Response:")
    print(json.dumps(result, indent=2))
    
    return result

async def main():
    """Run multiple test commands"""
    commands = [
        "Read my unread emails",
        "What's my schedule today?",
        "Compose an email to John about the project meeting",
        "Search for emails about the budget report",
        "Am I free tomorrow at 2 PM?"
    ]
    
    print("\n🚀 MINUS VOICE ASSISTANT - LLM DIRECT TESTING")
    print("=" * 50)
    
    for command in commands:
        await test_llm_command(command)
        print("\n" + "-" * 50)
        
    print("\n✅ Testing complete!")

if __name__ == "__main__":
    asyncio.run(main()) 