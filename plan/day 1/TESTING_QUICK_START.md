# MINUS VOICE ASSISTANT - TESTING QUICK START

## 🚀 Super Quick Test (5 minutes)

### 1. Setup Environment
```bash
cd backend
python setup_test_environment.py
```

### 2. Start Server (Terminal 1)
```bash
python -m uvicorn app.main:app --reload --port 8000
```

### 3. Run All Tests (Terminal 2)
```bash
python run_all_tests.py
```

**Expected Result:** All tests should pass with mock data!

---

## 🧪 What Gets Tested

### ✅ Automated Tests
- **Voice Pipeline**: LLM integration and command processing
- **Gmail Voice**: Read emails, compose, search commands  
- **Calendar Voice**: Check schedule, create events, availability
- **API Endpoints**: All voice API endpoints working
- **State Management**: Voice activation/deactivation

### 🎯 Success Criteria
- All 3 automated tests pass
- All 7 API endpoints respond correctly
- LLM correctly parses Gmail and Calendar commands
- Mock responses are realistic and helpful

---

## 🔍 Manual Testing Examples

### Gmail Commands
```bash
# Test via API
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Read my unread emails"}'

# Expected response with 3 mock emails
```

### Calendar Commands  
```bash
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "What is my schedule today?"}'

# Expected response with 3 mock events
```

### Voice State Management
```bash
# Check current state
curl -X GET "http://localhost:8000/api/v1/voice/state"

# Activate voice mode
curl -X POST "http://localhost:8000/api/v1/voice/activate-voice"

# Deactivate voice mode
curl -X POST "http://localhost:8000/api/v1/voice/deactivate-voice"
```

---

## 🏆 Expected Test Results

### ✅ PASSING OUTPUT
```
🧪 AUTOMATED TEST SUITE
Voice Pipeline Integration Test: ✅ PASS
Gmail Voice Integration Test: ✅ PASS
Calendar Voice Integration Test: ✅ PASS

🧪 API ENDPOINT TESTS  
Health: ✅ PASS
Gmail Command: ✅ PASS
Calendar Command: ✅ PASS
State: ✅ PASS
Activate: ✅ PASS
Deactivate: ✅ PASS
LLM: ✅ PASS

🎉 ALL TESTS PASSED!
Day 1 implementation is working perfectly!
```

### 📊 Performance Expectations
- **Response Time**: < 3 seconds per command
- **API Availability**: 100% uptime during tests
- **Command Recognition**: 80%+ accuracy for Gmail/Calendar
- **Budget**: $0.00 (using FREE mock mode)

---

## 🔧 Troubleshooting

### Server Won't Start?
```bash
# Check if port is busy
lsof -i :8000

# Use different port
python -m uvicorn app.main:app --reload --port 8001
```

### Import Errors?
```bash
pip install -r requirements.txt
```

### API Not Responding?
- Ensure server is running on port 8000
- Check for error messages in server terminal
- Verify TEST_PLAN.md for detailed debugging

---

## 📝 What's Working vs. Simulated

### ✅ Fully Working
- Text command processing
- LLM command parsing and routing
- Platform detection (Gmail vs Calendar)
- API endpoint responses
- State management
- Error handling

### 🎭 Mock/Simulated (Expected)
- Gmail API calls → Mock email data
- Calendar API calls → Mock event data
- Voice recording → Text input simulation
- Google AI API → Pattern-based responses (if no API key)

**This is intentional!** Mock mode allows complete testing without API keys.

---

## 🎯 Next Steps After Testing

### If All Tests Pass ✅
- ✅ Day 1 objectives complete!
- ✅ Ready for Day 2 (Google Docs + Telegram)
- ✅ Foundation is solid

### If Some Tests Fail ⚠️
1. Check the error messages in terminal output
2. Verify all dependencies are installed
3. Ensure server is running correctly
4. Review TEST_PLAN.md for detailed troubleshooting

---

## 📞 Support

**Need Help?** 
- Detailed instructions: `TEST_PLAN.md`
- Implementation details: `plan/DAY1_PLAN.md`
- Architecture overview: `PROJECT_PLAN.md`

**Quick Commands Summary:**
```bash
# Setup
python setup_test_environment.py

# Start server
python -m uvicorn app.main:app --reload --port 8000

# Test everything
python run_all_tests.py

# Individual tests
python test_voice_pipeline.py
python test_gmail_voice.py  
python test_calendar_voice.py
```

Happy testing! 🚀 