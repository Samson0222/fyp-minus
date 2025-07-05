# 📋 MINUS VOICE ASSISTANT - DAY 2 IMPLEMENTATION PLAN

## 🎯 **DAY 2 OBJECTIVES**

Building on Day 1's success (Voice Pipeline + Gmail + Calendar + LM Studio), Day 2 focuses on:

1. **Google Docs Integration** - Create/edit documents via voice commands
2. **Telegram Integration** - Send messages, read chats via voice commands  
3. **LangChain Agent Router** - Unified 4-platform command routing
4. **Cross-Platform Testing** - End-to-end voice command testing
5. **LM Studio Enhancement** - Leverage your local model integration

---

## 📊 **CURRENT SYSTEM STATUS**

| Component | Status | What's Working | Day 2 Goals |
|-----------|---------|----------------|-------------|
| **Voice Pipeline** | ✅ Complete | Wake word, dual input, state management | Enhance for 4 platforms |
| **LM Studio LLM** | ✅ Integrated | Local model processing | Optimize for new platforms |
| **Gmail Service** | ✅ Working | Voice commands, mock/real data | Maintain integration |
| **Calendar Service** | ✅ Working | Voice commands, mock/real data | Maintain integration |
| **Google Docs** | ❌ Missing | None | **BUILD TODAY (Smart Portal UI)** |
| **Telegram** | ❌ Missing | None | **BUILD TODAY** |
| **Agent Router** | ❌ Missing | None | **BUILD TODAY** |

---

## ⏰ **DAY 2 SCHEDULE**

### **🌅 MORNING SESSION (4 hours)**
**9:00 AM - 1:00 PM**

#### **Task 1: Google Docs "Smart Portal" Service (120 minutes)**
- **Concept:** Pivot from direct editor sync to an `iframe`-based "Smart Portal".
- **Backend:**
    - Create `backend/app/services/docs_service.py` and `routers/docs.py`.
    - Implement API endpoints for document listing (`/docs`), syncing (`/docs/sync`), and processing voice commands (`/docs/{doc_id}/process-command`).
    - Design Supabase schema for `google_docs_metadata` (tags, summaries, etc.).
- **Frontend:**
    - Design `DocsDashboard.tsx` for listing all documents.
    - Create `DocView.tsx` with an `<iframe>` for the Google Doc and an "AI Assistant Sidebar".

#### **Task 2: Telegram Service (60 minutes)**
- Create `backend/app/services/telegram_service.py`
- Implement voice commands: send messages, read chats
- Add Telegram Bot API integration
- Create `backend/app/routers/telegram.py`

#### **Task 3: LangChain Agent Router (60 minutes)**
- Create `backend/app/core/agent_router.py`
- Integrate with LM Studio LLM service
- Route commands to all 4 platforms
- Test cross-platform command routing

### **🌇 AFTERNOON SESSION (4 hours)**
**2:00 PM - 6:00 PM**

#### **Task 4: Frontend "Smart Portal" Implementation (90 minutes)**
- Build the `DocsDashboard.tsx` to list documents from the new API endpoint.
- Build the `DocView.tsx` containing the `<iframe>` and AI sidebar.
- Implement the "Command the Sidebar, Refresh the Frame" logic.

#### **Task 5: Enhanced LM Studio & Integration Testing (90 minutes)**
- Optimize LM Studio prompts for all 4 platforms, including the new Docs commands.
- Test the end-to-end flow for the Docs "Smart Portal".
- Verify cross-platform routing accuracy and error handling.

#### **Task 6: Final Polish & Documentation (60 minutes)**
- Add UI indicators for Google Docs and Telegram.
- Update voice command examples for the new Docs interaction model.
- Document the Google API scopes and Supabase schema.

---

## 🛠️ **IMPLEMENTATION DETAILS**

### **1. Google Docs "Smart Portal" Integration**

The initial concept of syncing a local text editor with the Google Docs API is fraught with complexity. We will pivot to a more robust **"Smart Portal"** UI.

