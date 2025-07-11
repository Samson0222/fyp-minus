# MINUS VOICE ASSISTANT - DAY 1 TEST PLAN

## Overview
This test plan covers all functionality implemented in Day 1:
- Voice pipeline with LLM integration
- Gmail voice commands  
- Calendar voice commands
- API endpoints and state management
- Dual input support (voice + text)

---

## 🚀 QUICK START TESTING

### Prerequisites
```bash
cd backend
pip install -r requirements.txt
```

### 1. Start the Server
```bash
# Terminal 1: Start FastAPI server
python -m uvicorn app.main:app --reload --port 8000
```

### 2. Verify Server is Running
```bash
# Terminal 2: Test basic connectivity
curl http://localhost:8000
# Expected: {"message": "Minus Voice Assistant API is running!", ...}
```

---

## 🧪 AUTOMATED TEST SUITE

### Test 1: Voice Pipeline Integration
```bash
python test_voice_pipeline.py
```

**Expected Output:**
```
🚀 Starting Voice Pipeline Tests...
==================================================
🔧 Testing Environment Configuration...
⚠️ Missing: GOOGLE_API_KEY (will use mock mode)
📝 Note: Missing environment variables will use mock mode for testing

🧠 Testing Gemma 3n LLM Integration...
💬 User: Read my unread emails
🤖 Gemma 3n: {'platform': 'gmail', 'action': 'read_unread', 'params': {}}

🎤 Testing Voice Assistant...
💬 Text Input: Read my emails
🤖 Response: You have 3 unread emails. 1 from John about...

📋 Test Summary:
   Environment: ✅ PASS
   LLM Service: ✅ PASS  
   Voice Assistant: ✅ PASS
🎉 All tests passed! Voice pipeline is ready.
```

### Test 2: Gmail Voice Integration
```bash
python test_gmail_voice.py
```

**Expected Output:**
```
📧 Testing Gmail Voice Integration...
🧪 Testing: Read Unread Emails ✅
🧪 Testing: Compose Email ✅  
🧪 Testing: Search Emails ✅
📋 Gmail Voice Test Summary: Passed: 4/4
🎉 Gmail voice integration is working!
```

### Test 3: Calendar Voice Integration  
```bash
python test_calendar_voice.py
```

**Expected Output:**
```
📅 Testing Calendar Voice Integration...
🧪 Testing: Check Today's Schedule ✅
🧪 Testing: Create Event ✅
🧪 Testing: Check Availability ✅  
📋 Calendar Voice Test Summary: Passed: 4/4
🎉 Calendar voice integration is working!
```

---

## 🔗 API ENDPOINT TESTING

### Health Check
```bash
curl -X GET "http://localhost:8000/api/v1/voice/health"
```
**Expected:**
```json
{
  "status": "healthy",
  "llm_service": "gemma-2-2b-it", 
  "voice_state": "idle",
  "stats": {"model": "mock_mode", "tier": "TESTING"}
}
```

### Text Command - Gmail
```bash
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Read my unread emails"}'
```
**Expected:**
```json
{
  "success": true,
  "response": "You have 3 unread emails. 1 from John about the meeting...",
  "state": "idle", 
  "input_method": "text",
  "usage_stats": {"model": "mock_mode", "tier": "TESTING"}
}
```

### Text Command - Calendar
```bash
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "What is my schedule today?"}'
```
**Expected:**
```json
{
  "success": true,
  "response": "You have 3 events today. Daily Standup at 9:00 AM...", 
  "state": "idle",
  "input_method": "text"
}
```

### Voice State Management
```bash
# Check current state
curl -X GET "http://localhost:8000/api/v1/voice/state"

# Activate voice mode  
curl -X POST "http://localhost:8000/api/v1/voice/activate-voice"

# Check state after activation
curl -X GET "http://localhost:8000/api/v1/voice/state"

# Deactivate voice mode
curl -X POST "http://localhost:8000/api/v1/voice/deactivate-voice"
```

### LLM Integration Test
```bash
curl -X POST "http://localhost:8000/api/v1/voice/test-llm"
```

---

## 🎯 MANUAL FUNCTIONALITY TESTING

### Test Scenario 1: Gmail Voice Commands
**Purpose:** Verify Gmail integration works with various commands

**Test Cases:**
1. **Read Emails:**
   - Input: "Read my unread emails"
   - Expected: List of 3 mock emails with details

2. **Compose Email:**
   - Input: "Compose email to john about meeting"  
   - Expected: Draft created with recipient and subject

3. **Search Emails:**
   - Input: "Search for emails from John"
   - Expected: Search results with matching emails

4. **Alternative Phrasings:**
   - "Check my inbox"
   - "What emails do I have?"
   - "Send a message to sarah"

