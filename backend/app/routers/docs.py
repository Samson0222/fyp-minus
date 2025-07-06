from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
from pydantic import BaseModel

from app.models.docs import (
    DocumentListResponse, CreateSuggestionRequest, CreateSuggestionResponse,
    SyncDocumentsRequest, SyncDocumentsResponse, VoiceDocsCommand, DocumentMetadata
)
from app.services.docs_service import docs_service

class VoiceCommandRequest(BaseModel):
    command: str

# Get the same auth dependency from main.py
async def get_current_user(authorization: Optional[str] = None):
    """Extract user from authentication - simplified for demo but more robust"""
    try:
        # In production, this would properly validate the JWT token
        # For now, using a consistent test user with proper error handling
        user_id = "test_user_001"
        logger.info(f"Authenticated user: {user_id}")
        return {"user_id": user_id, "email": "test@example.com"}
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        # Return a fallback user to prevent complete failure
        return {"user_id": "fallback_user", "email": "fallback@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/docs", tags=["docs"])

@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    limit: int = 20,
    user = Depends(get_current_user)
):
    """Get list of user's Google Docs documents"""
    try:
        user_id = user["user_id"]
        
        result = await docs_service.list_documents(user_id, limit=limit)
        
        logger.info(f"Listed {len(result.documents)} documents for user {user_id}")
        return result
        
    except Exception as e:
        logger.error(f"Error listing documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to list documents: {str(e)}")

@router.post("/sync", response_model=SyncDocumentsResponse)
async def sync_documents(
    request: SyncDocumentsRequest,
    user = Depends(get_current_user)
):
    """Sync user's Google Docs to local metadata storage"""
    try:
        user_id = user["user_id"]
        
        result = await docs_service.sync_documents(user_id, request)
        
        logger.info(f"Synced documents for user {user_id}: {result.synced_count} synced")
        return result
        
    except Exception as e:
        logger.error(f"Error syncing documents: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sync documents: {str(e)}")

@router.post("/{document_id}/create-suggestion", response_model=CreateSuggestionResponse)
async def create_suggestion(
    document_id: str,
    request: CreateSuggestionRequest,
    user = Depends(get_current_user)
):
    """Create a suggestion in a Google Doc based on natural language command"""
    try:
        user_id = user["user_id"]
        
        logger.info(f"Processing suggestion command for doc {document_id}: '{request.command}'")
        
        result = await docs_service.create_suggestion(
            user_id=user_id,
            document_id=document_id,
            request=request
        )
        
        if result.success:
            logger.info(f"Suggestion created successfully for user {user_id} in doc {document_id}")
        else:
            logger.warning(f"Suggestion creation failed for user {user_id} in doc {document_id}: {result.message}")
        
        return result
        
    except Exception as e:
        logger.error(f"Error creating suggestion: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create suggestion: {str(e)}")

@router.get("/{document_id}/metadata")
async def get_document_metadata(
    document_id: str,
    user = Depends(get_current_user)
):
    """Get metadata for a specific document"""
    try:
        user_id = user["user_id"]
        
        # For now, return basic metadata
        # In a full implementation, this would fetch from Supabase
        return {
            "document_id": document_id,
            "user_id": user_id,
            "title": f"Document {document_id}",
            "status": "Available for editing",
            "suggestions_pending": 0
        }
        
    except Exception as e:
        logger.error(f"Error getting document metadata: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get document metadata: {str(e)}")

@router.post("/voice-command")
async def process_voice_docs_command(
    request: VoiceCommandRequest,
    user = Depends(get_current_user)
):
    """Process voice commands for Google Docs operations"""
    try:
        user_id = user["user_id"]
        
        logger.info(f"Processing voice command for user {user_id}: '{request.command}'")
        
        # Parse the command using the docs service
        result = await docs_service.process_voice_command(
            user_id=user_id,
            command_data={"action": "parse_command", "params": {"command": request.command}}
        )
        
        logger.info(f"Voice command processed for user {user_id}")
        
        return {
            "status": "success",
            "message": "Voice command processed",
            "result": result,
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error processing voice command: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to process voice command: {str(e)}")

@router.post("/test-voice")
async def test_voice_command(request: VoiceCommandRequest):
    """Test voice command processing without authentication (for development)"""
    try:
        logger.info(f"Testing voice command: '{request.command}'")
        
        # Use test user for voice command testing
        test_user_id = "test_user_001"
        
        result = await docs_service.process_voice_command(
            user_id=test_user_id,
            command_data={"action": "parse_command", "params": {"command": request.command}}
        )
        
        return {
            "status": "success",
            "message": "Test voice command processed",
            "result": result,
            "test_mode": True
        }
        
    except Exception as e:
        logger.error(f"Error in test voice command: {e}")
        raise HTTPException(status_code=500, detail=f"Test failed: {str(e)}")

@router.get("/auth-status")
async def get_auth_status(user = Depends(get_current_user)):
    """Check authentication status for Google Docs API"""
    try:
        user_id = user["user_id"]
        
        # In a real implementation, this would check actual Google API auth
        auth_result = await docs_service.authenticate(user_id)
        
        return {
            "authenticated": auth_result,
            "user_id": user_id,
            "service": "Google Docs",
            "mock_mode": docs_service.mock_mode,
            "scopes": ["https://www.googleapis.com/auth/drive.readonly", "https://www.googleapis.com/auth/documents"]
        }
        
    except Exception as e:
        logger.error(f"Error checking auth status: {e}")
        return {
            "authenticated": False,
            "error": str(e),
            "service": "Google Docs"
        }

@router.post("/sign-out")
async def sign_out_docs(user = Depends(get_current_user)):
    """Sign out from Google Docs API"""
    try:
        user_id = user["user_id"]
        
        # In a real implementation, this would revoke tokens
        logger.info(f"User {user_id} signed out from Google Docs")
        
        return {
            "status": "success",
            "message": "Signed out from Google Docs successfully",
            "user_id": user_id
        }
        
    except Exception as e:
        logger.error(f"Error signing out: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sign out: {str(e)}") 