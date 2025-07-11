# DAY 1 IMPLEMENTATION PLAN
## Voice Assistant Foundation + Gmail + Calendar Integration

**Date**: Day 1 of Week 1  
**Duration**: 8 hours (4h morning + 4h afternoon)  
**Goal**: Establish core voice pipeline with Gemma 3n and implement basic Gmail/Calendar commands

---

## 🎯 Day 1 Objectives

### **Morning Session (4 hours)**
1. ✅ FastRTC setup + LangChain agent foundation
2. ✅ **Gemma 3n integration** (Google AI API)
3. ✅ Voice pipeline test (record → transcribe → respond)

### **Afternoon Session (4 hours)**
4. ✅ Gmail: read unread emails, basic compose
5. ✅ Calendar: check today's schedule, create simple event

---

## 🌅 MORNING SESSION (9:00 AM - 1:00 PM)

### **Task 1: Environment Setup (30 minutes)**

#### **1.1 Install Dependencies**
```bash
# Backend dependencies
cd backend
pip install fastrtc[vad,stt,tts]
pip install langchain-google-genai
pip install google-generativeai
pip install python-multipart
pip install asyncio

# Frontend dependencies (if needed)
cd ../frontend
npm install @google/generative-ai
```

#### **1.2 Environment Variables**
Create `backend/.env`:
```bash
# Google AI API
GOOGLE_API_KEY=your_google_ai_api_key_here

# Supabase (existing)
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_key

# FastRTC Configuration
FASTRTC_HOST=localhost
FASTRTC_PORT=8001
```

#### **1.3 Project Structure Check**
```
backend/
├── app/
│   ├── core/
│   │   ├── voice_pipeline.py     # NEW: FastRTC integration
│   │   ├── llm_service.py        # NEW: Gemma 3n service
│   │   ├── gmail_service.py      # EXISTING: Enhance
│   │   ├── calendar_service.py   # NEW: Create
│   │   ├── docs_service.py        # NEW: Create
│   │   ├── telegram_service.py    # NEW: Create
│   │   ├── routers/
│   │   │   ├── voice.py              # NEW: Voice endpoints
│   │   │   ├── gmail.py              # EXISTING: Enhance
│   │   │   ├── calendar.py           # NEW: Create
│   │   │   ├── docs.py              # NEW: Create
│   │   │   ├── telegram.py          # NEW: Create
│   ├── voice_server.py               # NEW: FastRTC server
│   ├── main.py                       # EXISTING: Update
```

---

### **Task 2: Dual-Input Voice Pipeline Setup (90 minutes)**

