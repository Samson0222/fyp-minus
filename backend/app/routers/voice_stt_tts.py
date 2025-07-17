from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import os
import tempfile
import shutil
import logging
import re
from google.cloud import speech
from google.cloud import texttospeech
from google.oauth2 import credentials
import io
import json
from datetime import datetime

from app.dependencies import get_current_user
from app.models.user_context import UserContext

logger = logging.getLogger(__name__)

router = APIRouter()

def sanitize_for_speech(text: str) -> str:
    """
    Removes common markdown syntax from text to make it sound more natural for TTS.
    """
    # Remove bold and italics: **text** or *text*
    text = re.sub(r'\*(\*?)(.*?)\1\*', r'\2', text)
    # Remove strikethrough: ~~text~~
    text = re.sub(r'~~(.*?)~~', r'\1', text)
    # Remove inline code: `code`
    text = re.sub(r'`(.*?)`', r'\1', text)
    # Remove links, keeping the link text: [text](url)
    text = re.sub(r'\[(.*?)\]\(.*?\)', r'\1', text)
    # Remove list markers: *, -, 1.
    text = re.sub(r'^\s*[\*\-]\s*', '', text, flags=re.MULTILINE)
    text = re.sub(r'^\s*\d+\.\s*', '', text, flags=re.MULTILINE)
    # Remove horizontal rules
    text = re.sub(r'---', '', text)
    # Remove blockquotes
    text = re.sub(r'^\s*>\s*', '', text, flags=re.MULTILINE)
    # Remove extra newlines
    text = re.sub(r'\n{2,}', '\n', text)
    return text.strip()

# --- Removed global client initialization ---

class TTSRequest(BaseModel):
    text: str
    language_code: str = "en-US"
    voice_name: Optional[str] = None
    speaking_rate: float = 1.0
    pitch: float = 0.0

class STTResponse(BaseModel):
    transcript: str
    confidence: float

@router.post("/api/v1/stt/transcribe", response_model=STTResponse)
async def transcribe_audio(
    audio_file: UploadFile = File(...),
    user: UserContext = Depends(get_current_user)
):
    """
    Transcribe audio using Google Cloud Speech-to-Text API.
    This endpoint securely proxies the request to Google Cloud.
    """
    print("\n--- STT Endpoint Triggered ---")
    if not user.google_credentials:
        print("[STT_ERROR] User is not authenticated with Google.")
        raise HTTPException(
            status_code=401,
            detail="User is not authenticated with Google. Cannot use voice services."
        )
    print(f"[STT] Authenticating for user_id: {user.user_id}")

    try:
        # Deserialize the JSON string into a dictionary
        creds_dict = json.loads(user.google_credentials)
        
        # Convert expiry string to a datetime object if it exists
        if 'expiry' in creds_dict and isinstance(creds_dict['expiry'], str):
            # Handle 'Z' timezone format for UTC, which fromisoformat expects
            if creds_dict['expiry'].endswith('Z'):
                creds_dict['expiry'] = creds_dict['expiry'][:-1] + '+00:00'
            
            # Convert to an aware datetime object first
            aware_datetime = datetime.fromisoformat(creds_dict['expiry'])
            
            # The Google Auth library compares against a naive UTC datetime.
            # We must remove the timezone information to make our expiry object naive as well.
            creds_dict['expiry'] = aware_datetime.replace(tzinfo=None)

        # Initialize client with user's credentials
        user_creds = credentials.Credentials(**creds_dict)
        stt_client = speech.SpeechClient(credentials=user_creds)
        print("[STT] Google SpeechClient initialized successfully.")
        
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".webm") as tmp_file:
            shutil.copyfileobj(audio_file.file, tmp_file)
            tmp_path = tmp_file.name
        
        # Read audio file
        with open(tmp_path, "rb") as audio_file_handle:
            audio_content = audio_file_handle.read()
        
        # Clean up temporary file
        os.unlink(tmp_path)
        print(f"[STT] Audio received, size: {len(audio_content)} bytes.")
        
        # Configure recognition request
        audio = speech.RecognitionAudio(content=audio_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000,  # Common WebM sample rate
            language_code="en-US",
            enable_automatic_punctuation=True,
            model="latest_long",  # Best model for general use
        )
        
        # Perform the transcription
        print("[STT] Sending request to Google Cloud for transcription...")
        response = stt_client.recognize(config=config, audio=audio)
        print("[STT] Received response from Google Cloud.")
        
        if not response.results:
            print("[STT_WARN] No transcription results returned from Google.")
            return STTResponse(transcript="", confidence=0.0)
        
        # Get the best result
        result = response.results[0]
        transcript = result.alternatives[0].transcript
        confidence = result.alternatives[0].confidence
        
        print(f"[STT_SUCCESS] Transcript: '{transcript}' (Confidence: {confidence:.2f})")
        print("--- STT Endpoint Finished ---\n")
        
        return STTResponse(transcript=transcript, confidence=confidence)
        
    except Exception as e:
        print(f"[STT_ERROR] STT transcription failed: {e}")
        logger.error(f"STT transcription failed: {e}")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")

