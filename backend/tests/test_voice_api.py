"""
Test script for the voice command API with real AI responses
"""
import sys
import os
import json
import asyncio
import aiohttp

async def test_voice_command(text):
    """Test the voice command API with the given text"""
    print(f"\n🎤 TESTING VOICE COMMAND API")
    print("=" * 50)
    print(f"Command: '{text}'")
    
    url = "http://localhost:8000/api/v1/voice/text-command"
    payload = {"text": text}
    
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(url, json=payload) as response:
                if response.status == 200:
                    result = await response.json()
                    print("\n✅ API Response:")
                    print(json.dumps(result, indent=2))
                    
                    # Check if we got real AI response
                    if "mock" in str(result).lower():
                        print("\n⚠️ Warning: Still getting mock responses!")
                    else:
                        print("\n✅ Success: Real AI response detected!")
                    
                    return result
                else:
                    print(f"\n❌ Error: API returned status {response.status}")
                    print(await response.text())
                    return None
    except Exception as e:
        print(f"\n❌ Error connecting to API: {e}")
        print("\nMake sure the backend server is running with:")
        print("python -m uvicorn app.main:app --reload --port 8000")
        return None

async def main():
    """Run multiple test commands"""
    commands = [
        "Read my unread emails",
        "What's my schedule today?",
        "Compose an email to John about the project meeting",
        "Search for emails about the budget report",
        "Am I free tomorrow at 2 PM?"
    ]
    
    print("\n🚀 MINUS VOICE ASSISTANT - API TESTING")
    print("=" * 50)
    
    for command in commands:
        await test_voice_command(command)
        print("\n" + "-" * 50)
        
    print("\n✅ Testing complete!")

if __name__ == "__main__":
    asyncio.run(main()) 