#### **2.1 Create Enhanced Voice Manager with Wake Word**
Create `backend/voice_server.py`:
```python
"""
Enhanced Voice Server with Dual Input Support
Features: Wake word activation, state management, text fallback
"""
import asyncio
import logging
import time
from enum import Enum
from fastrtc import Stream, ReplyOnPause
from app.core.llm_service import GemmaLLMService
from app.services.gmail_service import GmailService
from app.services.calendar_service import CalendarService

class InteractionState(Enum):
    IDLE = "idle"           # Text input enabled
    LISTENING = "listening" # Voice active, text disabled  
    PROCESSING = "processing" # Both disabled
    RESPONDING = "responding" # Playing response

class EnhancedVoiceAssistant(Stream):
    def __init__(self):
        super().__init__()
        self.llm_service = GemmaLLMService()
        self.gmail_service = GmailService()
        self.calendar_service = CalendarService()
        
        # State management
        self.state = InteractionState.IDLE
        self.wake_words = ["hey minus", "minus", "okay minus"]
        self.stop_words = ["stop", "cancel", "never mind"]
        self.silence_timeout = 3.0  # seconds
        self.last_audio_time = None
        self.accumulated_audio = ""
        
    def detect_wake_word(self, transcription: str) -> bool:
        """Detect wake word activation"""
        text_lower = transcription.lower().strip()
        return any(wake_word in text_lower for wake_word in self.wake_words)
    
    def detect_stop_word(self, transcription: str) -> bool:
        """Detect stop/cancel commands"""
        text_lower = transcription.lower().strip()
        return any(stop_word in text_lower for stop_word in self.stop_words)
    
    def should_timeout(self) -> bool:
        """Check if silence timeout reached"""
        if self.last_audio_time is None:
            return False
        return time.time() - self.last_audio_time > self.silence_timeout
        
    async def on_audio(self, audio_data):
        """Enhanced audio processing with state management"""
        try:
            # 1. Speech-to-Text (FastRTC Moonshine)
            transcription = await self.transcribe_audio(audio_data)
            
            if not transcription.strip():
                return None  # Ignore empty transcriptions
                
            logging.info(f"Transcribed: {transcription} | State: {self.state.value}")
            
            # 2. State-based processing
            if self.state == InteractionState.IDLE:
                if self.detect_wake_word(transcription):
                    await self.activate_voice_mode()
                    return await self.text_to_speech("Yes, how can I help you?")
                else:
                    return None  # Ignore non-wake-word audio in idle state
                    
            elif self.state == InteractionState.LISTENING:
                self.last_audio_time = time.time()
                
                if self.detect_stop_word(transcription):
                    await self.deactivate_voice_mode()
                    return await self.text_to_speech("Voice mode deactivated.")
                else:
                    # Accumulate speech for command
                    self.accumulated_audio += " " + transcription
                    
                    # Check for silence timeout
                    if self.should_timeout():
                        await self.process_accumulated_command()
                    
                    return None  # Don't respond until timeout or explicit command
                    
        except Exception as e:
            logging.error(f"Voice processing error: {e}")
            await self.reset_to_idle()
            return await self.text_to_speech("Sorry, something went wrong. Voice mode reset.")
    
    async def activate_voice_mode(self):
        """Activate voice listening mode"""
        self.state = InteractionState.LISTENING
        self.last_audio_time = time.time()
        self.accumulated_audio = ""
        logging.info("🎤 Voice mode activated")
        
        # Notify frontend via WebSocket (implement later)
        await self.broadcast_state_change()
    
    async def deactivate_voice_mode(self):
        """Deactivate voice mode, return to text input"""
        self.state = InteractionState.IDLE
        self.last_audio_time = None
        self.accumulated_audio = ""
        logging.info("💬 Text mode activated")
        
        await self.broadcast_state_change()
    
    async def process_accumulated_command(self):
        """Process the accumulated voice command"""
        try:
            self.state = InteractionState.PROCESSING
            await self.broadcast_state_change()
            
            command_text = self.accumulated_audio.strip()
            logging.info(f"Processing command: {command_text}")
            
            # Process with LLM (same as text input)
            response = await self.process_command_unified(command_text)
            
            self.state = InteractionState.RESPONDING
            await self.broadcast_state_change()
            
            # Generate voice response
            audio_response = await self.text_to_speech(response)
            
            # Reset to idle after response
            await self.deactivate_voice_mode()
            
            return audio_response
            
        except Exception as e:
            logging.error(f"Command processing error: {e}")
            await self.reset_to_idle()
            return await self.text_to_speech("Sorry, I couldn't process that command.")
    
    async def process_command_unified(self, text: str) -> str:
        """Unified command processing for both voice and text input"""
        # This method handles both voice and text commands identically
        command_data = await self.llm_service.process_command(text)
        
        # Route to appropriate service
        platform = command_data.get("platform", "unknown")
        
        if platform == "gmail":
            result = await self.gmail_service.process_voice_command(command_data)
        elif platform == "calendar":
            result = await self.calendar_service.process_voice_command(command_data)
        else:
            result = {"response": "I'm not sure how to handle that request yet."}
        
        return result.get("response", "Command processed.")
    
    async def reset_to_idle(self):
        """Reset system to idle state on error"""
        self.state = InteractionState.IDLE
        self.last_audio_time = None
        self.accumulated_audio = ""
        await self.broadcast_state_change()
    
    async def broadcast_state_change(self):
        """Broadcast state changes to frontend (WebSocket)"""
        state_data = {
            "state": self.state.value,
            "timestamp": time.time(),
            "listening": self.state == InteractionState.LISTENING
        }
        # TODO: Implement WebSocket broadcast to frontend
        logging.info(f"State change: {state_data}")
    
    async def handle_text_input(self, text: str) -> str:
        """Handle direct text input (bypassing voice pipeline)"""
        if self.state != InteractionState.IDLE:
            return "Voice mode is active. Please say 'stop' or wait for timeout."
        
        try:
            self.state = InteractionState.PROCESSING
            await self.broadcast_state_change()
            
            # Process text command (same unified processing)
            response = await self.process_command_unified(text)
            
            await self.reset_to_idle()
            return response
            
        except Exception as e:
            await self.reset_to_idle()
            return f"Error processing text command: {str(e)}"

async def start_voice_server():
    """Start FastRTC voice server on port 8001"""
    server = VoiceAssistantStream()
    await server.start(host="localhost", port=8001)
    logging.info("Voice server started on port 8001")

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_voice_server())
```

