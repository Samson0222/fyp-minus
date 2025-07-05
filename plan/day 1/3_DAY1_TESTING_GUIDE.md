# 🧪 DAY 1 TESTING & VALIDATION GUIDE

This document provides a complete guide for testing all functionality implemented on Day 1.

## 🚀 **Quick Start Testing (5-Minute Verification)**

This will run all automated tests and verify the core functionality.

### **1. Environment Setup**

Make sure all dependencies are installed and the environment is configured.

```bash
cd backend
# This script checks Python version, installs dependencies, and creates a mock .env file.
python tests/setup_test_environment.py
```

### **2. Start the Server**

In your first terminal, start the FastAPI server.

```bash
# Still inside the backend/ directory
python -m uvicorn app.main:app --reload --port 8000
```

### **3. Run the Automated Test Suite**

In a second terminal, run the main test script.

```bash
cd backend
python tests/run_all_tests.py
```

**Expected Output**:
```
🧪 AUTOMATED TEST SUITE
Voice Pipeline Integration Test: ✅ PASS
Gmail Voice Integration Test: ✅ PASS
Calendar Voice Integration Test: ✅ PASS

🧪 API ENDPOINT TESTS
Health: ✅ PASS
... (all other API tests passing) ...

🎉 ALL TESTS PASSED!
```
If all tests pass, the Day 1 implementation is considered stable and correct.

---

## 🔗 **Manual API Endpoint Testing**

You can use `curl` to manually test each API endpoint.

### **1. Health Check**

Verify that the service is running and healthy.

```bash
curl http://localhost:8000/api/v1/voice/health
```
-   **Expected**: `{"status": "healthy", "llm_service": "...", "voice_state": "idle"}`

### **2. Text Command - Gmail**

Test sending a text-based command for Gmail.

```bash
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Read my unread emails"}'
```
-   **Expected**: A JSON response with `success: true` and a mock response listing 3 emails.

### **3. Text Command - Calendar**

Test sending a text-based command for the Calendar.

```bash
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "What is my schedule today?"}'
```
-   **Expected**: A JSON response with `success: true` and a mock response listing 3 calendar events.

### **4. Voice State Management**

Test the manual activation and deactivation of the voice listening state.

```bash
# 1. Check initial state (should be "idle")
curl http://localhost:8000/api/v1/voice/state

# 2. Activate voice mode
curl -X POST http://localhost:8000/api/v1/voice/activate-voice

# 3. Check again (should be "listening")
curl http://localhost:8000/api/v1/voice/state

# 4. Deactivate voice mode
curl -X POST http://localhost:8000/api/v1/voice/deactivate-voice
```

---

## ✅ **Functionality Validation Checklist**

Use this checklist to manually verify the quality and correctness of the features.

### **Command Recognition**
-   [ ] **Gmail Commands**: Does "Read my emails" correctly route to the `gmail` platform?
-   [ ] **Calendar Commands**: Does "What's my schedule?" correctly route to `calendar`?
-   [ ] **Command Variations**: Does "Check my inbox" give the same result as "Read my emails"?
-   [ ] **Unknown Commands**: Does "Turn on the lights" result in a helpful error message?

### **Response Quality**
-   [ ] **Natural Language**: Do responses sound conversational and helpful?
-   [ ] **Contextual**: Does the response for "Compose email to john" mention "john"?
-   [ ] **Consistent**: Does the same command produce a similar quality response each time?

### **Performance**
-   [ ] **Response Time**: Do all API commands return in under 3 seconds?
-   [ ] **Stability**: Does the server remain stable after 20+ rapid requests?

### **Mock Data Verification**
-   [ ] **Is it Mock?**: Confirm that the emails and calendar events returned are the pre-defined mock data, not your personal data. This is the **correct behavior** for now.
-   [ ] **Quality**: Is the mock data realistic and useful for testing?

---

## 🔧 **Troubleshooting**

-   **Server Won't Start**: Make sure you are in the `backend` directory. Check for error messages related to port 8000 being in use.
-   **Import Errors**: Run `pip install -r requirements.txt` to ensure all dependencies are installed.
-   **Tests Failing**: Check the terminal output for specific error messages. Ensure the server is running before you execute the test suite.
-   **"Mock response"**: This is **expected behavior** if you haven't configured your API keys. The system is designed to work this way for development. 