**Concept:** We embed the Google Docs editor in an `<iframe>` and control it via an adjacent AI sidebar.

**Interaction Flow: "Command the Sidebar, Refresh the Frame"**
1.  **User Issues Command:** The user gives a voice command to the AI sidebar (e.g., "Summarize this document," "Add a section about Q4 projections").
2.  **Backend Processing:** The command is sent to our backend. The `DocsService` uses the Google Docs API to perform the requested action.
3.  **UI Refresh:** Upon success, the frontend reloads the `<iframe>` to show the updated document. This avoids complex state management and security issues.

#### **A. Backend (`docs_service.py` & Supabase)**

-   **Supabase Table: `google_docs_metadata`**
    -   `document_id` (PK, text), `user_id` (FK), `title` (text), `last_modified_gdrive` (timestamp), `minus_tags` (JSONB), `minus_summary` (text).

-   **API Endpoints (`routers/docs.py`)**
    -   `POST /api/v1/docs/sync`: Fetches user's Google Drive files and syncs metadata to Supabase.
    -   `GET /api/v1/docs`: Lists documents for the dashboard view from Supabase.
    -   `POST /api/v1/docs/{document_id}/process-command`: Takes a voice command, uses the LLM to interpret it, and executes it via the `DocsService`.

-   **`DocsService` Voice Commands:**
    - "Summarize this document."
    - "Find the section about the 'Q3 budget' and bold it."
    - "Create a new task from the last paragraph."
    - "Tag this document with 'Project Alpha' and 'Urgent'."

#### **B. Frontend**

-   **`DocsDashboard.tsx`:** Displays documents from `GET /api/v1/docs` with AI-powered search.
-   **`DocView.tsx`:** A two-panel layout.
    -   **Left (80%):** The `<iframe>` loading the Google Doc.
        ```tsx
        <iframe src={`https://docs.google.com/document/d/${docId}/edit?embedded=true`}></iframe>
        ```
    -   **Right (20%):** The AI Assistant Sidebar for voice/text commands.

#### **C. Required Google API Scopes**

Update Google Auth to include:
-   `https://www.googleapis.com/auth/drive.readonly` (To list files)
-   `https://www.googleapis.com/auth/documents` (To read/write content)


### **2. Telegram Service**

```python
# backend/app/services/telegram_service.py
class TelegramService:
    def __init__(self):
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.llm_service = get_llm_service()
        self.mock_mode = not self.bot_token
    
    async def process_voice_command(self, command_data: dict) -> dict:
        """Process Telegram voice commands"""
        action = command_data.get("action")
        params = command_data.get("params", {})
        
        if action == "send_message":
            return await self.send_message_voice(params)
        elif action == "read_chats":
            return await self.read_chats_voice(params)
        elif action == "join_group":
            return await self.join_group_voice(params)
        else:
            return {"error": f"Unknown Telegram action: {action}"}
```

**Voice Commands:**
- "Send a message to the team chat"
- "Read my recent messages"
- "Send a message to John saying the meeting is at 3 PM"

### **3. LangChain Agent Router**

```python
# backend/app/core/agent_router.py
class EnhancedAgentRouter:
    def __init__(self):
        self.llm_service = get_llm_service()  # LM Studio
        self.gmail_service = GmailService()
        self.calendar_service = CalendarService()
        self.docs_service = DocsService()
        self.telegram_service = TelegramService()
    
    async def route_command(self, user_input: str) -> dict:
        """Route voice command to appropriate service"""
        # Use LM Studio to parse and route
        command_data = await self.llm_service.process_command(user_input)
        platform = command_data.get("platform")
        
        if platform == "gmail":
            return await self.gmail_service.process_voice_command(command_data)
        elif platform == "calendar":
            return await self.calendar_service.process_voice_command(command_data)
        elif platform == "docs":
            return await self.docs_service.process_voice_command(command_data)
        elif platform == "telegram":
            return await self.telegram_service.process_voice_command(command_data)
        else:
            return {"error": "Could not determine platform"}
```

### **4. Enhanced LM Studio Integration**

