import os
import json
import re
import logging
import uuid
from typing import List, Optional, Dict, Any
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from fastapi import HTTPException

from app.models.docs import (
    DocumentMetadata, DocumentContent, CreateSuggestionRequest, CreateSuggestionResponse,
    DocumentListResponse, SyncDocumentsRequest, SyncDocumentsResponse,
    VoiceDocsCommand, DocumentSearchResult
)
from app.core.llm_factory import get_llm_service
from app.core.llm_base import AbstractLLMService

# Google Docs API scopes
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents',
    'https://www.googleapis.com/auth/drive.file'
]

# In-memory storage for suggestions (in production, use a database)
SUGGESTION_STORAGE = {}

class DocsService:
    """Google Docs API service for document operations"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.credentials = self._get_credentials()
        self.service = build('docs', 'v1', credentials=self.credentials)
        self.drive_service = build('drive', 'v3', credentials=self.credentials)
        
        # Initialize the LLM service using the factory
        self.llm_service: Optional[AbstractLLMService] = get_llm_service()
        if not self.llm_service:
            print("DocsService: LLM could not be initialized. AI features will be disabled.")
            # We don't raise an exception here to allow non-AI doc features to work.

    def _get_credentials(self) -> Credentials:
        """Authenticates and returns the Google API credentials, raising HTTPException on failure."""
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_google_{self.user_id}.json")

        if not os.path.exists(token_path):
            logging.warning(f"Authentication token not found for user_id: {self.user_id}")
            raise HTTPException(
                status_code=401,
                detail="User is not authenticated. Please connect your Google account.",
            )

        try:
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            print(f"Failed to load credentials for user {self.user_id}: {e}")
            raise HTTPException(
                status_code=401,
                detail="Could not load credentials. Please try re-authenticating.",
            )

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    # Save the refreshed token
                    with open(token_path, 'w') as token:
                        token.write(creds.to_json())
                except Exception as e:
                    print(f"Failed to refresh credentials for user {self.user_id}: {e}")
                    raise HTTPException(
                        status_code=401,
                        detail="Could not refresh credentials. Please try re-authenticating.",
                    )
            else:
                raise HTTPException(
                    status_code=401,
                    detail="Credentials are invalid. Please re-authenticate.",
                )
        
        return creds
        
    def _find_text_range(self, content_list: List[Dict[str, Any]], target_text: str) -> Optional[Dict[str, int]]:
        """Find the start and end index of target text in the document content."""
        full_text = ""
        index_map = []
        
        for element in content_list:
            if 'paragraph' in element:
                for pe in element.get('paragraph', {}).get('elements', []):
                    if 'textRun' in pe:
                        text_content = pe.get('textRun', {}).get('content', '')
                        start_index = pe.get('startIndex', 0)
                        end_index = pe.get('endIndex', start_index + len(text_content))
                        
                        full_text += text_content
                        index_map.append((start_index, end_index, text_content))
        
        # Find the target text in the full text
        target_start = full_text.find(target_text)
        if target_start == -1:
            return None
        
        target_end = target_start + len(target_text)
        
        # Map back to document indices
        current_pos = 0
        doc_start_index = None
        doc_end_index = None
        
        for start_idx, end_idx, text_content in index_map:
            content_start = current_pos
            content_end = current_pos + len(text_content)
            
            if doc_start_index is None and target_start >= content_start and target_start < content_end:
                offset = target_start - content_start
                doc_start_index = start_idx + offset
            
            if doc_end_index is None and target_end > content_start and target_end <= content_end:
                offset = target_end - content_start
                doc_end_index = start_idx + offset
            
            current_pos = content_end
            
            if doc_start_index is not None and doc_end_index is not None:
                break
        
        if doc_start_index is not None and doc_end_index is not None:
            return {"startIndex": doc_start_index, "endIndex": doc_end_index}
        
        return None

    async def _parse_command_with_llm(self, command: str) -> Dict[str, Any]:
        """Parse natural language command using LLM to extract intent and parameters"""
        if not self.llm_service:
            return {"action": "unknown", "error": "LLM service is not available."}

        docs_prompt = f"""
        Parse this Google Docs command and extract the action and parameters.

        Command: "{command}"

        Respond with JSON containing:
        {{
            "action": "find_and_suggest|create_document|format_text|add_content",
            "target_text": "text to find (if applicable)",
            "modification": "what to do with the target text",
            "new_content": "content to add/create",
            "position": "before|after|replace",
            "confidence": 0.95
        }}

        Examples:
        - "Find the sentence 'The data indicates' and make it more casual" 
          → {{"action": "find_and_suggest", "target_text": "The data indicates", "modification": "make it more casual"}}
        - "Add a new section about conclusions after the current content"
          → {{"action": "add_content", "new_content": "section about conclusions", "position": "after"}}
        """
        
        try:
            result = await self.llm_service.process_command(docs_prompt)
            if "error" in result:
                return {"action": "unknown", "error": result["error"]}
            return result
        except Exception as e:
            print(f"LLM command parsing error: {e}")
            return {"action": "unknown", "error": str(e)}

    async def _get_document_content(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get the full content object of a Google Doc"""
        try:
            document = self.service.documents().get(documentId=document_id).execute()
            return document
        except Exception as e:
            print(f"Error getting document content: {e}")
            return None

    def _extract_text_from_document(self, document: Dict[str, Any]) -> str:
        """Extract plain text from a Google Doc"""
        content = ""
        for element in document.get('body', {}).get('content', []):
            if 'paragraph' in element:
                for pe in element.get('paragraph', {}).get('elements', []):
                    if 'textRun' in pe:
                        content += pe.get('textRun', {}).get('content', '')
        return content

    def _store_suggestion(self, suggestion_id: str, document_id: str, user_id: str, 
                         target_text: str, suggested_text: str, start_index: int, end_index: int) -> None:
        """Store suggestion data for later application"""
        SUGGESTION_STORAGE[suggestion_id] = {
            "document_id": document_id,
            "user_id": user_id,
            "target_text": target_text,
            "suggested_text": suggested_text,
            "start_index": start_index,
            "end_index": end_index,
            "created_at": datetime.utcnow().isoformat(),
            "status": "pending"
        }

    async def _apply_suggestion_to_document(self, document_id: str, start_index: int, end_index: int, suggested_text: str) -> Optional[str]:
        """Apply a suggestion to the Google Doc by replacing text."""
        try:
            requests = [
                {
                    'deleteContentRange': {
                        'range': {
                            'startIndex': start_index,
                            'endIndex': end_index,
                        }
                    }
                },
                {
                    'insertText': {
                        'location': {
                            'index': start_index,
                        },
                        'text': suggested_text
                    }
                }
            ]
            
            self.service.documents().batchUpdate(
                documentId=document_id,
                body={'requests': requests}
            ).execute()
            
            return "success"
            
        except HttpError as e:
            print(f"Error applying suggestion to document: {e}")
            print(f"Response content: {e.content}")
            return None
        except Exception as e:
            print(f"An unexpected error occurred: {e}")
            return None

    async def create_suggestion(self, document_id: str, request: CreateSuggestionRequest) -> CreateSuggestionResponse:
        """Process a natural language command and create a suggestion (without applying it)"""
        try:
            parsed_command = await self._parse_command_with_llm(request.command)
            
            if parsed_command.get("action") == "unknown":
                return CreateSuggestionResponse(
                    success=False,
                    message="Could not understand the command",
                    error=parsed_command.get("error", "Unknown command format")
                )
            
            target_text = parsed_command.get("target_text")
            modification = parsed_command.get("modification")

            if not target_text or not modification:
                return CreateSuggestionResponse(
                    success=False, message="Could not identify text to change or the change to make.",
                    error="LLM failed to parse command for target_text and modification."
                )

            document = await self._get_document_content(document_id)
            if not document:
                return CreateSuggestionResponse(
                    success=False,
                    message="Could not retrieve document content",
                    error="Failed to fetch document from Google Docs API"
                )
            
            doc_content_list = document.get('body', {}).get('content', [])
            text_range = self._find_text_range(doc_content_list, target_text)
            if not text_range:
                return CreateSuggestionResponse(
                    success=False,
                    message=f"Could not find the text '{target_text}' in the document.",
                    error=f"Target text not found for suggestion."
                )
            
            prompt = f"Given the text '{target_text}', revise it to '{modification}'. Only return the revised text."
            
            if not self.llm_service:
                 return CreateSuggestionResponse(success=False, message="AI service is not available.", error="LLM not initialized.")

            try:
                # Use generate_text instead of process_command for plain text generation
                suggested_text = await self.llm_service.generate_text(prompt)
                
                if not suggested_text or suggested_text.startswith("Error"):
                    return CreateSuggestionResponse(
                        success=False, 
                        message="AI service failed to generate a suggestion.",
                        error="LLM returned empty or error response"
                    )
                
                suggested_text = suggested_text.strip()
                
            except Exception as e:
                 return CreateSuggestionResponse(
                    success=False, 
                    message="AI service failed to generate a suggestion.",
                    error=f"LLM error: {str(e)}"
                )

            # Generate unique suggestion ID
            suggestion_id = str(uuid.uuid4())
            
            # Store the suggestion instead of applying it immediately
            self._store_suggestion(
                suggestion_id=suggestion_id,
                document_id=document_id,
                user_id=self.user_id,
                target_text=target_text,
                suggested_text=suggested_text,
                start_index=text_range['startIndex'],
                end_index=text_range['endIndex']
            )
            
            return CreateSuggestionResponse(
                success=True,
                message=f"Successfully created suggestion for '{target_text}'.",
                suggestion_id=suggestion_id,
                target_text=target_text,
                suggested_text=suggested_text
            )

        except Exception as e:
            print(f"Error in create_suggestion workflow: {e}")
            return CreateSuggestionResponse(
                success=False,
                message="An unexpected error occurred.",
                error=str(e)
            )

    async def apply_suggestion(self, suggestion_id: str) -> bool:
        """Apply a stored suggestion to the document"""
        try:
            suggestion = SUGGESTION_STORAGE.get(suggestion_id)
            if not suggestion:
                print(f"Suggestion {suggestion_id} not found")
                return False
            
            if suggestion["user_id"] != self.user_id:
                print(f"Suggestion {suggestion_id} does not belong to user {self.user_id}")
                return False
            
            if suggestion["status"] != "pending":
                print(f"Suggestion {suggestion_id} is not pending (status: {suggestion['status']})")
                return False
            
            # Apply the suggestion to the document
            result = await self._apply_suggestion_to_document(
                document_id=suggestion["document_id"],
                start_index=suggestion["start_index"],
                end_index=suggestion["end_index"],
                suggested_text=suggestion["suggested_text"]
            )
            
            if result == "success":
                # Mark suggestion as applied
                suggestion["status"] = "applied"
                suggestion["applied_at"] = datetime.utcnow().isoformat()
                return True
            else:
                return False
                
        except Exception as e:
            print(f"Error applying suggestion {suggestion_id}: {e}")
            return False

    async def reject_suggestion(self, suggestion_id: str) -> bool:
        """Reject a stored suggestion"""
        try:
            suggestion = SUGGESTION_STORAGE.get(suggestion_id)
            if not suggestion:
                print(f"Suggestion {suggestion_id} not found")
                return False
            
            if suggestion["user_id"] != self.user_id:
                print(f"Suggestion {suggestion_id} does not belong to user {self.user_id}")
                return False
            
            if suggestion["status"] != "pending":
                print(f"Suggestion {suggestion_id} is not pending (status: {suggestion['status']})")
                return False
            
            # Mark suggestion as rejected
            suggestion["status"] = "rejected"
            suggestion["rejected_at"] = datetime.utcnow().isoformat()
            return True
                
        except Exception as e:
            print(f"Error rejecting suggestion {suggestion_id}: {e}")
            return False

    async def list_documents(self, limit: int = 20, trashed: bool = False, search_query: Optional[str] = None) -> DocumentListResponse:
        """List user's Google Docs from Google Drive, optionally including trashed files and filtering by a search query."""
        try:
            query_parts = [
                "mimeType='application/vnd.google-apps.document'",
                f"trashed={str(trashed).lower()}"
            ]

            # Add the search query to filter by document name if provided
            if search_query and search_query != '*':
                # Sanitize query to prevent injection issues, although Drive API is generally safe
                sanitized_query = search_query.replace("'", "\\'")
                query_parts.append(f"name contains '{sanitized_query}'")

            query = " and ".join(query_parts)
            print(f"DocsService: Executing Drive query for user {self.user_id}: {query}")
            
            results = self.drive_service.files().list(
                q=query,
                pageSize=limit,
                fields="nextPageToken, files(id, name, modifiedTime)"
            ).execute()
            
            items = results.get('files', [])
            
            documents = [
                DocumentMetadata(
                    document_id=item['id'],
                    user_id=self.user_id,
                    title=item['name'],
                    last_modified_gdrive=datetime.fromisoformat(item['modifiedTime'].replace('Z', '+00:00')),
                ) for item in items
            ]
            print(f"DocsService: Found {len(documents)} documents matching query.")
            return DocumentListResponse(documents=documents, total_count=len(documents))
        except Exception as e:
            print(f"Error listing documents: {e}", exc_info=True)
            return DocumentListResponse(documents=[], total_count=0, error=str(e))

    async def get_document_content(self, document_id: str) -> DocumentContent:
        """
        Retrieves the content of a Google Doc.
        This is a new method added to support the 'get_document_content' tool.
        """
        try:
            document = self.service.documents().get(documentId=document_id).execute()
            
            content_text = ""
            for element in document.get('body', {}).get('content', []):
                if 'paragraph' in element:
                    for pe in element.get('paragraph', {}).get('elements', []):
                        if 'textRun' in pe:
                            content_text += pe.get('textRun', {}).get('content', '')

            return DocumentContent(
                success=True,
                document_id=document_id,
                title=document.get('title', 'Untitled'),
                content=content_text,
                revision_id=document.get('revisionId'),
                last_updated=datetime.utcnow() # Placeholder
            )
        except HttpError as e:
            logging.error(f"HTTP error fetching document content for {document_id}: {e}")
            return DocumentContent(success=False, document_id=document_id, message=f"Document not found or access denied. (HTTP {e.resp.status})")
        except Exception as e:
            logging.error(f"Unexpected error fetching document content for {document_id}: {e}", exc_info=True)
            return DocumentContent(success=False, document_id=document_id, message="An unexpected error occurred while fetching the document.")

    async def create_document(self, title: str) -> Dict[str, Any]:
        """
        Creates a new Google Docs document with the specified title.
        
        Args:
            title: The title for the new document
            
        Returns:
            Dictionary containing success status, document_id, and other details
        """
        try:
            # Create the document using Google Docs API
            document_data = {
                'title': title
            }
            
            logging.info(f"Creating new document '{title}' for user {self.user_id}")
            document = self.service.documents().create(body=document_data).execute()
            
            document_id = document.get('documentId')
            document_title = document.get('title')
            
            if document_id:
                logging.info(f"Successfully created document '{document_title}' with ID {document_id} for user {self.user_id}")
                return {
                    "success": True,
                    "document_id": document_id,
                    "title": document_title,
                    "message": f"Successfully created document '{document_title}'"
                }
            else:
                logging.error(f"Document creation failed - no document ID returned for user {self.user_id}")
                return {
                    "success": False,
                    "error": "Document creation failed - no document ID returned"
                }
                
        except HttpError as e:
            logging.error(f"HTTP error creating document for user {self.user_id}: {e}")
            return {
                "success": False,
                "error": f"Failed to create document: HTTP {e.resp.status} - {e._get_reason()}"
            }
        except Exception as e:
            logging.error(f"Unexpected error creating document for user {self.user_id}: {e}", exc_info=True)
            return {
                "success": False,
                "error": f"Unexpected error creating document: {str(e)}"
            }

    async def trash_document(self, document_id: str) -> bool:
        """Moves a document to the trash in Google Drive."""
        try:
            self.drive_service.files().update(
                fileId=document_id,
                body={'trashed': True}
            ).execute()
            print(f"Successfully moved document {document_id} to trash for user {self.user_id}")
            return True
        except Exception as e:
            print(f"Error moving document {document_id} to trash: {e}")
            return False

    async def sync_documents(self, request: SyncDocumentsRequest) -> SyncDocumentsResponse:
        """Syncs document metadata (placeholder for now)"""
        print(f"Syncing documents for user {self.user_id}...")
        
        # In a real implementation, this would fetch all docs and sync with a Supabase table.
        # For now, it's a placeholder that returns a success message.
        return SyncDocumentsResponse(
            success=True,
            synced_count=0,
            new_documents=0,
            updated_documents=0,
            message="Sync functionality is a placeholder and has not been fully implemented yet."
        )

    async def process_voice_command(self, command_data: dict) -> dict:
        """Process a voice command related to Google Docs."""
        action = command_data.get("action")
        params = command_data.get("params", {})
        
        try:
            if action == "create_document":
                # This would need more implementation details
                return {"status": "success", "message": "Document creation not fully implemented."}
            elif action == "find_and_suggest":
                document_id = params.get("document_id")
                command_text = params.get("command")
                if not document_id or not command_text:
                    return {"error": "document_id and command are required for find_and_suggest"}
                
                request = CreateSuggestionRequest(command=command_text)
                response = await self.create_suggestion(document_id, request)
                return response.model_dump()
            else:
                return {"error": f"Unknown Google Docs action: {action}"}
                
        except Exception as e:
            print(f"Error processing voice command: {e}")
            return {"error": f"Command processing failed: {str(e)}"}