# app/main.py (Modified for frontend testing without live LLM)
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
# from openai import OpenAI # Ensure this is imported
import whisper
import shutil # For handling file uploads
import tempfile # For creating temporary files
import asyncio
from typing import Optional, List
import json
import time
import logging

# Supabase and Auth
from supabase import create_client, Client
import jwt

# Database
from app.core.database import get_database, init_database

# Gmail integration
from app.routers.gmail import router as gmail_router
from app.services.voice_email_processor import voice_email_processor

load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Minus Voice Assistant API", version="1.0.0")

# Include routers
app.include_router(gmail_router)

# CORS configuration
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",  # Vite default port
    "http://127.0.0.1:5173",  # Vite default port
    "http://localhost:8080",  # Your current port
    "http://127.0.0.1:8080"   # Your current port
]

# Add any additional CORS origins from environment
if os.getenv("CORS_ORIGINS"):
    origins.extend(os.getenv("CORS_ORIGINS").split(","))

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in origins if origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Initialize Supabase client
supabase_url = os.getenv("SUPABASE_URL")
supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")

# Improved validation to handle empty strings and None values
if supabase_url and supabase_anon_key and supabase_url.strip() and supabase_anon_key.strip():
    try:
        supabase: Client = create_client(supabase_url, supabase_anon_key)
        print("✓ Supabase client initialized")
    except Exception as e:
        print(f"⚠ Supabase initialization failed: {e}")
        print("⚠ Running in test mode without Supabase")
        supabase = None
else:
    supabase = None
    print("⚠ Supabase not configured - using test mode")

# Load the Whisper model (once, when the application starts)
# You can choose different model sizes: "tiny", "base", "small", "medium", "large"
# Smaller models are faster and use less VRAM/RAM but are less accurate.
# "base" is a good starting point for decent quality on CPU.
try:
    print("Loading local Whisper model...")
    # Default to local whisper unless explicitly disabled
    if os.getenv("USE_LOCAL_WHISPER", "true").lower() == "true":
        whisper_model = whisper.load_model("base", device="cpu")
        print("✓ Local Whisper model loaded successfully")
    else:
        whisper_model = None
        print("✓ Using OpenAI Whisper API")
except Exception as e:
    print(f"⚠ Error loading Whisper model: {e}")
    print("Falling back to simplified local whisper loading...")
    try:
        whisper_model = whisper.load_model("base")
        print("✓ Local Whisper model loaded successfully (fallback)")
    except Exception as e2:
        print(f"⚠ Fallback also failed: {e2}")
        whisper_model = None

# Pydantic models
class TextMessageRequest(BaseModel):
    message: str
    context: Optional[str] = None
    platform_context: Optional[dict] = None

class TextMessageResponse(BaseModel):
    reply: str
    actions: Optional[List[dict]] = None
    platform_updates: Optional[dict] = None

class TranscriptionRequest(BaseModel):
    # We might not need a Pydantic model if we directly use UploadFile
    pass

class TranscriptionResponse(BaseModel):
    transcribed_text: str
    confidence: Optional[float] = None

class TTSRequest(BaseModel):
    text: str
    voice_settings: Optional[dict] = None

class VoiceCommandRequest(BaseModel):
    command: str
    context: Optional[dict] = None

# Auth dependency
async def get_current_user(authorization: Optional[str] = Header(None)):
    """Extract user from Supabase JWT token"""
    if not authorization or not supabase:
        # For testing, return a test user
        return {"user_id": "test_user_001", "email": "test@example.com"}
    
    try:
        token = authorization.replace("Bearer ", "")
        # In production, you'd verify the JWT properly
        # For now, we'll implement basic auth later
        return {"user_id": "test_user_001", "email": "test@example.com"}
    except Exception as e:
        print(f"Auth error: {e}")
        return {"user_id": "test_user_001", "email": "test@example.com"}

@app.on_event("startup")
async def startup_event():
    """Initialize database connection on startup"""
    logger.info("Starting Minus Voice Assistant API...")
    await init_database()

