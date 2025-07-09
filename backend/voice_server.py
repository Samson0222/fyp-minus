"""
Enhanced Voice Server with Dual Input Support
Features: Wake word activation, state management, text fallback
"""
import asyncio
import logging
import time
from enum import Enum
from typing import Optional
import os
import json

from app.core.llm_factory import get_llm_service

# Note: FastRTC may not be available yet, so we'll simulate the interface
try:
    from fastrtc import Stream, ReplyOnPause
    FASTRTC_AVAILABLE = True
except ImportError:
    logging.warning("FastRTC not available - using simulation mode")
    FASTRTC_AVAILABLE = False
    class Stream:
        def __init__(self):
            pass
        async def transcribe_audio(self, audio_data):
            return "simulated transcription"
        async def text_to_speech(self, text):
            return f"TTS: {text}"
        async def start(self, host, port):
            logging.info(f"Simulated FastRTC server on {host}:{port}")

# from app.core.llm_factory import get_llm_service

class InteractionState(Enum):
    IDLE = "idle"           # Text input enabled
    LISTENING = "listening" # Voice active, text disabled  
    PROCESSING = "processing" # Both disabled
    RESPONDING = "responding" # Playing response

class EnhancedVoiceAssistant(Stream):
    def __init__(self):
        super().__init__()
        self.llm_service = None  # Initialize lazily
        
        # State management
        self.state = InteractionState.IDLE
        self.wake_words = ["hey minus", "minus", "okay minus"]
        self.stop_words = ["stop", "cancel", "never mind"]
        self.silence_timeout = 3.0  # seconds
        self.last_audio_time = None
        self.accumulated_audio = ""
        
        # WebSocket connections for state broadcasting
        self.websocket_connections = []
        
    def _init_services(self):
        """Lazy initialization of services"""
        if self.llm_service is None:
            try:
                self.llm_service = get_llm_service()
                if self.llm_service:
                    logging.info("✅ LLM service initialized via factory")
                else:
                    logging.error("❌ LLM service initialization via factory returned None")
            except Exception as e:
                logging.error(f"❌ Failed to initialize LLM service via factory: {e}")
                self.llm_service = None
        
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
            # 1. Speech-to-Text (FastRTC Moonshine or simulation)
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
        
        # Notify frontend via WebSocket
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
        self._init_services()
        
        if self.llm_service is None:
            return "Sorry, the LLM service is not available."
        
        try:
            # This method handles both voice and text commands identically
            command_data = await self.llm_service.process_command(text)
            
            # Route to appropriate service
            platform = command_data.get("platform", "unknown")
            
            if platform == "gmail":
                # Import here to avoid circular imports
                from app.services.gmail_service import GmailService
                gmail_service = GmailService()
                result = await gmail_service.process_voice_command(command_data)
            elif platform == "calendar":
                # Import here to avoid circular imports
                from app.services.calendar_service import CalendarService
                calendar_service = CalendarService()
                result = await calendar_service.process_voice_command(command_data)
            else:
                result = {"response": "I'm not sure how to handle that request yet."}
            
            return result.get("response", "Command processed.")
        except Exception as e:
            logging.error(f"Unified command processing error: {e}")
            return f"Sorry, I encountered an error: {str(e)}"
    
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
        
        # Simulate WebSocket broadcast for now
        for connection in self.websocket_connections:
            try:
                await connection.send_text(json.dumps(state_data))
            except:
                # Remove failed connections
                self.websocket_connections.remove(connection)
    
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

# Global voice assistant instance
voice_assistant_instance = None

def get_voice_assistant():
    """Get singleton voice assistant instance"""
    global voice_assistant_instance
    if voice_assistant_instance is None:
        voice_assistant_instance = EnhancedVoiceAssistant()
    return voice_assistant_instance

async def start_voice_server():
    """Start the main voice assistant server"""
    assistant = get_voice_assistant()
    
    # Eagerly initialize services on startup
    assistant._init_services()
    
    if FASTRTC_AVAILABLE:
        # Start the FastRTC server (blocking call)
        await assistant.start(host="0.0.0.0", port=8008)
    else:
        # Keep the script running in simulation mode
        logging.info("Running in simulation mode. No real-time voice processing.")
        while True:
            await asyncio.sleep(3600)

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(start_voice_server()) 