from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging

from app.models.user_context import UserContext
from app.models.docs import (
    DocumentListResponse, CreateSuggestionRequest, CreateSuggestionResponse,
    SyncDocumentsRequest, SyncDocumentsResponse
)
from app.services.docs_service import DocsService
from app.dependencies import get_current_user 

# Set up logging
logger = logging.getLogger(__name__)

# Dependency to get a user-specific DocsService instance
def get_docs_service(current_user: UserContext = Depends(get_current_user)) -> DocsService:
    """Dependency to create a DocsService instance with the current user's ID."""
    user_id = current_user.user_id
    if not user_id:
        raise HTTPException(status_code=401, detail="Could not validate user credentials.")
    return DocsService(user_id=user_id)

router = APIRouter(prefix="/api/v1/docs", tags=["docs"])

@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    limit: int = 20,
    trashed: bool = False,
    docs_service: DocsService = Depends(get_docs_service)
):
    """Get list of user's Google Docs documents, optionally including trashed files."""
    try:
        result = await docs_service.list_documents(limit=limit, trashed=trashed)
        logger.info(f"Listed {len(result.documents)} documents for user {docs_service.user_id}")
        return result
    except HTTPException as e:
        # Re-raise HTTPExceptions to avoid wrapping them in a 500
        raise e
    except Exception as e:
        logger.error(f"Error listing documents for user {docs_service.user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to list documents.")

@router.post("/sync", response_model=SyncDocumentsResponse)
async def sync_documents(
    request: SyncDocumentsRequest,
    docs_service: DocsService = Depends(get_docs_service)
):
    """Sync user's Google Docs to local metadata storage"""
    try:
        result = await docs_service.sync_documents(request)
        logger.info(f"Sync request processed for user {docs_service.user_id}")
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error syncing documents for user {docs_service.user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to sync documents.")

@router.post("/{document_id}/create-suggestion", response_model=CreateSuggestionResponse)
async def create_suggestion(
    document_id: str,
    request: CreateSuggestionRequest,
    docs_service: DocsService = Depends(get_docs_service)
):
    """Create a suggestion in a Google Doc based on a natural language command"""
    try:
        logger.info(f"Processing suggestion for doc {document_id} by user {docs_service.user_id}")
        result = await docs_service.create_suggestion(
            document_id=document_id,
            request=request
        )
        if not result.success:
            logger.warning(f"Suggestion failed for user {docs_service.user_id}: {result.message}")
        return result
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error creating suggestion for user {docs_service.user_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to create suggestion.")

@router.delete("/{document_id}", status_code=204)
async def trash_document(
    document_id: str,
    docs_service: DocsService = Depends(get_docs_service)
):
    """Moves a document to the trash."""
    try:
        success = await docs_service.trash_document(document_id)
        if not success:
            raise HTTPException(status_code=500, detail="Failed to move document to trash.")
        return None # Return 204 No Content on success
    except HTTPException as e:
        raise e
    except Exception as e:
        logger.error(f"Error in trash_document endpoint for user {docs_service.user_id}: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")

@router.get("/auth-status", summary="Check Google Docs Auth Status")
async def get_auth_status(docs_service: DocsService = Depends(get_docs_service)):
    """
    Checks if the current user's Google token is valid for Docs API scopes.
    This endpoint implicitly tests authentication by initializing the DocsService.
    """
    return {
        "authenticated": True,
        "user_id": docs_service.user_id,
        "service": "Google Docs"
    } 