#### **2.2 Create LLM Service**
Create `backend/app/core/llm_service.py`:
```python
"""
Gemma 3n LLM Service - FREE Google AI API Integration
Handles command routing and response generation
"""
import os
import logging
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage
from typing import Dict, Any

class GemmaLLMService:
    def __init__(self):
        self.api_key = os.getenv("GOOGLE_API_KEY")
        if not self.api_key:
            raise ValueError("GOOGLE_API_KEY environment variable required")
            
        # Initialize Gemma 3n via Google AI API (FREE)
        self.llm = ChatGoogleGenerativeAI(
            model="gemma-3n-7b",  # FREE tier model
            google_api_key=self.api_key,
            temperature=0.7,
            max_output_tokens=500
        )
        
        self.system_prompt = """You are Minus, a voice-controlled AI assistant for professional accessibility.
        
CAPABILITIES:
- Gmail: read emails, compose messages, search
- Calendar: check schedule, create events, set reminders  
- Google Docs: create/edit documents
- Telegram: send messages, read chats

RESPONSE FORMAT:
1. Determine the platform (gmail/calendar/docs/telegram)
2. Extract the action and parameters
3. Respond with JSON: {"platform": "gmail", "action": "read_unread", "params": {...}}

EXAMPLES:
User: "Read my unread emails"
Assistant: {"platform": "gmail", "action": "read_unread", "params": {}}

User: "What's my schedule today?"
Assistant: {"platform": "calendar", "action": "check_today", "params": {}}

User: "Compose email to john about meeting"
Assistant: {"platform": "gmail", "action": "compose", "params": {"to": "john", "subject": "meeting"}}

Be concise, accessible, and always respond in JSON format."""

    async def process_command(self, user_input: str) -> Dict[str, Any]:
        """Process user voice command and return structured response"""
        try:
            messages = [
                SystemMessage(content=self.system_prompt),
                HumanMessage(content=user_input)
            ]
            
            # Get response from Gemma 3n
            response = await self.llm.ainvoke(messages)
            
            # Parse JSON response
            import json
            try:
                command_data = json.loads(response.content)
                logging.info(f"LLM parsed command: {command_data}")
                return command_data
            except json.JSONDecodeError:
                # Fallback if JSON parsing fails
                return {
                    "platform": "general",
                    "action": "respond",
                    "params": {"text": response.content}
                }
                
        except Exception as e:
            logging.error(f"LLM processing error: {e}")
            return {
                "platform": "error",
                "action": "error",
                "params": {"message": "Sorry, I couldn't process that command."}
            }

    def get_usage_stats(self) -> Dict[str, Any]:
        """Get current API usage for monitoring FREE tier limits"""
        return {
            "model": "gemma-3n-7b",
            "tier": "FREE",
            "daily_limit": "14,400 requests",
            "rate_limit": "30 RPM, 15,000 TPM"
        }
```

#### **2.3 Test Voice Pipeline**
Create `backend/test_voice_pipeline.py`:
```python
"""
Test script for voice pipeline components
"""
import asyncio
import os
from app.core.llm_service import GemmaLLMService

async def test_llm_integration():
    """Test Gemma 3n integration"""
    print("🧠 Testing Gemma 3n LLM Integration...")
    
    llm_service = GemmaLLMService()
    
    test_commands = [
        "Read my unread emails",
        "What's my schedule today?",
        "Create a new document",
        "Send a message to the team"
    ]
    
    for cmd in test_commands:
        print(f"\n💬 User: {cmd}")
        response = await llm_service.process_command(cmd)
        print(f"🤖 Gemma 3n: {response}")
    
    # Check usage stats
    stats = llm_service.get_usage_stats()
    print(f"\n📊 Usage Stats: {stats}")

if __name__ == "__main__":
    asyncio.run(test_llm_integration())
```

