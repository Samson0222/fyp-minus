from pydantic import BaseModel
from typing import Optional

class TranscriptionResponse(BaseModel):
    transcribed_text: str
    confidence: Optional[float] = None

class TTSRequest(BaseModel):
    text: str 