"""
Test Gmail voice command integration
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

async def test_gmail_voice():
    """Test Gmail voice command processing"""
    print("📧 Testing Gmail Voice Integration...")
    print("=" * 40)
    
    try:
        from app.services.gmail_service import GmailService
        gmail_service = GmailService()
        
        test_commands = [
            {
                "name": "Read Unread Emails",
                "command": {"action": "read_unread", "params": {}}
            },
            {
                "name": "Compose Email",
                "command": {"action": "compose", "params": {"to": "john@example.com", "subject": "meeting"}}
            },
            {
                "name": "Search Emails",
                "command": {"action": "search", "params": {"query": "project update"}}
            },
            {
                "name": "Unknown Action",
                "command": {"action": "unknown_action", "params": {}}
            }
        ]
        
        results = []
        for test in test_commands:
            print(f"\n🧪 Testing: {test['name']}")
            print(f"   Command: {test['command']}")
            
            try:
                result = await gmail_service.process_voice_command(test['command'])
                print(f"   ✅ Result: {result}")
                results.append({"test": test['name'], "success": True, "result": result})
            except Exception as e:
                print(f"   ❌ Error: {e}")
                results.append({"test": test['name'], "success": False, "error": str(e)})
        
        # Summary
        print("\n" + "=" * 40)
        print("📋 Gmail Voice Test Summary:")
        passed = sum(1 for r in results if r['success'])
        total = len(results)
        print(f"   Passed: {passed}/{total}")
        
        for result in results:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}")
        
        return passed == total
        
    except Exception as e:
        print(f"❌ Gmail Voice Test Setup Failed: {e}")
        return False

async def test_llm_gmail_integration():
    """Test LLM parsing of Gmail commands"""
    print("\n🧠 Testing LLM Gmail Command Parsing...")
    print("=" * 40)
    
    try:
        from app.core.llm_service import GemmaLLMService
        llm_service = GemmaLLMService()
        
        test_inputs = [
            "Read my unread emails",
            "Check my inbox",
            "Compose an email to sarah about the project",
            "Send a message to the team",
            "Search for emails from John",
            "Find emails about meetings"
        ]
        
        results = []
        for input_text in test_inputs:
            print(f"\n💬 Input: '{input_text}'")
            
            try:
                parsed = await llm_service.process_command(input_text)
                print(f"   🤖 Parsed: {parsed}")
                
                # Check if it's a Gmail command
                is_gmail = parsed.get('platform') == 'gmail'
                results.append({"input": input_text, "success": is_gmail, "parsed": parsed})
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                results.append({"input": input_text, "success": False, "error": str(e)})
        
        # Summary
        print("\n" + "=" * 40)
        print("📋 LLM Gmail Parsing Summary:")
        gmail_commands = sum(1 for r in results if r['success'])
        total = len(results)
        print(f"   Gmail Commands Detected: {gmail_commands}/{total}")
        
        return gmail_commands > 0
        
    except Exception as e:
        print(f"❌ LLM Gmail Test Failed: {e}")
        return False

async def main():
    """Run all Gmail voice tests"""
    print("🚀 Starting Gmail Voice Integration Tests...")
    print("=" * 50)
    
    # Test Gmail voice commands
    gmail_ok = await test_gmail_voice()
    
    # Test LLM Gmail parsing
    llm_ok = await test_llm_gmail_integration()
    
    # Overall summary
    print("\n" + "=" * 50)
    print("🏁 Final Gmail Voice Test Results:")
    print(f"   Gmail Voice Commands: {'✅ PASS' if gmail_ok else '❌ FAIL'}")
    print(f"   LLM Gmail Parsing: {'✅ PASS' if llm_ok else '❌ FAIL'}")
    
    if gmail_ok and llm_ok:
        print("\n🎉 Gmail voice integration is working!")
    else:
        print("\n⚠️ Some Gmail voice tests failed. Check errors above.")

if __name__ == "__main__":
    asyncio.run(main()) 