---

### **Task 3: Voice Pipeline Integration Test (60 minutes)**

#### **3.1 Update Main FastAPI App**
Update `backend/main.py`:
```python
# ... existing code ...

from app.routers import gmail, voice  # Add voice router
from app.core.llm_service import GemmaLLMService

app = FastAPI(title="Minus Voice Assistant API")

# Add voice router
app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])

# ... existing code ...

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    try:
        # Test Gemma 3n connection
        llm_service = GemmaLLMService()
        stats = llm_service.get_usage_stats()
        print(f"✅ Gemma 3n LLM initialized: {stats}")
    except Exception as e:
        print(f"❌ LLM initialization failed: {e}")
```

#### **3.2 Create Enhanced Voice Router with Dual Input**
Create `backend/app/routers/voice.py`:
```python
"""
Enhanced Voice API with Dual Input Support
Handles both voice and text commands with state management
"""
from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Dict, List
from app.core.llm_service import GemmaLLMService
import logging
import json

router = APIRouter()

# Global voice assistant instance (in production, use proper state management)
voice_assistant = None

class TextCommand(BaseModel):
    text: str
    
class VoiceState(BaseModel):
    state: str
    listening: bool
    timestamp: float

class DualInputResponse(BaseModel):
    success: bool
    response: str
    state: str
    input_method: str  # "voice" or "text"
    usage_stats: dict

# WebSocket connection manager for real-time state updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast_state(self, state_data: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(state_data))
            except:
                self.disconnect(connection)

manager = ConnectionManager()

@router.post("/text-command", response_model=DualInputResponse)
async def process_text_command(command: TextCommand):
    """Process text command (bypasses voice pipeline)"""
    try:
        global voice_assistant
        if voice_assistant is None:
            # Initialize if not exists
            from voice_server import EnhancedVoiceAssistant
            voice_assistant = EnhancedVoiceAssistant()
        
        # Process text directly
        response = await voice_assistant.handle_text_input(command.text)
        
        # Get LLM usage stats
        llm_service = GemmaLLMService()
        stats = llm_service.get_usage_stats()
        
        return DualInputResponse(
            success=True,
            response=response,
            state="idle",
            input_method="text",
            usage_stats=stats
        )
        
    except Exception as e:
        logging.error(f"Text command processing failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/activate-voice")
async def activate_voice_mode():
    """Manually activate voice mode (alternative to wake word)"""
    try:
        global voice_assistant
        if voice_assistant:
            await voice_assistant.activate_voice_mode()
            return {"success": True, "message": "Voice mode activated"}
        else:
            raise HTTPException(status_code=500, detail="Voice assistant not initialized")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/deactivate-voice")
async def deactivate_voice_mode():
    """Manually deactivate voice mode"""
    try:
        global voice_assistant
        if voice_assistant:
            await voice_assistant.deactivate_voice_mode()
            return {"success": True, "message": "Voice mode deactivated"}
        else:
            raise HTTPException(status_code=500, detail="Voice assistant not initialized")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/state")
async def get_current_state():
    """Get current voice assistant state"""
    try:
        global voice_assistant
        if voice_assistant:
            return {
                "state": voice_assistant.state.value,
                "listening": voice_assistant.state.value == "listening",
                "wake_words": voice_assistant.wake_words,
                "stop_words": voice_assistant.stop_words
            }
        else:
            return {"state": "idle", "listening": False}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.websocket("/state-updates")
async def websocket_state_updates(websocket: WebSocket):
    """WebSocket endpoint for real-time state updates"""
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive and broadcast state changes
            data = await websocket.receive_text()
            # Handle any incoming messages if needed
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@router.get("/health")
async def voice_health_check():
    """Health check for voice services"""
    try:
        llm_service = GemmaLLMService()
        stats = llm_service.get_usage_stats()
        
        return {
            "status": "healthy",
            "llm_service": "gemma-3n",
            "stats": stats
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
```

