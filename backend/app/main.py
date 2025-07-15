# app/main.py (Modified for frontend testing without live LLM)
import os
from dotenv import load_dotenv

# Load environment variables from .env file FIRST.
# This is crucial so that all modules have access to them upon import.
load_dotenv()

from fastapi import FastAPI, HTTPException, UploadFile, File, Depends, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
# import whisper
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
from app.core.database import get_database, supabase_manager

# WebSocket Connection Manager
from app.websockets import ConnectionManager

# Gmail integration
from app.routers.gmail import router as gmail_router
from app.services.voice_email_processor import voice_email_processor

# Voice integration
# from app.routers.voice import router as voice_router, get_llm_service_dependency
from app.core.llm_factory import get_llm_service
from app.core.llm_base import AbstractLLMService

# Add Calendar router import
from app.routers.calendar import router as calendar_router

# Add Auth router import
from app.routers.auth import router as auth_router

# Add Webhooks router import
from app.routers.webhooks import router as webhooks_router

# Add Google Docs router import
from app.routers.docs import router as docs_router

# Add Mission Control router import
from app.routers.mission_control import router as mission_control_router

# Add Telegram router import
from app.routers.telegram import router as telegram_router

# Add Assistant router import
from app.routers.assistant import router as assistant_router

# Configure logging
# logging.basicConfig(level=logging.INFO) # This is now handled by setup_logging
logger = logging.getLogger(__name__)

app = FastAPI(title="Minus Voice Assistant API", version="1.0.0")
manager = ConnectionManager()

# Include routers
app.include_router(gmail_router)
app.include_router(calendar_router)  # 📅 Calendar endpoints
app.include_router(auth_router)      # 🔐 Authentication endpoints

app.include_router(webhooks_router)  # 🎣 Webhooks for real-time sync
app.include_router(docs_router)      # 📄 Google Docs endpoints
app.include_router(mission_control_router)  # 🎛️ Mission Control endpoints
app.include_router(telegram_router)  # 📱 Telegram integration endpoints
# app.include_router(voice_router, prefix="/api/v1/voice", tags=["voice"])
app.include_router(assistant_router, prefix="/api/v1/assistant", tags=["assistant"])

# Global variable to hold the LLM service instance
llm_service: Optional[AbstractLLMService] = None

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

# Legacy anonymous Supabase client initialization removed. The backend now uses
# the centralized `SupabaseManager` (service-role key) exclusively.
supabase = None  # Placeholder to satisfy any residual references

# # Load the Whisper model (once, when the application starts)
# # You can choose different model sizes: "tiny", "base", "small", "medium", "large"
# # Smaller models are faster and use less VRAM/RAM but are less accurate.
# # "base" is a good starting point for decent quality on CPU.
# try:
#     print("Loading local Whisper model...")
#     # Default to local whisper unless explicitly disabled
#     if os.getenv("USE_LOCAL_WHISPER", "true").lower() == "true":
#         whisper_model = whisper.load_model("base", device="cpu")
#         print("✓ Local Whisper model loaded successfully")
#     else:
#         whisper_model = None
#         print("✓ Using OpenAI Whisper API")
# except Exception as e:
#     print(f"⚠ Error loading Whisper model: {e}")
#     print("Falling back to simplified local whisper loading...")
#     try:
#         whisper_model = whisper.load_model("base")
#         print("✓ Local Whisper model loaded successfully (fallback)")
#     except Exception as e2:
#         print(f"⚠ Fallback also failed: {e2}")
#         whisper_model = None

# You should also set whisper_model to None so other parts of the app don't fail
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
        # This UUID must match a real user in the Supabase `auth.users` table.
        return {"user_id": "cbede3b0-2f68-47df-9c26-09a46e588567", "email": "test@example.com"}
    
    try:
        token = authorization.replace("Bearer ", "")
        # In production, you'd verify the JWT properly
        # For now, we'll implement basic auth later
        return {"user_id": "cbede3b0-2f68-47df-9c26-09a46e588567", "email": "test@example.com"}
    except Exception as e:
        print(f"Auth error: {e}")
        return {"user_id": "cbede3b0-2f68-47df-9c26-09a46e588567", "email": "test@example.com"}

