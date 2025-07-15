import asyncio
import os
from dotenv import load_dotenv

# Ensure the app's root directory is in the Python path
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Load environment variables
load_dotenv()

async def test_gemini_connection():
    """
    A simple script to verify that the application can successfully
    initialize the AIOrchestratorService and connect to the configured LLM.
    """
    print("--- 🧪 Testing Connection to Google Gemini ---")
    
    try:
        print("1. Importing AIOrchestratorService...")
        from backend.app.services.ai_orchestrator_service import AIOrchestratorService
        print("   ✅ Import successful.")
        
        print("\n2. Initializing AIOrchestratorService...")
        # Instantiating this service automatically initializes the LLM
        # as configured in the get_llm_service() factory.
        orchestrator = AIOrchestratorService(mock_mode=False)
        print("   ✅ Service initialized successfully.")
        
        print("\n3. Verifying LLM service instance...")
        if orchestrator.llm_service:
            stats = orchestrator.llm_service.get_usage_stats()
            model_name = stats.get("model_name", "Unknown Model")
            print(f"   ✅ LLM loaded: {model_name}")
        else:
            raise ValueError("LLM Service instance is not available after initialization.")
            
        print("\n--- ✅ SUCCESS: Connection to Google Gemini appears to be working correctly. ---")
        return True

    except Exception as e:
        print(f"\n--- ❌ FAILED: An error occurred during the connection test. ---")
        print(f"Error Type: {type(e).__name__}")
        print(f"Error Details: {e}")
        print("\nTroubleshooting Tips:")
        print("  - Ensure your .env file is present and correctly configured.")
        print("  - Check that the `GOOGLE_GEMINI_API_KEY` is valid.")
        print("  - Verify that `LLM_PROVIDER` in your .env file is set to 'google_gemini'.")
        return False

if __name__ == "__main__":
    asyncio.run(test_gemini_connection()) 