**Updated System Prompt:**
```python
ENHANCED_SYSTEM_PROMPT = """You are Minus, a voice-controlled AI assistant for professional accessibility.

PLATFORMS & CAPABILITIES:
- Gmail: read emails, compose messages, search, organize
- Calendar: check schedule, create events, set reminders, check availability
- Google Docs: create documents, edit content, format text, collaborate
- Telegram: send messages, read chats, manage groups, forward messages

RESPONSE FORMAT:
Always respond with valid JSON:
{
    "platform": "gmail|calendar|docs|telegram|general",
    "action": "specific_action_name",
    "params": {...},
    "confidence": 0.95
}

EXAMPLES:
User: "Create a document about project planning"
Assistant: {"platform": "docs", "action": "create_document", "params": {"title": "project planning"}}

User: "Send a message to the team about the meeting"
Assistant: {"platform": "telegram", "action": "send_message", "params": {"recipient": "team", "message": "about the meeting"}}

Be precise and always return valid JSON."""
```

---

## 🧪 **TESTING STRATEGY**

### **Unit Tests**
```bash
# Test individual services
python -m pytest backend/tests/test_docs_service.py
python -m pytest backend/tests/test_telegram_service.py
python -m pytest backend/tests/test_agent_router.py
```

### **Integration Tests**
```bash
# Test cross-platform routing
python backend/tests/test_4_platform_integration.py

# Test LM Studio with all platforms
python backend/tests/test_lm_studio_routing.py
```

### **Voice Command Tests**
```bash
# Test all platforms via voice
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "Create a document about meeting notes"}'

curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "Send a message to John about the project"}'
```

---

## 📈 **SUCCESS METRICS**

### **Core Functionality**
- [ ] Google Docs voice commands working (create, read, edit)
- [ ] Telegram voice commands working (send, read, manage)
- [ ] LangChain agent routing 4 platforms correctly
- [ ] LM Studio processing all command types accurately

### **Advanced Features**
- [ ] Cross-platform command context awareness
- [ ] Error handling across all services
- [ ] Performance optimization for local LM Studio
- [ ] Unified response formatting

### **Technical Quality**
- [ ] All services integrated with voice pipeline
- [ ] Mock mode available for all platforms
- [ ] Comprehensive test coverage
- [ ] Documentation updated

---

## 🔧 **ENVIRONMENT SETUP**

### **Required Environment Variables**
```bash
# LM Studio Configuration
LLM_PROVIDER=LM_STUDIO
LM_STUDIO_API_BASE=http://localhost:1234/v1
LM_STUDIO_MODEL_NAME=your-model-name

# Google Docs API (optional for mock mode)
GOOGLE_DOCS_CREDENTIALS_PATH=credentials/docs_credentials.json

# Telegram Bot API (optional for mock mode)
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here
```

### **Dependencies**
```bash
# Install new dependencies
pip install python-telegram-bot google-api-python-client
```

---

## 🏁 **END OF DAY 2 CHECKLIST**

### **Completion Criteria**
- [ ] All 4 platforms integrated (Gmail, Calendar, Docs, Telegram)
- [ ] LangChain agent router working with LM Studio
- [ ] Voice commands routing to correct platforms
- [ ] Mock mode available for all services
- [ ] Error handling and fallbacks implemented
- [ ] Frontend updated with new platform indicators
- [ ] Comprehensive testing completed
- [ ] Performance optimization done

### **Ready for Day 3**
- [ ] End-to-end voice pipeline working
- [ ] All 4 platforms responding to voice commands
- [ ] LM Studio optimized for command routing
- [ ] Foundation ready for advanced features

---

## 🚀 **DAY 3 PREPARATION**

**Next Goals:**
- Performance evaluation and optimization
- Advanced voice features (context memory, suggestions)
- UI/UX enhancements for accessibility
- Real API integration setup guides
- User acceptance testing preparation

**Success Indicator:** 
✅ "Hey Minus, create a document about today's meeting, then send a message to the team about it, and add it to my calendar" should work seamlessly across all platforms!


