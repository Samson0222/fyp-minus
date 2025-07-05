# 🎯 Minus Voice Assistant: System Status & Features Guide

This document provides a clear overview of the **current system status**, a **complete list of available features**, and a **guide for upgrading from mock to real data**.

---

## 📊 **Current System Status (Reality Check)**

This table shows what's actually working versus what is a mock or placeholder.

| Component | Status | Real/Mock | What Works Now | Next Step to Enable |
| :--- | :--- | :--- | :--- | :--- |
| **Voice Interface** | ✅ Partial | Mock | Manual recording in `/playground` | Integrate wake word server |
| **LLM Service** | ⚠️ Mock Mode | Mock | Command parsing & routing | Configure Google API key |
| **Gmail Service** | ✅ Code Ready | Mock | Responds with **fake** emails | Complete Gmail OAuth setup |
| **Calendar Service** | ⚠️ Mock Only | Mock | Responds with **fake** events | Implement & set up Calendar API |
| **Backend APIs** | ✅ Working | Mixed | All endpoints are live | Integrate real data |

**Key Takeaway**: The entire system is **fully functional** but uses **mock data** by default for development. It's ready to be connected to real services.

---

## 🚀 **Available Voice Commands**

Here is a complete list of commands you can use right now.

### **📧 Gmail Commands (Mock Data)**

| Command Example | What It Does | Mock Response Example |
| :--- | :--- | :--- |
| **"Read my unread emails"** | Lists unread emails | "You have 3 unread emails..." |
| **"Compose email to john"** | Creates a new email draft | "Okay, I've started a draft to john."|
| **"Search emails from sarah"**| Searches for emails by sender | "I found 2 emails from sarah..." |
| **"Search for project updates"**| Searches emails by keyword | "Here are emails about project updates."|

### **📅 Calendar Commands (Mock Data)**

| Command Example | What It Does | Mock Response Example |
| :--- | :--- | :--- |
| **"What's my schedule today?"**| Shows today's events | "You have 3 events today: Standup at 9 AM..."|
| **"Create a meeting at 3 PM"**| Schedules a new event | "Event 'Meeting' has been scheduled for 3 PM." |
| **"Am I free at 2 PM?"** | Checks for availability | "You're available at 2 PM. No conflicts found."|

---

## 🧠 **LLM Intelligence: Gemma vs. Qwen**

You can choose between a free or a premium AI model.

| Feature | Gemma 3n (Free) | Qwen3 32B (Premium) |
| :--- | :--- | :--- |
| **Performance** | ✅ Good for basic commands | 🚀 Superior for complex requests |
| **Reasoning** | Standard | Advanced, context-aware |
| **Cost** | **FREE** | ~$0.20 / 1M tokens (~RM50/mo) |
| **Current Status** | **Active by default** | Available, needs API key |

**How to Switch**:
In the `backend/.env` file, change the `LLM_MODEL` variable:
```
LLM_MODEL=gemma   # For the FREE model
# LLM_MODEL=qwen    # For the enhanced PREMIUM model
```

---

## 📈 **Upgrade Path: From Mock to Real**

Follow these steps to connect the assistant to your live data.

### **Phase 1: Enable Real AI Responses (15 mins)**

This will make the assistant's responses much more intelligent than the basic mock patterns.

1.  **Get Google AI API Key**: Visit [ai.google.dev](https://ai.google.dev/) to get your free API key.
2.  **Update Environment**: In the `backend/.env` file, add your key:
    ```
    GOOGLE_API_KEY=your_google_ai_api_key_here
    ```
3.  **Restart Server**: Relaunch the backend server to apply the changes.
4.  **Result**: The assistant will now use the real Gemma 3n LLM for command parsing.

### **Phase 2: Enable Real Gmail Access (30-60 mins)**

This connects the assistant to your actual Gmail account.

1.  **Get Credentials**: Follow Google's guide to create OAuth 2.0 credentials and download the `credentials.json` file.
2.  **Place File**: Move the `credentials.json` file into the `backend/` directory.
3.  **First Run**: The first time you run a Gmail command, a browser window will open, asking you to authorize access to your Gmail account.
4.  **Result**: The application will create a `token.json` file, and subsequent commands will use your real email data.

### **Phase 3: Enable Real Calendar Access (30-60 mins)**

1.  **Implement API**: The real Google Calendar API logic needs to be implemented in `calendar_service.py` (currently placeholder).
2.  **Get Credentials**: Create and download OAuth 2.0 credentials for the Calendar API.
3.  **Authorize**: Similar to Gmail, authorize access on the first run.
4.  **Result**: The assistant will be able to read and manage your actual calendar.

---

## 🔧 **Error Handling & Troubleshooting**

-   **"Mock Response"**: This is not an error. It means the system is correctly using mock data because real API keys are not configured.
-   **"Processing Failed"**: This can happen if the LLM is unavailable or the command is too complex. Try rephrasing your command.
-   **Server Errors**: If the server fails to start, ensure you are in the `backend` directory and that port `8000` is not in use.

This guide provides a clear path from the current mock-based system to a fully functional, data-connected voice assistant. 