### Test Scenario 2: Calendar Voice Commands  
**Purpose:** Verify Calendar integration works with various commands

**Test Cases:**
1. **Check Schedule:**
   - Input: "What's my schedule today?"
   - Expected: List of 3 events with times

2. **Create Event:**
   - Input: "Schedule a meeting at 3 PM"
   - Expected: Event creation confirmation

3. **Check Availability:**
   - Input: "Am I free at 2 PM tomorrow?"
   - Expected: Availability confirmation

4. **Alternative Phrasings:**
   - "Check my calendar"
   - "Add lunch to my schedule"
   - "Create a team standup"

### Test Scenario 3: Voice State Management
**Purpose:** Verify state transitions work correctly

**Test Cases:**
1. **Wake Word Detection (Simulated):**
   - Say: "Hey Minus" → Should activate listening mode
   - State should change: idle → listening

2. **Manual Activation:**
   - Click "Activate Voice" button
   - State should show: listening = true

3. **Deactivation:**
   - Say: "stop" OR wait 3 seconds OR click "Deactivate"
   - State should return: idle

4. **Command Processing:**
   - While listening, give command
   - State transitions: listening → processing → responding → idle

---

## 🔧 TROUBLESHOOTING GUIDE

### Common Issues & Solutions

#### 1. Server Won't Start
**Error:** `Could not import module "main"`
**Solution:** 
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

#### 2. Import Errors
**Error:** `ModuleNotFoundError`
**Solution:**
```bash
pip install langchain-google-genai google-generativeai websockets
```

#### 3. Environment Variables
**Issue:** Missing API keys
**Solution:** Tests run in mock mode automatically - no API keys needed

#### 4. Port Already in Use
**Error:** `Address already in use`
**Solution:**
```bash
# Use different port
python -m uvicorn app.main:app --reload --port 8001
# Update test URLs to use port 8001
```

#### 5. Mock Responses
**Issue:** "Why am I getting mock responses?"
**Answer:** This is expected! Mock mode allows testing without API keys

---

## 📊 TEST SUCCESS CRITERIA

### Automated Tests
- [ ] **Voice Pipeline Test**: All 3 components pass
- [ ] **Gmail Integration Test**: 4/4 tests pass  
- [ ] **Calendar Integration Test**: 4/4 tests pass

### API Endpoints  
- [ ] **Health Check**: Returns healthy status
- [ ] **Text Commands**: Gmail and Calendar commands work
- [ ] **State Management**: Activation/deactivation works
- [ ] **LLM Integration**: Command parsing works

### Manual Testing
- [ ] **Command Recognition**: LLM correctly identifies platforms
- [ ] **Response Quality**: Responses are natural and helpful
- [ ] **State Transitions**: Voice states change appropriately  
- [ ] **Error Handling**: Graceful failures with helpful messages

### Performance
- [ ] **Response Time**: < 3 seconds per command
- [ ] **API Availability**: No timeouts or errors
- [ ] **Memory Usage**: Stable during testing

---

## 🎯 EXPECTED BEHAVIOR SUMMARY

### What Should Work:
✅ **Text Commands**: Process Gmail and Calendar commands  
✅ **LLM Parsing**: Convert natural language to structured commands  
✅ **Platform Routing**: Commands go to correct service (Gmail/Calendar)  
✅ **Mock Responses**: Realistic test data for Gmail and Calendar  
✅ **State Management**: Manual activation/deactivation  
✅ **API Endpoints**: All voice endpoints respond correctly  
✅ **Error Handling**: Graceful fallbacks for unknown commands  

### What's Simulated:
⚠️ **FastRTC**: Voice recording/playback (not available in package)  
⚠️ **Google APIs**: Using mock data instead of real Gmail/Calendar  
⚠️ **Wake Word**: Detection logic present but audio processing simulated  

### What's Next (Day 2):
⏳ **Google Docs**: Add document creation/editing commands  
⏳ **Telegram**: Add messaging commands  
⏳ **Real APIs**: Replace mock data with actual integrations  
⏳ **Frontend**: Voice interface components

---

## 🚦 RUN ALL TESTS COMMAND

To run the complete test suite:

```bash
# Start server in background
python -m uvicorn app.main:app --reload --port 8000 &

# Wait for server to start
sleep 3

# Run all automated tests
echo "=== Running Voice Pipeline Tests ==="
python test_voice_pipeline.py

echo "=== Running Gmail Integration Tests ==="  
python test_gmail_voice.py

echo "=== Running Calendar Integration Tests ==="
python test_calendar_voice.py

echo "=== Running API Endpoint Tests ==="
curl -X GET "http://localhost:8000/api/v1/voice/health"
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Read my emails"}'

echo "=== All Tests Complete ==="
```

This will give you a comprehensive verification of all Day 1 functionality! 