def get_llm_service_instance() -> AbstractLLMService:
    """Dependency injector for the LLM service"""
    if llm_service is None:
        raise HTTPException(
            status_code=503, 
            detail="LLM Service not available. Check server logs."
        )
    return llm_service

# # Override the placeholder dependency in the voice router with the real one
# app.dependency_overrides[get_llm_service_dependency] = get_llm_service_instance

@app.on_event("startup")
async def startup_event():
    """Initialize database connection and services on startup"""
    global llm_service

    # Configure logging as the first step
    # setup_logging() # This line is causing the error
    
    logger.info("🚀 Starting Minus Voice Assistant API...")
    
    # Correctly initialize the global database manager instance from database.py
    supabase_manager.initialize()
    
    # Initialize and test the configured LLM service
    try:
        print("🧠 Initializing LLM Service...")
        llm_service = get_llm_service()
        if llm_service:
            stats = llm_service.get_usage_stats()
            
            # Use print to ensure visibility even if logging level filters INFO
            print("=" * 60)
            print("✅ LLM Service Initialized")
            for key, value in stats.items():
                print(f"   - {key.replace('_', ' ').title()}: {value}")
            print("=" * 60)
            
            logger.info(f"LLM initialized successfully: {stats}")
        else:
            raise ConnectionError("LLM service could not be initialized from factory.")
    except Exception as e:
        logger.error(f"⚠️ LLM initialization failed: {e}", exc_info=True)
        print("=" * 60)
        print("❌ LLM Service FAILED to initialize.")
        print(f"   Error: {e}")
        print("   Voice features will be limited without LLM service.")
        print("=" * 60)

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
async def process_text_message(
    request: TextMessageRequest,
    user = Depends(get_current_user)
):
    """Process a text message through the voice/chat pipeline."""
    if not llm_service:
        raise HTTPException(status_code=503, detail="LLM service is not available")
    
    # Get platform-specific context for the LLM
    platform_context = request.platform_context or {}

    # This mirrors the logic from the voice command processing
    try:
        # Use a generic processing method in the LLM service
        response = await llm_service.process_text_input(
            text=request.message,
            user_id=user["user_id"],
            platform_context=platform_context
        )
        
        return {
            "reply": response.get("verbal_response", "I don't have a specific response for that."),
            "actions": response.get("actions", []),
            "platform_updates": response.get("platform_updates", {})
        }
    except Exception as e:
        logger.error(f"Error processing text message: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An error occurred while processing your message.")


# @app.post("/api/v1/audio/transcribe", response_model=TranscriptionResponse)
# async def transcribe_audio(
#     audio_file: UploadFile = File(...),
#     user = Depends(get_current_user)
# ):
#     """
#     Transcribes audio using Whisper. It can use either a local model or the
#     OpenAI API depending on the server configuration.
#     """
#     if not whisper_model and not os.getenv("OPENAI_API_KEY"):
#         raise HTTPException(status_code=503, detail="Transcription service not configured.")

#     try:
#         # Save the uploaded file temporarily
#         with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp:
#             shutil.copyfileobj(audio_file.file, tmp)
#             tmp_path = tmp.name

#         # --- Local Whisper Transcription ---
#         if whisper_model:
#             print(f"Transcribing with local Whisper model: {tmp_path}")
#             # The 'fp16=False' option can improve compatibility on CPUs
#             result = whisper_model.transcribe(tmp_path, fp16=False)
#             print(f"Transcription result: {result['text']}")
            
#             # Clean up the temporary file
#             os.remove(tmp_path)
            
#             return TranscriptionResponse(
#                 transcribed_text=result["text"].strip(),
#                 confidence=result.get("avg_logprob") # This may not always be present
#             )
        
#         # --- OpenAI Whisper API Transcription ---
#         else:
#             print("Transcribing with OpenAI Whisper API...")
#             from openai import OpenAI
#             client = OpenAI()
            
