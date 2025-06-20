# app/main.py (Modified for frontend testing without live LLM)
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
# from openai import OpenAI # Ensure this is imported
import whisper
import shutil # For handling file uploads
import tempfile # For creating temporary files

load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- OpenAI API Client (Keep if you use it for other things like chat) ---
# Initialize OpenAI client (if still needed for chat, otherwise remove)
# try:
#     openai_api_client = OpenAI()
# except Exception as e:
#     print(f"Error initializing OpenAI API client: {e}")
#     openai_api_client = None
# ---------------------------------------------------------------------

# Load the Whisper model (once, when the application starts)
# You can choose different model sizes: "tiny", "base", "small", "medium", "large"
# Smaller models are faster and use less VRAM/RAM but are less accurate.
# "base" is a good starting point for decent quality on CPU.
try:
    print("Loading local Whisper model...")
    # # For CPU:
    # whisper_model = whisper.load_model("base")
    # If you have a GPU and installed PyTorch with CUDA:
    whisper_model = whisper.load_model("base", device="cuda")
    print("Local Whisper model loaded successfully.")
except Exception as e:
    print(f"Error loading local Whisper model: {e}")
    whisper_model = None

class TextMessageRequest(BaseModel):
    message: str

class TextMessageResponse(BaseModel):
    reply: str


class TranscriptionRequest(BaseModel):
    # We might not need a Pydantic model if we directly use UploadFile
    pass

class TranscriptionResponse(BaseModel):
    transcribed_text: str

@app.get("/")
async def root():
    return {"message": "Voice Assistant Backend is running (Test Mode)!"}

@app.post("/api/v1/chat/text-message", response_model=TextMessageResponse)
async def handle_text_message_test(request: TextMessageRequest):
    print(f"Received test message: {request.message}") # Server-side log
    
    user_message_lower = request.message.lower()
    ai_reply = ""

    if "hello" in user_message_lower or "hi" in user_message_lower:
        ai_reply = "Hello there! This is a test response."
    elif "how are you" in user_message_lower:
        ai_reply = "I'm a test backend, doing great! Thanks for asking."
    elif "weather" in user_message_lower:
        ai_reply = "I can't check the weather in test mode, but I hope it's nice!"
    else:
        ai_reply = f"Test backend received: '{request.message}'. I don't have a specific test reply for this."

    print(f"Sending test AI Reply: {ai_reply}") # Server-side log
    return TextMessageResponse(reply=ai_reply)

@app.post("/api/v1/audio/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio_local(audio_file: UploadFile = File(...)):
    if not whisper_model:
        raise HTTPException(status_code=503, detail="Local Whisper model not loaded.")

    if not audio_file:
        raise HTTPException(status_code=400, detail="No audio file provided.")

    print(f"Received audio file: {audio_file.filename}, content type: {audio_file.content_type}")

    tmp_path = None # Initialize to ensure it's defined in finally block
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp:
            shutil.copyfileobj(audio_file.file, tmp)
            tmp_path = tmp.name
        
        print(f"Audio file saved temporarily to: {tmp_path}")

        # Transcribe using the local Whisper model
        # The result is a dictionary, the transcribed text is in result["text"]
        result = whisper_model.transcribe(tmp_path, fp16=False) # fp16=False for CPU, can be True for GPU
        transcribed_text = result["text"]
        
        print(f"Local Whisper Transcribed Text: {transcribed_text}")

        return TranscriptionResponse(transcribed_text=transcribed_text)

    except Exception as e:
        print(f"Error during local Whisper transcription: {e}")
        raise HTTPException(status_code=500, detail=f"Error transcribing audio locally: {str(e)}")
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.remove(tmp_path)
            print(f"Temporary file {tmp_path} removed.")
        await audio_file.close()