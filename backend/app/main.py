# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

# Load variables from .env file
load_dotenv() 

app = FastAPI()

# Configure CORS
origins = [
    "http://localhost:3000", # Next.js default port
    os.getenv("FRONTEND_URL") # For deployed frontend later
]
# Filter out None values in case FRONTEND_URL isn't set yet
origins = [origin for origin in origins if origin]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if origins else ["*"], # Allow specific origins or all if none set
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# --------------------------------------

@app.get("/")
async def read_root():
    return {"message": "Hello from FastAPI Backend!"}

@app.get("/api/process-voice")
async def process_voice(query: str = "Default query"):
    # --- Placeholder for your AI logic ---
    # Here you would:
    # 1. Potentially receive audio data (needs more setup) or transcribed text
    # 2. Send text to your LLM (e.g., OpenAI API via LangChain)
    # 3. Process the LLM response
    # 4. Maybe generate TTS audio
    # 5. Return the result
    # ------------------------------------
    print(f"Received query: {query}")
    processed_response = f"Backend processed query: '{query}'"
    return {"response": processed_response}

# Add more endpoints as needed...

# For debugging CORS setup
print(f"Backend allowing origins: {origins}") 