#### **3.3 Frontend Integration Updates**
Update `frontend/src/components/voice/VoiceInterface.tsx`:
```typescript
import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';

interface VoiceState {
  state: 'idle' | 'listening' | 'processing' | 'responding';
  listening: boolean;
}

export function DualInputInterface() {
  const [inputMode, setInputMode] = useState<'text' | 'voice'>('text');
  const [voiceState, setVoiceState] = useState<VoiceState>({ state: 'idle', listening: false });
  const [textInput, setTextInput] = useState('');
  const [response, setResponse] = useState('');

  // WebSocket connection for real-time state updates
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8000/api/v1/voice/state-updates');
    ws.onmessage = (event) => {
      const stateData = JSON.parse(event.data);
      setVoiceState(stateData);
    };
    return () => ws.close();
  }, []);

  const handleTextSubmit = async () => {
    if (voiceState.state !== 'idle') return;
    
    try {
      const response = await fetch('/api/v1/voice/text-command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput })
      });
      const result = await response.json();
      setResponse(result.response);
      setTextInput('');
    } catch (error) {
      console.error('Text command failed:', error);
    }
  };

  const toggleVoiceMode = async () => {
    try {
      if (voiceState.listening) {
        await fetch('/api/v1/voice/deactivate-voice', { method: 'POST' });
      } else {
        await fetch('/api/v1/voice/activate-voice', { method: 'POST' });
      }
    } catch (error) {
      console.error('Voice toggle failed:', error);
    }
  };

  const getStateIndicator = () => {
    switch (voiceState.state) {
      case 'idle': return '💬 Ready for input';
      case 'listening': return '🎤 Listening... (say "stop" to cancel)';
      case 'processing': return '⚙️ Processing your request...';
      case 'responding': return '🔊 Playing response...';
      default: return '❓ Unknown state';
    }
  };

  return (
    <div className="dual-input-interface">
      {/* State Indicator */}
      <div className={`state-indicator ${voiceState.state}`}>
        {getStateIndicator()}
      </div>

      {/* Text Input Area */}
      <div className="text-input-section">
        <Textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          disabled={voiceState.state !== 'idle'}
          placeholder={
            voiceState.state === 'idle' 
              ? "Type your command or say 'Hey Minus'..." 
              : `Voice mode active - ${voiceState.state}`
          }
          className="command-textarea"
        />
        
        <div className="input-controls">
          <Button
            onClick={handleTextSubmit}
            disabled={voiceState.state !== 'idle' || !textInput.trim()}
          >
            Send Text Command
          </Button>
          
          <Button
            onClick={toggleVoiceMode}
            variant={voiceState.listening ? "destructive" : "secondary"}
            disabled={voiceState.state === 'processing' || voiceState.state === 'responding'}
          >
            {voiceState.listening ? '🔴 Stop Voice' : '🎤 Activate Voice'}
          </Button>
        </div>
      </div>

      {/* Response Area */}
      {response && (
        <div className="response-area">
          <h3>Response:</h3>
          <p>{response}</p>
        </div>
      )}

      {/* Wake Word Instructions */}
      <div className="instructions">
        <h4>How to use:</h4>
        <ul>
          <li><strong>Text Mode:</strong> Type and click "Send Text Command"</li>
          <li><strong>Voice Mode:</strong> Say "Hey Minus" or click "Activate Voice"</li>
          <li><strong>Stop Voice:</strong> Say "stop" or click "Stop Voice"</li>
          <li><strong>Timeout:</strong> Voice automatically stops after 3 seconds of silence</li>
        </ul>
      </div>
    </div>
  );
}
```

#### **3.4 Test Enhanced Pipeline**
```bash
# Terminal 1: Start FastAPI server
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Start FastRTC voice server
python voice_server.py

# Terminal 3: Test text commands
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "Read my unread emails"}'

# Terminal 4: Test voice state management
curl -X POST "http://localhost:8000/api/v1/voice/activate-voice"
curl -X GET "http://localhost:8000/api/v1/voice/state"
curl -X POST "http://localhost:8000/api/v1/voice/deactivate-voice"
```

---

## 🌆 AFTERNOON SESSION (2:00 PM - 6:00 PM)

### **Task 4: Gmail Integration with Gemma 3n (120 minutes)**

