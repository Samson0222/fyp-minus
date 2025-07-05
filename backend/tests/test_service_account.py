"""
Test script to verify the service account integration with Google AI
"""
import sys
import os
import asyncio
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.llm_service import GemmaLLMService

async def test_llm_service():
    """Test the LLM service with service account authentication"""
    print("\n🚀 TESTING GEMINI SERVICE ACCOUNT INTEGRATION")
    print("=" * 50)
    
    # Initialize the service
    print("Initializing LLM service...")
    llm_service = GemmaLLMService()
    
    # Check if using mock mode
    print(f"Mock mode: {'✅ Yes' if llm_service.mock_mode else '❌ No'}")
    
    if not llm_service.mock_mode:
        print("✅ Service account authentication successful!")
        print("Testing direct model access...")
        
        try:
            # Test direct model access
            response = llm_service.genai_model.generate_content("What is a service account in one sentence?")
            print(f"\nDirect model response: {response.text}")
            
            # Test command processing
            print("\nTesting command processing...")
            result = await llm_service.process_command("Read my unread emails")
            print(f"Command processing result: {result}")
            
            print("\n✅ All tests passed! Service account integration is working.")
        except Exception as e:
            print(f"\n❌ Error during testing: {e}")
    else:
        print("\n⚠️ Using mock mode - service account not configured or not found.")
        print("Please check that:")
        print("1. You have created a service account JSON file")
        print("2. The file is located at the path specified in GEMINI_CREDENTIALS_PATH")
        print("3. The service account has access to the Gemini API")
    
    # Show usage stats
    print("\nUsage stats:")
    print(llm_service.get_usage_stats())

if __name__ == "__main__":
    asyncio.run(test_llm_service()) 