@app.get("/")
async def root():
    return {
        "message": "Minus Voice Assistant API is running!",
        "version": "1.0.0",
        "features": {
            "voice": True,
            "supabase": supabase is not None,
            "whisper": whisper_model is not None or os.getenv("OPENAI_API_KEY") is not None
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    db = get_database()
    db_status = "connected" if await db.test_connection() else "disconnected"
    
    return {
        "status": "healthy",
        "services": {
            "supabase": db_status,
            "whisper": "local" if whisper_model else "api",
            "openai": "configured" if os.getenv("OPENAI_API_KEY") else "not_configured"
        }
    }

@app.post("/api/v1/chat/text-message", response_model=TextMessageResponse)
async def handle_text_message(
    request: TextMessageRequest,
    user = Depends(get_current_user)
):
    """Enhanced text message handling with context awareness and database storage"""
    start_time = time.time()
    
    print(f"Received message: {request.message}")
    print(f"Context: {request.context}")
    print(f"Platform context: {request.platform_context}")
    
    user_message_lower = request.message.lower()
    
    # Enhanced response logic with Gmail integration
    if "gmail" in user_message_lower or "email" in user_message_lower:
        # Process email command with voice processor
        try:
            parsed_command = voice_email_processor.parse_command(request.message)
            if parsed_command.command_type == 'read_emails':
                reply = "I'll check your emails right away!"
                actions = [{"type": "gmail", "action": "read_emails", "parameters": parsed_command.parameters}]
            elif parsed_command.command_type == 'send_email':
                reply = "I'll help you send an email!"
                actions = [{"type": "gmail", "action": "send_email", "parameters": parsed_command.parameters}]
            else:
                reply = "I can help you read emails, send emails, or search your inbox. What would you like to do?"
                actions = [{"type": "gmail", "action": "general"}]
        except Exception as e:
            reply = "I'll help you with email management. Gmail integration is ready!"
        actions = [{"type": "gmail", "action": "prepare_integration"}]
    elif "calendar" in user_message_lower or "meeting" in user_message_lower:
        reply = "I can help you manage your calendar. Google Calendar integration coming soon!"
        actions = [{"type": "calendar", "action": "prepare_integration"}]
    elif "document" in user_message_lower or "docs" in user_message_lower:
        reply = "I'll assist with document management. Google Docs integration coming soon!"
        actions = [{"type": "docs", "action": "prepare_integration"}]
    elif "telegram" in user_message_lower or "message" in user_message_lower:
        reply = "I can send messages via Telegram. Integration coming soon!"
        actions = [{"type": "telegram", "action": "prepare_integration"}]
    else:
        reply = f"I understand you said: '{request.message}'. I'm learning to help with professional tasks!"
        actions = []

    processing_time = int((time.time() - start_time) * 1000)

    # Store conversation if user is authenticated
    if user:
        try:
            db = get_database()
            session_id = f"session_{int(time.time())}"
            
            # Store user message
            await db.store_conversation(
                user_id=user["user_id"],
                session_id=session_id,
                message_type="user_text",
                content=request.message,
                metadata={
                    "context": request.context,
                    "platform_context": request.platform_context
                }
            )
            
            # Store assistant response
            await db.store_conversation(
                user_id=user["user_id"],
                session_id=session_id,
                message_type="assistant",
                content=reply,
                metadata={
                    "actions": actions,
                    "processing_time_ms": processing_time
                }
            )
            
            logger.info(f"✓ Conversation stored for user {user['user_id']}")
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")

    return TextMessageResponse(
        reply=reply,
        actions=actions,
        platform_updates={"timestamp": "2024-01-01T00:00:00Z"}
    )

@app.post("/api/v1/audio/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    user = Depends(get_current_user)
):
    """Enhanced audio transcription with OpenAI fallback and database storage"""
    start_time = time.time()

    if not audio_file:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    print(f"Received audio file: {audio_file.filename}, content type: {audio_file.content_type}")

    tmp_path = None
    try:
        # Save temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp:
            shutil.copyfileobj(audio_file.file, tmp)
            tmp_path = tmp.name
        
        # Use local Whisper model only
        if whisper_model:
            print("Using local Whisper model...")
            result = whisper_model.transcribe(tmp_path, fp16=False)
            transcribed_text = result["text"].strip()
            confidence = result.get("confidence", 0.9)
        else:
            print("⚠ Local Whisper model not available, trying to load it now...")
            try:
                # Try to load Whisper model on the fly
                temp_model = whisper.load_model("base")
                result = temp_model.transcribe(tmp_path, fp16=False)
                transcribed_text = result["text"].strip()
                confidence = result.get("confidence", 0.9)
                print("✓ Successfully used temporary Whisper model")
            except Exception as e:
                print(f"⚠ Could not load temporary Whisper model: {e}")
                raise HTTPException(status_code=500, detail="Local Whisper model not available and could not be loaded")

        processing_time = int((time.time() - start_time) * 1000)
        print(f"Transcribed text: {transcribed_text}")

        # Store transcription if user is authenticated
        if user:
            try:
                db = get_database()
                await db.store_voice_interaction(
                    user_id=user["user_id"],
                    transcribed_text=transcribed_text,
                    confidence=confidence,
                    response_text="",  # Will be filled when command is processed
                    processing_time_ms=processing_time,
                    platform_context={
                        "filename": audio_file.filename,
                        "content_type": audio_file.content_type,
                        "file_size": os.path.getsize(tmp_path) if tmp_path else 0
                    }
                )
                logger.info(f"✓ Voice interaction stored for user {user['user_id']}")
            except Exception as e:
                logger.error(f"Error storing transcription: {e}")

        return TranscriptionResponse(
            transcribed_text=transcribed_text,
            confidence=confidence
        )

    except Exception as e:
        print(f"Error during transcription: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribing audio: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f"Temporary file {tmp_path} removed.")
        await audio_file.close()

@app.post("/api/v1/audio/tts")
async def text_to_speech(
    request: TTSRequest,
    user = Depends(get_current_user)
):
    """Text-to-speech endpoint (placeholder for ElevenLabs/Google TTS)"""
    print(f"TTS request: {request.text}")
    
    # TODO: Implement actual TTS integration
    return {
        "message": "TTS integration coming soon!",
        "text": request.text,
        "voice_settings": request.voice_settings
    }

@app.post("/api/v1/voice/command")
async def process_voice_command(
    request: VoiceCommandRequest,
    user = Depends(get_current_user)
):
    """Process voice commands with platform-specific actions"""
    print(f"Voice command: {request.command}")
    
    # This will integrate with LangChain agent later
    command_lower = request.command.lower()
    
    if "read" in command_lower and "email" in command_lower:
        # Use the new Gmail voice command processor
        return {
            "action": "gmail_read",
            "status": "ready",
            "message": "I'll check your emails now.",
            "redirect": "/api/v1/gmail/voice-command",
            "command": request.command
        }
    elif "send" in command_lower and "email" in command_lower:
        return {
            "action": "gmail_send",
            "status": "ready", 
            "message": "I'll help you send an email.",
            "redirect": "/api/v1/gmail/voice-command",
            "command": request.command
        }
    elif "create" in command_lower and "document" in command_lower:
        return {
            "action": "docs_create", 
            "status": "preparing",
            "message": "Preparing to create a document..."
        }
    elif "schedule" in command_lower and "meeting" in command_lower:
        return {
            "action": "calendar_schedule",
            "status": "preparing", 
            "message": "Preparing to schedule a meeting..."
        }
    else:
        return {
            "action": "general",
            "status": "processing",
            "message": f"Processing command: {request.command}"
        }

@app.get("/api/v1/user/profile")
async def get_user_profile(user = Depends(get_current_user)):
    """Get user profile information"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        db = get_database()
        profile = await db.get_user_profile(user["user_id"])
        
        if not profile:
            # Create default profile
            profile = {
                "id": user["user_id"],
                "email": user["email"],
                "full_name": "Test User",
                "accessibility_preferences": {
                    "voice_feedback": True,
                    "high_contrast": False,
                    "large_text": False
                }
            }
        
        return profile
    except Exception as e:
        logger.error(f"Error getting user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user profile")

@app.get("/api/v1/user/interactions")
async def get_recent_interactions(user = Depends(get_current_user), limit: int = 10):
    """Get recent voice interactions for user"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        db = get_database()
        interactions = await db.get_recent_interactions(user["user_id"], limit)
        return {"interactions": interactions}
    except Exception as e:
        logger.error(f"Error getting interactions: {e}")
        raise HTTPException(status_code=500, detail="Failed to get interactions")

# WebSocket endpoint for real-time voice interaction (future)
@app.websocket("/ws/voice")
async def websocket_voice_endpoint(websocket):
    """WebSocket endpoint for real-time voice interaction"""
    # TODO: Implement WebSocket voice streaming
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)