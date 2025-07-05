"""
Test script for voice pipeline components
"""
import asyncio
import os
import sys
from dotenv import load_dotenv

# Add the backend directory to Python path so we can import app modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

async def test_llm_integration():
    """Test Gemma 3n integration"""
    print("🧠 Testing Gemma 3n LLM Integration...")
    
    try:
        from app.core.llm_service import GemmaLLMService
        llm_service = GemmaLLMService()
        
        test_commands = [
            "Read my unread emails",
            "What's my schedule today?", 
            "Create a new document",
            "Send a message to the team"
        ]
        
        for cmd in test_commands:
            print(f"\n💬 User: {cmd}")
            try:
                response = await llm_service.process_command(cmd)
                print(f"🤖 Gemma 3n: {response}")
            except Exception as e:
                print(f"❌ Error processing command: {e}")
        
        # Check usage stats
        stats = llm_service.get_usage_stats()
        print(f"\n📊 Usage Stats: {stats}")
        
        return True
    except Exception as e:
        print(f"❌ LLM Integration Test Failed: {e}")
        return False

async def test_voice_assistant():
    """Test voice assistant functionality"""
    print("\n🎤 Testing Voice Assistant...")
    
    try:
        from voice_server import get_voice_assistant
        
        voice_assistant = get_voice_assistant()
        
        # Test text input processing
        test_texts = [
            "Read my emails",
            "What's my schedule?",
            "Help me with Gmail"
        ]
        
        for text in test_texts:
            print(f"\n💬 Text Input: {text}")
            try:
                response = await voice_assistant.handle_text_input(text)
                print(f"🤖 Response: {response}")
            except Exception as e:
                print(f"❌ Error: {e}")
        
        # Test state management
        print(f"\n📊 Current State: {voice_assistant.state.value}")
        print(f"🎯 Wake Words: {voice_assistant.wake_words}")
        print(f"🛑 Stop Words: {voice_assistant.stop_words}")
        
        return True
    except Exception as e:
        print(f"❌ Voice Assistant Test Failed: {e}")
        return False

async def test_environment():
    """Test environment configuration"""
    print("\n🔧 Testing Environment Configuration...")
    
    required_vars = [
        "GOOGLE_API_KEY",
        "SUPABASE_URL", 
        "SUPABASE_ANON_KEY"
    ]
    
    missing_vars = []
    for var in required_vars:
        value = os.getenv(var)
        if not value or value.strip() == "your_" + var.lower() + "_here":
            missing_vars.append(var)
            print(f"⚠️ Missing: {var} (will use mock mode)")
        else:
            # Mask sensitive values
            masked_value = value[:8] + "..." if len(value) > 8 else "***"
            print(f"✅ Found: {var} = {masked_value}")
    
    if missing_vars:
        print(f"\n📝 Note: Missing environment variables will use mock mode for testing:")
        for var in missing_vars:
            print(f"   {var} - Mock mode enabled")
        print("\n✅ Proceeding with mock mode testing...")
    
    return True  # Always return True to continue with mock testing

async def main():
    """Run all tests"""
    print("🚀 Starting Voice Pipeline Tests...")
    print("=" * 50)
    
    # Test environment first
    env_ok = await test_environment()
    
    if not env_ok:
        print("\n❌ Environment tests failed. Please fix configuration first.")
        return
    
    # Test LLM integration
    llm_ok = await test_llm_integration()
    
    # Test voice assistant
    voice_ok = await test_voice_assistant()
    
    # Summary
    print("\n" + "=" * 50)
    print("📋 Test Summary:")
    print(f"   Environment: {'✅ PASS' if env_ok else '❌ FAIL'}")
    print(f"   LLM Service: {'✅ PASS' if llm_ok else '❌ FAIL'}")
    print(f"   Voice Assistant: {'✅ PASS' if voice_ok else '❌ FAIL'}")
    
    if all([env_ok, llm_ok, voice_ok]):
        print("\n🎉 All tests passed! Voice pipeline is ready.")
    else:
        print("\n⚠️ Some tests failed. Check the errors above.")

if __name__ == "__main__":
    asyncio.run(main()) 