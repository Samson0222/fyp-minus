#!/usr/bin/env python3
"""
Comprehensive Test Runner for Minus Voice Assistant - Day 1
Runs all automated tests and provides detailed results
"""
import asyncio
import subprocess
import sys
import time
import requests
import json
import os
from dotenv import load_dotenv

load_dotenv()

def print_header(title):
    """Print a formatted header"""
    print("\n" + "=" * 60)
    print(f"🧪 {title}")
    print("=" * 60)

def print_section(title):
    """Print a formatted section"""
    print(f"\n📋 {title}")
    print("-" * 40)

async def run_test_script(script_name):
    """Run a test script and capture its output"""
    print(f"\n🚀 Running {script_name}...")
    try:
        result = subprocess.run([sys.executable, script_name], 
                              capture_output=True, text=True, cwd=os.getcwd())
        print(result.stdout)
        if result.stderr:
            print("⚠️ Warnings/Errors:")
            print(result.stderr)
        return result.returncode == 0
    except Exception as e:
        print(f"❌ Failed to run {script_name}: {e}")
        return False

def test_api_endpoint(method, url, data=None, description=""):
    """Test an API endpoint and return success status"""
    try:
        print(f"\n🔗 Testing: {description}")
        print(f"   {method} {url}")
        
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10)
        else:
            return False
            
        print(f"   Status: {response.status_code}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"   ✅ Response: {json.dumps(result, indent=2)[:200]}...")
            return True
        else:
            print(f"   ❌ Failed with status {response.status_code}")
            return False
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False

async def test_server_running():
    """Check if the server is running"""
    print("\n🌐 Checking if server is running...")
    try:
        response = requests.get("http://localhost:8000/", timeout=5)
        if response.status_code == 200:
            print("✅ Server is running!")
            return True
        else:
            print("❌ Server responded with error")
            return False
    except Exception as e:
        print(f"❌ Server not running: {e}")
        print("\n💡 To start the server, run:")
        print("   python -m uvicorn app.main:app --reload --port 8000")
        return False

async def run_automated_tests():
    """Run all automated test scripts"""
    print_header("AUTOMATED TEST SUITE")
    
    test_results = {}
    
    # Test 1: Voice Pipeline
    print_section("Voice Pipeline Integration Test")
    test_results['voice_pipeline'] = await run_test_script('test_voice_pipeline.py')
    
    # Test 2: Gmail Integration
    print_section("Gmail Voice Integration Test")
    test_results['gmail'] = await run_test_script('test_gmail_voice.py')
    
    # Test 3: Calendar Integration
    print_section("Calendar Voice Integration Test")
    test_results['calendar'] = await run_test_script('test_calendar_voice.py')
    
    return test_results

async def run_api_tests():
    """Run API endpoint tests"""
    print_header("API ENDPOINT TESTS")
    
    server_running = await test_server_running()
    if not server_running:
        return {"api_tests": False, "reason": "Server not running"}
    
    api_results = {}
    
    # Health check
    api_results['health'] = test_api_endpoint(
        "GET", "http://localhost:8000/api/v1/voice/health", 
        description="Voice Health Check"
    )
    
    # Text command - Gmail
    api_results['gmail_command'] = test_api_endpoint(
        "POST", "http://localhost:8000/api/v1/voice/text-command",
        {"text": "Read my unread emails"},
        description="Gmail Text Command"
    )
    
    # Text command - Calendar  
    api_results['calendar_command'] = test_api_endpoint(
        "POST", "http://localhost:8000/api/v1/voice/text-command",
        {"text": "What's my schedule today?"},
        description="Calendar Text Command"
    )
    
    # Voice state management
    api_results['state'] = test_api_endpoint(
        "GET", "http://localhost:8000/api/v1/voice/state",
        description="Voice State Check"
    )
    
    api_results['activate'] = test_api_endpoint(
        "POST", "http://localhost:8000/api/v1/voice/activate-voice",
        description="Voice Activation"
    )
    
    api_results['deactivate'] = test_api_endpoint(
        "POST", "http://localhost:8000/api/v1/voice/deactivate-voice",
        description="Voice Deactivation"
    )
    
    # LLM test
    api_results['llm'] = test_api_endpoint(
        "POST", "http://localhost:8000/api/v1/voice/test-llm",
        description="LLM Integration Test"
    )
    
    return api_results

def print_final_summary(automated_results, api_results):
    """Print the final test summary"""
    print_header("FINAL TEST RESULTS SUMMARY")
    
    # Automated tests summary
    print_section("Automated Tests")
    for test_name, passed in automated_results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    # API tests summary
    print_section("API Endpoint Tests")
    if isinstance(api_results, dict) and 'reason' in api_results:
        print(f"   ❌ SKIPPED: {api_results['reason']}")
    else:
        for test_name, passed in api_results.items():
            status = "✅ PASS" if passed else "❌ FAIL"
            print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    # Overall status
    print_section("Overall Status")
    automated_passed = sum(automated_results.values())
    automated_total = len(automated_results)
    
    if isinstance(api_results, dict) and 'reason' not in api_results:
        api_passed = sum(api_results.values())
        api_total = len(api_results)
    else:
        api_passed = 0
        api_total = 0
    
    total_passed = automated_passed + api_passed
    total_tests = automated_total + api_total
    
    print(f"   Automated Tests: {automated_passed}/{automated_total}")
    print(f"   API Tests: {api_passed}/{api_total}")
    print(f"   Total: {total_passed}/{total_tests}")
    
    if total_passed == total_tests and total_tests > 0:
        print("\n🎉 ALL TESTS PASSED!")
        print("   Day 1 implementation is working perfectly!")
    elif total_passed > 0:
        print(f"\n⚠️ {total_passed}/{total_tests} tests passed")
        print("   Some functionality is working, check failures above")
    else:
        print("\n❌ NO TESTS PASSED")
        print("   Please check the setup and try again")
    
    # Next steps
    print_section("Next Steps")
    if total_passed == total_tests and total_tests > 0:
        print("   ✅ Ready for Day 2 development!")
        print("   ✅ Add Google Docs and Telegram integrations")
    else:
        print("   🔧 Fix failing tests before proceeding")
        print("   📖 Check the troubleshooting guide in TEST_PLAN.md")

async def main():
    """Main test runner"""
    start_time = time.time()
    
    print("🚀 MINUS VOICE ASSISTANT - DAY 1 TEST SUITE")
    print("=" * 60)
    print(f"⏰ Started at: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    # Check environment
    print_section("Environment Check")
    missing_vars = []
    for var in ["SUPABASE_URL", "SUPABASE_ANON_KEY"]:
        if not os.getenv(var):
            missing_vars.append(var)
    
    if missing_vars:
        print(f"⚠️ Missing environment variables: {', '.join(missing_vars)}")
        print("📝 Tests will run in mock mode (this is expected for initial testing)")
    else:
        print("✅ All environment variables found")
    
    # Run tests
    automated_results = await run_automated_tests()
    api_results = await run_api_tests()
    
    # Print summary
    print_final_summary(automated_results, api_results)
    
    # Timing
    end_time = time.time()
    duration = end_time - start_time
    print(f"\n⏱️ Total test duration: {duration:.2f} seconds")
    print(f"⏰ Completed at: {time.strftime('%Y-%m-%d %H:%M:%S')}")

if __name__ == "__main__":
    asyncio.run(main()) 