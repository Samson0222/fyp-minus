import os
import json
import re
import logging
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
from app.core.enhanced_llm_service import EnhancedLLMService

# Google Docs API scopes
SCOPES = [
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/documents'
]

class DocsService:
    """Google Docs API service for document operations"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.credentials = self._get_credentials()
        self.service = build('docs', 'v1', credentials=self.credentials)
        self.drive_service = build('drive', 'v3', credentials=self.credentials)
        self.llm_service = EnhancedLLMService()

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
            logging.error(f"Failed to load credentials for user {self.user_id}: {e}")
            raise HTTPException(
                status_code=401,
                detail="Could not load credentials. Please try re-authenticating.",
            )

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logging.info(f"Refreshing expired Google token for user_id: {self.user_id}")
                try:
                    creds.refresh(Request())
                    with open(token_path, 'w') as token:
                        token.write(creds.to_json())
                except Exception as e:
                    logging.error(f"Failed to refresh token for user {self.user_id}: {e}")
                    if os.path.exists(token_path):
                        os.remove(token_path)
                    raise HTTPException(
                        status_code=401,
                        detail="Failed to refresh authentication token. Please re-authenticate.",
                    )
            else:
                logging.warning(f"Invalid credentials and no refresh token for user_id: {self.user_id}")
                raise HTTPException(
                    status_code=401,
                    detail="Invalid credentials. Please re-authenticate.",
                )
        
        return creds
        
    async def _parse_command_with_llm(self, command: str) -> Dict[str, Any]:
        """Parse natural language command using LLM to extract intent and parameters"""
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
            logging.error(f"LLM command parsing error: {e}")
            return {"action": "unknown", "error": str(e)}

    async def _get_document_content(self, document_id: str) -> Optional[Dict[str, Any]]:
        """Get the full content object of a Google Doc"""
        try:
            document = self.service.documents().get(documentId=document_id).execute()
            return document
        except Exception as e:
            logging.error(f"Error getting document content: {e}")
            return None

    def _find_text_range(self, document_content: List[Dict[str, Any]], target_text: str) -> Optional[Dict[str, int]]:
        """Finds the start and end index of a text string in the document content."""
        full_text = ""
        for element in document_content:
            if 'paragraph' in element:
                for pe in element.get('paragraph', {}).get('elements', []):
                    if 'textRun' in pe:
                        full_text += pe.get('textRun', {}).get('content', '')

        # Simple string search on the concatenated text
        start_char_index = full_text.find(target_text)
        if start_char_index == -1:
            return None

        end_char_index = start_char_index + len(target_text)

        # Now, map character indices back to API indices
        start_api_index, end_api_index = -1, -1
        current_char_pos = 0

        for element in document_content:
            if 'paragraph' in element:
                for pe in element.get('paragraph', {}).get('elements', []):
                    if 'textRun' in pe:
                        text_run_content = pe.get('textRun', {}).get('content', '')
                        text_run_len = len(text_run_content)
                        
                        if start_api_index == -1 and start_char_index < current_char_pos + text_run_len:
                            offset = start_char_index - current_char_pos
                            start_api_index = pe.get('startIndex', 0) + offset

                        if end_api_index == -1 and end_char_index <= current_char_pos + text_run_len:
                            offset = end_char_index - current_char_pos
                            end_api_index = pe.get('startIndex', 0) + offset
                            return {"startIndex": start_api_index, "endIndex": end_api_index}
                            
                        current_char_pos += text_run_len
        
        return None

    async def _create_suggestion_in_document(self, document_id: str, start_index: int, end_index: int, suggested_text: str) -> Optional[str]:
        """Create a suggestion in the Google Doc by deleting old text and inserting new text."""
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
            logging.error(f"Error creating suggestion: {e}")
            logging.error(f"Response content: {e.content}")
            return None
        except Exception as e:
            logging.error(f"An unexpected error occurred: {e}")
            return None

    async def create_suggestion(self, document_id: str, request: CreateSuggestionRequest) -> CreateSuggestionResponse:
        """Process a natural language command and create a suggestion in the document"""
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
            llm_result = await self.llm_service.process_command(prompt)
            suggested_text = llm_result.get("response", "").strip()

            if not suggested_text or "error" in llm_result:
                 return CreateSuggestionResponse(
                    success=False, message="AI service failed to generate a suggestion.",
                    error=llm_result.get("error", "Empty response from LLM")
                )

            suggestion_result = await self._create_suggestion_in_document(
                document_id,
                text_range['startIndex'],
                text_range['endIndex'],
                suggested_text
            )
            
            if suggestion_result:
                return CreateSuggestionResponse(
                    success=True,
                    message=f"Successfully created suggestion for '{target_text}'.",
                    suggestion_id=str(suggestion_result) 
                )
            else:
                return CreateSuggestionResponse(
                    success=False,
                    message="Failed to create suggestion in Google Docs.",
                    error="The API call to create the suggestion failed."
                )

        except Exception as e:
            logging.error(f"Error in create_suggestion workflow: {e}")
            return CreateSuggestionResponse(
                success=False,
                message="An unexpected error occurred.",
                error=str(e)
            )

    async def list_documents(self, limit: int = 20, trashed: bool = False) -> DocumentListResponse:
        """List user's Google Docs from Google Drive, optionally including trashed files."""
        try:
            query = f"mimeType='application/vnd.google-apps.document' and trashed={str(trashed).lower()}"
            
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
            return DocumentListResponse(documents=documents, total_count=len(documents))
        except Exception as e:
            logging.error(f"Error listing documents: {e}")
            return DocumentListResponse(documents=[], total_count=0, error=str(e))

    async def trash_document(self, document_id: str) -> bool:
        """Moves a document to the trash in Google Drive."""
        try:
            self.drive_service.files().update(
                fileId=document_id,
                body={'trashed': True}
            ).execute()
            logging.info(f"Successfully moved document {document_id} to trash for user {self.user_id}")
            return True
        except Exception as e:
            logging.error(f"Error moving document {document_id} to trash: {e}")
            return False

    async def sync_documents(self, request: SyncDocumentsRequest) -> SyncDocumentsResponse:
        """Syncs document metadata (placeholder for now)"""
        logging.info(f"Syncing documents for user {self.user_id} with tags: {request.tags}")
        
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
            logging.error(f"Error processing voice command: {e}")
            return {"error": f"Command processing failed: {str(e)}"}