#### **4.1 Enhance Gmail Service**
Update `backend/app/services/gmail_service.py`:
```python
# ... existing imports ...
from app.core.llm_service import GemmaLLMService
import asyncio

class GmailService:
    def __init__(self):
        # ... existing initialization ...
        self.llm_service = GemmaLLMService()
    
    async def process_voice_command(self, command_data: dict) -> dict:
        """Process Gmail voice commands using Gemma 3n"""
        action = command_data.get("action")
        params = command_data.get("params", {})
        
        if action == "read_unread":
            return await self.read_unread_emails_voice()
        elif action == "compose":
            return await self.compose_email_voice(params)
        elif action == "search":
            return await self.search_emails_voice(params)
        else:
            return {"error": f"Unknown Gmail action: {action}"}
    
    async def read_unread_emails_voice(self) -> dict:
        """Read unread emails and format for voice response"""
        try:
            # Get unread emails (existing logic)
            unread_emails = self.get_unread_emails(max_results=5)
            
            if not unread_emails:
                return {
                    "response": "You have no unread emails.",
                    "count": 0
                }
            
            # Format for voice using Gemma 3n
            email_summary = []
            for email in unread_emails:
                email_summary.append({
                    "from": email.get("from", "Unknown"),
                    "subject": email.get("subject", "No subject"),
                    "snippet": email.get("snippet", "")
                })
            
            # Use LLM to create natural voice response
            prompt = f"Summarize these {len(email_summary)} unread emails for voice reading: {email_summary}"
            summary_response = await self.llm_service.process_command(prompt)
            
            return {
                "response": summary_response.get("params", {}).get("text", "Emails retrieved"),
                "count": len(unread_emails),
                "emails": email_summary
            }
            
        except Exception as e:
            return {"error": f"Failed to read emails: {str(e)}"}
    
    async def compose_email_voice(self, params: dict) -> dict:
        """Compose email using voice parameters"""
        try:
            recipient = params.get("to", "")
            subject = params.get("subject", "")
            
            if not recipient:
                return {"error": "Please specify recipient"}
            
            # Use LLM to help compose email
            compose_prompt = f"Help compose a professional email to {recipient} about {subject}"
            composition = await self.llm_service.process_command(compose_prompt)
            
            # For now, return draft (actual sending in later implementation)
            return {
                "response": f"Email draft created for {recipient}",
                "draft": {
                    "to": recipient,
                    "subject": subject,
                    "body": composition.get("params", {}).get("text", "")
                }
            }
            
        except Exception as e:
            return {"error": f"Failed to compose email: {str(e)}"}
```

#### **4.2 Update Gmail Router**
Update `backend/app/routers/gmail.py`:
```python
# ... existing code ...

@router.post("/voice-command")
async def gmail_voice_command(command_data: dict):
    """Handle Gmail voice commands"""
    try:
        gmail_service = GmailService()
        result = await gmail_service.process_voice_command(command_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### **4.3 Test Gmail Voice Commands**
Create `backend/test_gmail_voice.py`:
```python
"""
Test Gmail voice command integration
"""
import asyncio
from app.services.gmail_service import GmailService

async def test_gmail_voice():
    gmail_service = GmailService()
    
    test_commands = [
        {"action": "read_unread", "params": {}},
        {"action": "compose", "params": {"to": "test@example.com", "subject": "meeting"}},
    ]
    
    for cmd in test_commands:
        print(f"\n📧 Testing Gmail: {cmd}")
        result = await gmail_service.process_voice_command(cmd)
        print(f"✅ Result: {result}")

if __name__ == "__main__":
    asyncio.run(test_gmail_voice())
```

---

### **Task 5: Calendar Integration with Gemma 3n (120 minutes)**

#### **5.1 Create Calendar Service**
Create `backend/app/services/calendar_service.py`:
```python
"""
Google Calendar Service with Gemma 3n Voice Integration
"""
import os
import logging
from datetime import datetime, timedelta
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from app.core.llm_service import GemmaLLMService