@router.post("/api/v1/tts/synthesize")
async def synthesize_speech(
    request: TTSRequest,
    user: UserContext = Depends(get_current_user)
):
    """
    Synthesize speech using Google Cloud Text-to-Speech API.
    Returns audio stream that can be played directly in the browser.
    """
    print("\n--- TTS Endpoint Triggered ---")
    if not user.google_credentials:
        print("[TTS_ERROR] User is not authenticated with Google.")
        raise HTTPException(
            status_code=401,
            detail="User is not authenticated with Google. Cannot use voice services."
        )
    print(f"[TTS] Authenticating for user_id: {user.user_id}")
    
    try:
        # Sanitize the text for speech before sending to Google
        sanitized_text = sanitize_for_speech(request.text)

        # Deserialize the JSON string into a dictionary
        creds_dict = json.loads(user.google_credentials)

        # Convert expiry string to a datetime object if it exists
        if 'expiry' in creds_dict and isinstance(creds_dict['expiry'], str):
            # Handle 'Z' timezone format for UTC, which fromisoformat expects
            if creds_dict['expiry'].endswith('Z'):
                creds_dict['expiry'] = creds_dict['expiry'][:-1] + '+00:00'
            
            # Convert to an aware datetime object first
            aware_datetime = datetime.fromisoformat(creds_dict['expiry'])

            # The Google Auth library compares against a naive UTC datetime.
            # We must remove the timezone information to make our expiry object naive as well.
            creds_dict['expiry'] = aware_datetime.replace(tzinfo=None)

        # Initialize client with user's credentials
        user_creds = credentials.Credentials(**creds_dict)
        tts_client = texttospeech.TextToSpeechClient(credentials=user_creds)
        print("[TTS] Google TextToSpeechClient initialized successfully.")

        # Set up the text input
        synthesis_input = texttospeech.SynthesisInput(text=sanitized_text)
        print(f"[TTS] Synthesizing sanitized text: '{sanitized_text[:80]}...'")
        
        # Configure voice parameters
        voice = texttospeech.VoiceSelectionParams(
            language_code=request.language_code,
            name=request.voice_name,
            ssml_gender=texttospeech.SsmlVoiceGender.NEUTRAL
        )
        
        # Configure audio output
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
            speaking_rate=request.speaking_rate,
            pitch=request.pitch
        )
        
        # Perform the text-to-speech request
        print("[TTS] Sending request to Google Cloud for synthesis...")
        response = tts_client.synthesize_speech(
            input=synthesis_input, 
            voice=voice, 
            audio_config=audio_config
        )
        print(f"[TTS_SUCCESS] Received audio response, size: {len(response.audio_content)} bytes.")
        print("--- TTS Endpoint Finished ---\n")
        
        # Return audio as streaming response
        audio_stream = io.BytesIO(response.audio_content)
        
        return StreamingResponse(
            io.BytesIO(response.audio_content),
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=speech.mp3",
                "Cache-Control": "no-cache"
            }
        )
        
    except Exception as e:
        logger.error(f"TTS synthesis failed: {e}")
        raise HTTPException(status_code=500, detail=f"Speech synthesis failed: {str(e)}")

@router.get("/api/v1/voice/health")
async def voice_health_check():
    """Health check for voice services"""
    # This check is now less meaningful as clients are created on-the-fly.
    # We can check if the basic configuration is present.
    config_present = os.path.exists("credentials/google_oauth_client_credentials.json")
    return {
        "status": "healthy" if config_present else "degraded",
        "configuration_present": config_present,
        "message": "Voice service dependencies appear to be configured." if config_present else "Missing google_oauth_client_credentials.json"
    } 