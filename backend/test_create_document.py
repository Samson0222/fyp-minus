import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.append(str(backend_dir))

from app.services.docs_service import DocsService

async def test_create_document():
    """Test the document creation functionality"""
    # Use the same user ID from the logs
    user_id = "cbede3b0-2f68-47df-9c26-09a46e588567"
    
    try:
        print(f"Testing document creation for user: {user_id}")
        
        # Create DocsService instance
        docs_service = DocsService(user_id=user_id)
        
        # Test creating a document
        result = await docs_service.create_document("Test Document from API")
        
        print("Result:", result)
        
        if result.get("success"):
            print(f"✅ Successfully created document: {result.get('title')}")
            print(f"📄 Document ID: {result.get('document_id')}")
        else:
            print(f"❌ Failed to create document: {result.get('error')}")
            
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(test_create_document()) 