#             with open(tmp_path, "rb") as audio:
#                 transcript = client.audio.transcriptions.create(
#                     model="whisper-1",
#                     file=audio
#                 )

#             os.remove(tmp_path)

#             return TranscriptionResponse(
#                 transcribed_text=transcript.text.strip()
#             )

#     except Exception as e:
#         logger.error(f"Error during transcription: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail=str(e))
#     finally:
#         # Ensure the file is closed before cleanup
#         audio_file.file.close()


# @app.post("/api/v1/audio/tts")
# async def text_to_speech(
#     request: TTSRequest,
#     user = Depends(get_current_user)
# ):
#     """Placeholder for Text-to-Speech functionality"""
#     # In a real implementation, you'd use a TTS service like ElevenLabs, Google TTS, etc.
#     return {"message": "TTS endpoint not implemented yet.", "text_received": request.text}


# @app.post("/api/v1/voice/command")
# async def process_voice_command(
#     request: VoiceCommandRequest,
#     user = Depends(get_current_user)
# ):
#     """
#     Processes a transcribed voice command through the core logic pipeline.
#     This endpoint now orchestrates the interaction between different services.
#     """
#     if not llm_service:
#         raise HTTPException(status_code=503, detail="LLM service is not available")
    
#     command = request.command
#     context = request.context or {}
#     user_id = user["user_id"]
    
#     # 1. Determine the user's intent using the LLM
#     try:
#         intent_response = await llm_service.determine_intent(command, context)
#         intent = intent_response.get("intent", "unknown")
#         entities = intent_response.get("entities", {})
        
#         logger.info(f"Intent determined: {intent}, Entities: {entities}")

#         # 2. Route to the appropriate service based on intent
#         # This is where the core logic orchestration happens.
#         # Example for Gmail:
#         if intent and "email" in intent:
#             final_response = await voice_email_processor.process_command(
#                 user_id=user_id,
#                 command=command,
#                 intent_data=intent_response
#             )
#         else:
#             # Fallback for general queries or unhandled intents
#             final_response = {
#                 "verbal_response": "I'm not sure how to handle that yet, but I'm learning.",
#                 "platform_updates": {},
#                 "actions": []
#             }
            
#         return {
#             "reply": final_response.get("verbal_response", "Something went wrong."),
#             "actions": final_response.get("actions", []),
#             "platform_updates": final_response.get("platform_updates", {})
#         }

#     except Exception as e:
#         logger.error(f"Error processing voice command: {e}", exc_info=True)
#         raise HTTPException(status_code=500, detail="An error occurred while processing your command.")


@app.get("/api/v1/user/profile")
async def get_user_profile(user = Depends(get_current_user)):
    """
    Fetch user profile information from the database.
    """
    db = get_database()
    try:
        user_id = user["user_id"]
        # Assuming you have a 'user_profiles' table with a 'user_id' column
        result = await db.client.from_("user_profiles").select("*").eq("id", user_id).single().execute()
        
        if not result.data:
            raise HTTPException(status_code=404, detail="User profile not found")
        
        return result.data
    except Exception as e:
        logger.error(f"Error fetching user profile: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch user profile")


@app.get("/api/v1/user/interactions")
async def get_recent_interactions(user = Depends(get_current_user), limit: int = 10):
    """Placeholder for fetching recent user interactions"""
    # This would query a database table storing interaction history
    return {"message": "Interaction history not implemented yet."}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_text()
            # This is a generic endpoint. Specific logic should be in routers.
            # For example, you could broadcast messages to the same user's other sessions.
            await manager.broadcast_to_user(user_id, f"Received your message: {data}")
    except WebSocketDisconnect:
        manager.disconnect(websocket, user_id)
        logger.info(f"User {user_id} disconnected from generic WebSocket.")

# Ensure the WebSocket manager is properly handled
@app.on_event("shutdown")
async def shutdown_event():
    """Clean up resources on shutdown"""
    # This part is more complex as it requires disconnecting all clients
    # For now, we'll just log it.
    logger.info("Application shutting down.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
