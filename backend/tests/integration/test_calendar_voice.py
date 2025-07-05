"""
Test Calendar voice integration
"""
import asyncio
import sys
import os
from dotenv import load_dotenv

# Add the backend directory to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

load_dotenv()

async def test_calendar_voice():
    """Test Calendar voice command processing"""
    print("📅 Testing Calendar Voice Integration...")
    print("=" * 40)
    
    try:
        from app.services.calendar_service import CalendarService
        calendar_service = CalendarService()
        
        test_commands = [
            {
                "name": "Check Today's Schedule",
                "command": {"action": "check_today", "params": {}}
            },
            {
                "name": "Create Event",
                "command": {"action": "create_event", "params": {"title": "Team Meeting", "time": "3 PM"}}
            },
            {
                "name": "Check Availability",
                "command": {"action": "check_availability", "params": {"date": "tomorrow", "time": "2 PM"}}
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
                result = await calendar_service.process_voice_command(test['command'])
                print(f"   ✅ Result: {result}")
                results.append({"test": test['name'], "success": True, "result": result})
            except Exception as e:
                print(f"   ❌ Error: {e}")
                results.append({"test": test['name'], "success": False, "error": str(e)})
        
        # Summary
        print("\n" + "=" * 40)
        print("📋 Calendar Voice Test Summary:")
        passed = sum(1 for r in results if r['success'])
        total = len(results)
        print(f"   Passed: {passed}/{total}")
        
        for result in results:
            status = "✅" if result['success'] else "❌"
            print(f"   {status} {result['test']}")
        
        return passed == total
        
    except Exception as e:
        print(f"❌ Calendar Voice Test Setup Failed: {e}")
        return False

async def test_llm_calendar_integration():
    """Test LLM parsing of Calendar commands"""
    print("\n🧠 Testing LLM Calendar Command Parsing...")
    print("=" * 40)
    
    try:
        from app.core.llm_service import GemmaLLMService
        llm_service = GemmaLLMService()
        
        test_inputs = [
            "What's my schedule today?",
            "Check my calendar for today",
            "Create a meeting for tomorrow at 2 PM",
            "Schedule a team standup for Monday morning",
            "Am I free at 3 PM today?",
            "Add a lunch appointment to my calendar"
        ]
        
        results = []
        for input_text in test_inputs:
            print(f"\n💬 Input: '{input_text}'")
            
            try:
                parsed = await llm_service.process_command(input_text)
                print(f"   🤖 Parsed: {parsed}")
                
                # Check if it's a Calendar command
                is_calendar = parsed.get('platform') == 'calendar'
                results.append({"input": input_text, "success": is_calendar, "parsed": parsed})
                
            except Exception as e:
                print(f"   ❌ Error: {e}")
                results.append({"input": input_text, "success": False, "error": str(e)})
        
        # Summary
        print("\n" + "=" * 40)
        print("📋 LLM Calendar Parsing Summary:")
        calendar_commands = sum(1 for r in results if r['success'])
        total = len(results)
        print(f"   Calendar Commands Detected: {calendar_commands}/{total}")
        
        return calendar_commands > 0
        
    except Exception as e:
        print(f"❌ LLM Calendar Test Failed: {e}")
        return False

async def test_calendar_features():
    """Test additional calendar features"""
    print("\n📊 Testing Additional Calendar Features...")
    print("=" * 40)
    
    try:
        from app.services.calendar_service import CalendarService
        calendar_service = CalendarService()
        
        # Test upcoming events
        print(f"\n🧪 Testing: Get Upcoming Events")
        upcoming_result = await calendar_service.get_upcoming_events(7)
        print(f"   ✅ Upcoming Events: {upcoming_result}")
        
        return True
        
    except Exception as e:
        print(f"❌ Calendar Features Test Failed: {e}")
        return False

async def main():
    """Run all Calendar voice tests"""
    print("🚀 Starting Calendar Voice Integration Tests...")
    print("=" * 50)
    
    # Test Calendar voice commands
    calendar_ok = await test_calendar_voice()
    
    # Test LLM Calendar parsing
    llm_ok = await test_llm_calendar_integration()
    
    # Test additional features
    features_ok = await test_calendar_features()
    
    # Overall summary
    print("\n" + "=" * 50)
    print("🏁 Final Calendar Voice Test Results:")
    print(f"   Calendar Voice Commands: {'✅ PASS' if calendar_ok else '❌ FAIL'}")
    print(f"   LLM Calendar Parsing: {'✅ PASS' if llm_ok else '❌ FAIL'}")
    print(f"   Additional Features: {'✅ PASS' if features_ok else '❌ FAIL'}")
    
    if calendar_ok and llm_ok and features_ok:
        print("\n🎉 Calendar voice integration is working!")
    else:
        print("\n⚠️ Some Calendar voice tests failed. Check errors above.")

if __name__ == "__main__":
    asyncio.run(main()) 