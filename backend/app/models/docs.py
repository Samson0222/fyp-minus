from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime

class DocumentMetadata(BaseModel):
    """Basic metadata for a Google Doc"""
    document_id: str = Field(..., description="Google Docs document ID")
    user_id: str = Field(..., description="The user ID of the owner")
    title: str = Field(..., description="Document title")
    last_modified_gdrive: datetime = Field(..., description="Last modified timestamp from Google Drive")
    
    # Metadata managed by our system
    minus_tags: List[str] = Field(default_factory=list, description="Tags added within Minus")
    minus_summary: Optional[str] = Field(None, description="AI-generated summary of the document")
    created_time: Optional[datetime] = Field(None, description="When the document was created")
    modified_time: Optional[datetime] = Field(None, description="Last modified time")

class DocumentListResponse(BaseModel):
    """Response for listing Google Docs"""
    documents: List[DocumentMetadata]
    total_count: int
    next_page_token: Optional[str] = None

class CreateSuggestionRequest(BaseModel):
    """Request to create a suggestion in a Google Doc"""
    command: str = Field(..., description="Natural language command for the suggestion")
    context: Optional[str] = Field(None, description="Conversational context for better understanding")
    search_strategy: Literal["exact", "case_insensitive", "partial"] = Field(
        default="case_insensitive", 
        description="Strategy for finding text to suggest changes for"
    )

class CreateSuggestionResponse(BaseModel):
    """Response after creating a suggestion"""
    success: bool
    message: str
    suggestion_id: Optional[str] = None
    target_text: Optional[str] = None
    suggested_text: Optional[str] = None
    error: Optional[str] = None

class SyncDocumentsRequest(BaseModel):
    """Request to sync documents from Google Drive"""
    force_refresh: bool = Field(False, description="Force a full resync from Google Drive")

class SyncDocumentsResponse(BaseModel):
    """Response after syncing documents"""
    success: bool
    synced_count: int
    new_documents: int
    updated_documents: int
    message: str

class VoiceDocsCommand(BaseModel):
    """Model for processing voice commands related to Google Docs"""
    command: str = Field(..., description="Transcribed voice command")
    document_id: Optional[str] = Field(None, description="Optional document ID context")
    context: Optional[str] = Field(None, description="Conversational context")

class DocumentSearchResult(BaseModel):
    """Represents a search result within a document"""
    document_id: str
    snippet: str
    page_number: Optional[int] = None
    confidence_score: float

class DocumentContent(BaseModel):
    """Represents the full content of a Google Doc"""
    success: bool = Field(..., description="Indicates if the operation was successful.")
    document_id: str
    title: Optional[str] = None
    content: Optional[str] = None
    revision_id: Optional[str] = None
    last_updated: Optional[datetime] = None
    message: Optional[str] = Field(None, description="A message, especially in case of an error.") 