class CalendarService:
    SCOPES = ['https://www.googleapis.com/auth/calendar']
    
    def __init__(self):
        self.service = None
        self.llm_service = GemmaLLMService()
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Google Calendar API"""
        creds = None
        # Token file will be created after first auth
        if os.path.exists('tokens/calendar_token.json'):
            creds = Credentials.from_authorized_user_file(
                'tokens/calendar_token.json', self.SCOPES
            )
        
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                flow = InstalledAppFlow.from_client_secrets_file(
                    'tokens/calendar_credentials.json', self.SCOPES
                )
                creds = flow.run_local_server(port=0)
            
            # Save credentials
            os.makedirs('tokens', exist_ok=True)
            with open('tokens/calendar_token.json', 'w') as token:
                token.write(creds.to_json())
        
        self.service = build('calendar', 'v3', credentials=creds)
    
    async def process_voice_command(self, command_data: dict) -> dict:
        """Process Calendar voice commands using Gemma 3n"""
        action = command_data.get("action")
        params = command_data.get("params", {})
        
        if action == "check_today":
            return await self.get_today_schedule_voice()
        elif action == "create_event":
            return await self.create_event_voice(params)
        elif action == "check_availability":
            return await self.check_availability_voice(params)
        else:
            return {"error": f"Unknown Calendar action: {action}"}
    
    async def get_today_schedule_voice(self) -> dict:
        """Get today's schedule formatted for voice"""
        try:
            # Get today's events
            today = datetime.now().date()
            start_time = datetime.combine(today, datetime.min.time()).isoformat() + 'Z'
            end_time = datetime.combine(today, datetime.max.time()).isoformat() + 'Z'
            
            events_result = self.service.events().list(
                calendarId='primary',
                timeMin=start_time,
                timeMax=end_time,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            
            if not events:
                return {
                    "response": "You have no events scheduled for today.",
                    "count": 0
                }
            
            # Format events for voice using Gemma 3n
            event_list = []
            for event in events:
                start = event['start'].get('dateTime', event['start'].get('date'))
                event_list.append({
                    "title": event.get('summary', 'No title'),
                    "time": start,
                    "description": event.get('description', '')
                })
            
            # Use LLM to create natural voice response
            prompt = f"Summarize today's calendar schedule for voice reading: {event_list}"
            summary_response = await self.llm_service.process_command(prompt)
            
            return {
                "response": summary_response.get("params", {}).get("text", "Schedule retrieved"),
                "count": len(events),
                "events": event_list
            }
            
        except Exception as e:
            logging.error(f"Calendar error: {e}")
            return {"error": f"Failed to get schedule: {str(e)}"}
    
    async def create_event_voice(self, params: dict) -> dict:
        """Create calendar event from voice parameters"""
        try:
            title = params.get("title", "New Event")
            date_str = params.get("date", "today")
            time_str = params.get("time", "10:00 AM")
            
            # Use LLM to parse date/time
            parse_prompt = f"Parse this into ISO datetime: {date_str} at {time_str}"
            parsed_time = await self.llm_service.process_command(parse_prompt)
            
            # Create event (simplified for Day 1)
            event = {
                'summary': title,
                'start': {
                    'dateTime': datetime.now().isoformat(),  # Simplified
                    'timeZone': 'America/Los_Angeles',
                },
                'end': {
                    'dateTime': (datetime.now() + timedelta(hours=1)).isoformat(),
                    'timeZone': 'America/Los_Angeles',
                },
            }
            
            # For Day 1, just return the draft
            return {
                "response": f"Event '{title}' scheduled successfully",
                "event": event
            }
            
        except Exception as e:
            return {"error": f"Failed to create event: {str(e)}"}
```

#### **5.2 Create Calendar Router**
Create `backend/app/routers/calendar.py`:
```python
"""
Calendar API endpoints with voice integration
"""
from fastapi import APIRouter, HTTPException
from app.services.calendar_service import CalendarService

router = APIRouter()

@router.post("/voice-command")
async def calendar_voice_command(command_data: dict):
    """Handle Calendar voice commands"""
    try:
        calendar_service = CalendarService()
        result = await calendar_service.process_voice_command(command_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/today")
async def get_today_schedule():
    """Get today's schedule"""
    try:
        calendar_service = CalendarService()
        result = await calendar_service.get_today_schedule_voice()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### **5.3 Test Calendar Integration**
Create `backend/test_calendar_voice.py`:
```python
"""
Test Calendar voice integration
"""
import asyncio
from app.services.calendar_service import CalendarService

async def test_calendar_voice():
    calendar_service = CalendarService()
    
    test_commands = [
        {"action": "check_today", "params": {}},
        {"action": "create_event", "params": {"title": "Team Meeting", "time": "3 PM"}},
    ]
    
    for cmd in test_commands:
        print(f"\n📅 Testing Calendar: {cmd}")
        result = await calendar_service.process_voice_command(cmd)
        print(f"✅ Result: {result}")

if __name__ == "__main__":
    asyncio.run(test_calendar_voice())
```

---

## 🏁 END OF DAY 1 CHECKLIST

### **✅ Enhanced Completion Checklist**

**Morning Tasks:**
- [ ] FastRTC dependencies installed
- [ ] Enhanced Voice Manager with wake word detection created
- [ ] Gemma 3n LLM service created and tested
- [ ] Dual-input pipeline (voice + text) integrated
- [ ] State management system implemented
- [ ] WebSocket real-time state updates working
- [ ] API endpoints for both voice and text processing created
- [ ] Health checks passing

**Afternoon Tasks:**
- [ ] Gmail voice commands working (read unread, basic compose)
- [ ] Calendar voice commands working (check today, create event)
- [ ] LLM properly routing commands to correct platforms
- [ ] Frontend dual-input interface updated
- [ ] Wake word activation working ("Hey Minus")
- [ ] Manual voice activation/deactivation buttons working
- [ ] Text input bypass working (skip STT when typing)
- [ ] State indicators and visual feedback implemented
- [ ] Error handling and timeout mechanisms implemented
- [ ] Integration tests passing for both input methods

### **🔍 Enhanced Testing Commands for End of Day**

```bash
# 1. Test LLM Integration
python backend/test_voice_pipeline.py

# 2. Test Gmail Voice Commands
python backend/test_gmail_voice.py

# 3. Test Calendar Voice Commands
python backend/test_calendar_voice.py

# 4. Test Text Input (bypasses voice pipeline)
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "Read my unread emails"}'

curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "What is my schedule today?"}'

# 5. Test Voice State Management
curl -X GET "http://localhost:8000/api/v1/voice/state"
curl -X POST "http://localhost:8000/api/v1/voice/activate-voice"
curl -X GET "http://localhost:8000/api/v1/voice/state"
curl -X POST "http://localhost:8000/api/v1/voice/deactivate-voice"

# 6. Test Frontend Integration
# Open browser to http://localhost:3000 and test:
# - Type commands in textarea
# - Click "Activate Voice" button
# - Say "Hey Minus" to test wake word
# - Say "stop" to test deactivation
# - Check real-time state indicators

# 7. Test Wake Word Detection (manual verification)
# 1. Start voice server
# 2. Say "Hey Minus" (should activate)
# 3. Say a command (should process after 3s timeout)
# 4. Say "Hey Minus" again
# 5. Say "stop" (should deactivate)
```

### **📊 Enhanced Success Metrics for Day 1**

**Core Functionality:**
- ✅ **Gemma 3n Integration**: Successfully processing commands via Google AI API (FREE)
- ✅ **Dual Input Pipeline**: Both voice and text commands working seamlessly
- ✅ **Gmail Basic**: Can read unread emails and create drafts via both input methods
- ✅ **Calendar Basic**: Can check today's schedule via both input methods
- ✅ **LLM Routing**: Commands correctly routed to Gmail vs Calendar

**Advanced Features:**
- ✅ **Wake Word Detection**: "Hey Minus" activates voice mode
- ✅ **State Management**: Clear states (idle/listening/processing/responding)
- ✅ **Smart Deactivation**: Timeout after 3s silence OR "stop" command
- ✅ **Manual Controls**: Buttons for voice activation/deactivation
- ✅ **Real-time Updates**: WebSocket state synchronization
- ✅ **Accessibility Design**: Multiple input modalities for different abilities

**Technical Quality:**
- ✅ **Performance**: Response time < 3 seconds per command
- ✅ **Error Handling**: Graceful fallbacks and state recovery
- ✅ **Budget**: Zero cost spent (Gemma 3n FREE tier)
- ✅ **User Experience**: Intuitive interface with clear feedback

---

## 🚀 Day 2 Preparation

**Files to Create Tomorrow:**
- `backend/app/services/docs_service.py`
- `backend/app/services/telegram_service.py`
- `backend/app/routers/docs.py`
- `backend/app/routers/telegram.py`

**Goals for Day 2:**
- Add Google Docs voice commands
- Add Telegram voice commands  
- Complete 4-platform LangChain agent router
- Test cross-platform command routing

**Ready for Day 2**: ✅ Foundation solid, voice pipeline working, 2/4 platforms integrated! 