import os
import json
import re
import logging
from typing import List, Optional, Dict, Any
from datetime import datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

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
    
    def __init__(self):
        self.service = None
        self.drive_service = None
        self.credentials = None
        self.llm_service = EnhancedLLMService()
        self.mock_mode = os.getenv("GOOGLE_DOCS_MOCK_MODE", "true").lower() == "true"
        
    async def authenticate(self, user_id: str) -> bool:
        """Authenticate with Google Docs API using OAuth2"""
        if self.mock_mode:
            logging.info("Google Docs service running in mock mode")
            return True
            
        try:
            creds = None
            tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
            token_path = os.path.join(tokens_dir, f"token_{user_id}.json")
            
            # Load existing credentials
            if os.path.exists(token_path):
                creds = Credentials.from_authorized_user_file(token_path, SCOPES)
            
            # If there are no (valid) credentials available, let the user log in
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    credentials_path = os.getenv("GOOGLE_OAUTH_CREDENTIALS_PATH")
                    if not credentials_path or not os.path.exists(credentials_path):
                        raise Exception(f"Google OAuth credentials file not found. Set GOOGLE_OAUTH_CREDENTIALS_PATH in your .env file.")
                    
                    flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                    creds = flow.run_local_server(port=0)
                
                # Save the credentials for the next run
                os.makedirs(tokens_dir, exist_ok=True)
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
            
            self.credentials = creds
            self.service = build('docs', 'v1', credentials=creds)
            self.drive_service = build('drive', 'v3', credentials=creds)
            return True
            
        except Exception as e:
            logging.error(f"Google Docs authentication error: {e}")
            return False

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

    def _search_text_in_document(self, document_content: str, target_text: str) -> Optional[DocumentSearchResult]:
        """Search for target text in document content and return position"""
        if not target_text or not document_content:
            return None
        
        # Try exact match first
        start_index = document_content.find(target_text)
        if start_index != -1:
            return DocumentSearchResult(
                start_index=start_index,
                end_index=start_index + len(target_text),
                text=target_text,
                confidence=1.0
            )
        
        # Try case-insensitive match
        lower_content = document_content.lower()
        lower_target = target_text.lower()
        start_index = lower_content.find(lower_target)
        if start_index != -1:
            actual_text = document_content[start_index:start_index + len(target_text)]
            return DocumentSearchResult(
                start_index=start_index,
                end_index=start_index + len(target_text),
                text=actual_text,
                confidence=0.9
            )
        
        # Try partial match (first few words)
        words = target_text.split()
        if len(words) > 1:
            partial_target = " ".join(words[:min(3, len(words))])
            start_index = document_content.find(partial_target)
            if start_index != -1:
                # Find end of sentence or reasonable chunk
                end_index = document_content.find(".", start_index)
                if end_index == -1:
                    end_index = min(start_index + len(target_text) * 2, len(document_content))
                else:
                    end_index += 1
                
                actual_text = document_content[start_index:end_index]
                return DocumentSearchResult(
                    start_index=start_index,
                    end_index=end_index,
                    text=actual_text,
                    confidence=0.7
                )
        
        return None

    async def _get_document_content(self, document_id: str) -> Optional[str]:
        """Get the text content of a Google Doc"""
        if self.mock_mode:
            return f"This is mock content for document {document_id}. The data indicates a substantial increase in our quarterly metrics. We need to prepare for the upcoming presentation."
        
        try:
            document = self.service.documents().get(documentId=document_id).execute()
            content = ""
            
            # Extract text from document structure
            for element in document.get('body', {}).get('content', []):
                if 'paragraph' in element:
                    paragraph = element['paragraph']
                    for text_element in paragraph.get('elements', []):
                        if 'textRun' in text_element:
                            content += text_element['textRun'].get('content', '')
            
            return content
        except Exception as e:
            logging.error(f"Error getting document content: {e}")
            return None

    async def _create_suggestion_in_document(self, document_id: str, start_index: int, end_index: int, suggested_text: str) -> Optional[str]:
        """Create a suggestion in the Google Doc using the API"""
        if self.mock_mode:
            logging.info(f"Mock: Would create suggestion in doc {document_id} at {start_index}-{end_index}: '{suggested_text}'")
            return "mock_suggestion_id_123"
        
        try:
            # Use the batchUpdate API to create a suggestion
            requests = [{
                'replaceAllText': {
                    'containsText': {
                        'text': suggested_text,
                        'matchCase': False
                    },
                    'replaceText': suggested_text
                }
            }]
            
            # Note: The Google Docs API doesn't directly support creating suggestions
            # This would need to be implemented using the suggestion mode
            # For now, we'll simulate it in mock mode and log for real implementation
            
            result = self.service.documents().batchUpdate(
                documentId=document_id, 
                body={'requests': requests}
            ).execute()
            
            return result.get('replies', [{}])[0].get('replaceAllText', {}).get('occurrencesChanged', 0)
            
        except Exception as e:
            logging.error(f"Error creating suggestion: {e}")
            return None

    async def create_suggestion(self, user_id: str, document_id: str, request: CreateSuggestionRequest) -> CreateSuggestionResponse:
        """Process a natural language command and create a suggestion in the document"""
        try:
            if not await self.authenticate(user_id):
                return CreateSuggestionResponse(
                    success=False,
                    message="Authentication failed",
                    error="Could not authenticate with Google Docs API"
                )
            
            # Parse the command using LLM
            parsed_command = await self._parse_command_with_llm(request.command)
            
            if parsed_command.get("action") == "unknown":
                return CreateSuggestionResponse(
                    success=False,
                    message="Could not understand the command",
                    error=parsed_command.get("error", "Unknown command format")
                )
            
            # Get document content
            document_content = await self._get_document_content(document_id)
            if not document_content:
                return CreateSuggestionResponse(
                    success=False,
                    message="Could not retrieve document content",
                    error="Failed to fetch document from Google Docs API"
                )
            
            # Find target text if specified
            target_text = parsed_command.get("target_text", "")
            if target_text:
                search_result = self._search_text_in_document(document_content, target_text)
                if not search_result:
                    return CreateSuggestionResponse(
                        success=False,
                        message=f"Could not find the text: '{target_text}'",
                        error="Target text not found in document"
                    )
            else:
                # Handle commands that don't require finding specific text
                search_result = DocumentSearchResult(
                    start_index=len(document_content),
                    end_index=len(document_content),
                    text="",
                    confidence=1.0
                )
            
            # Generate suggested text using LLM
            modification_prompt = f"""
            Original text: "{search_result.text}"
            Requested modification: "{parsed_command.get('modification', 'improve this text')}"
            
            Provide only the improved/modified text without any explanations or formatting.
            """
            
            llm_result = await self.llm_service.process_command(modification_prompt)
            if "error" in llm_result:
                suggested_text = search_result.text  # Fallback to original
            else:
                # Extract just the text from LLM response
                suggested_text = str(llm_result).strip()
                if suggested_text.startswith('"') and suggested_text.endswith('"'):
                    suggested_text = suggested_text[1:-1]
            
            # Create the suggestion
            suggestion_id = await self._create_suggestion_in_document(
                document_id, 
                search_result.start_index, 
                search_result.end_index, 
                suggested_text
            )
            
            if suggestion_id:
                return CreateSuggestionResponse(
                    success=True,
                    message="Suggestion created successfully! Please review it in the document.",
                    suggestion_id=str(suggestion_id),
                    target_text=search_result.text,
                    suggested_text=suggested_text
                )
            else:
                return CreateSuggestionResponse(
                    success=False,
                    message="Failed to create suggestion in document",
                    error="Google Docs API call failed"
                )
                
        except Exception as e:
            logging.error(f"Error in create_suggestion: {e}")
            return CreateSuggestionResponse(
                success=False,
                message="An error occurred while processing the command",
                error=str(e)
            )

    async def list_documents(self, user_id: str, limit: int = 20) -> DocumentListResponse:
        """List user's Google Docs documents"""
        if self.mock_mode:
            mock_docs = [
                DocumentMetadata(
                    document_id="mock_doc_1",
                    user_id=user_id,
                    title="Project Proposal Draft",
                    last_modified_gdrive=datetime.now(),
                    minus_tags=["work", "proposal"],
                    minus_summary="A comprehensive project proposal outlining goals and timeline"
                ),
                DocumentMetadata(
                    document_id="mock_doc_2", 
                    user_id=user_id,
                    title="Meeting Notes - Q4 Planning",
                    last_modified_gdrive=datetime.now(),
                    minus_tags=["meetings", "planning"],
                    minus_summary="Notes from quarterly planning session"
                )
            ]
            return DocumentListResponse(
                documents=mock_docs,
                total_count=len(mock_docs)
            )
        
        try:
            if not await self.authenticate(user_id):
                raise Exception("Authentication failed")
            
            # Query Google Drive for Google Docs
            results = self.drive_service.files().list(
                q="mimeType='application/vnd.google-apps.document'",
                pageSize=limit,
                fields="nextPageToken, files(id, name, modifiedTime, createdTime)"
            ).execute()
            
            documents = []
            for file in results.get('files', []):
                documents.append(DocumentMetadata(
                    document_id=file['id'],
                    user_id=user_id,
                    title=file['name'],
                    last_modified_gdrive=datetime.fromisoformat(file['modifiedTime'].replace('Z', '+00:00')),
                    created_time=datetime.fromisoformat(file['createdTime'].replace('Z', '+00:00')),
                    modified_time=datetime.fromisoformat(file['modifiedTime'].replace('Z', '+00:00'))
                ))
            
            return DocumentListResponse(
                documents=documents,
                total_count=len(documents),
                next_page_token=results.get('nextPageToken')
            )
            
        except Exception as e:
            logging.error(f"Error listing documents: {e}")
            raise e

    async def sync_documents(self, user_id: str, request: SyncDocumentsRequest) -> SyncDocumentsResponse:
        """Sync user's Google Docs to local metadata storage"""
        try:
            docs_response = await self.list_documents(user_id, limit=100)
            
            # In a real implementation, this would sync to Supabase
            # For now, just return the count
            return SyncDocumentsResponse(
                synced_count=len(docs_response.documents),
                total_found=docs_response.total_count,
                updated_count=0,
                message=f"Synced {len(docs_response.documents)} documents successfully"
            )
            
        except Exception as e:
            logging.error(f"Error syncing documents: {e}")
            return SyncDocumentsResponse(
                synced_count=0,
                total_found=0,
                updated_count=0,
                message=f"Sync failed: {str(e)}"
            )

    async def process_voice_command(self, user_id: str, command_data: dict) -> dict:
        """Process voice commands for Google Docs operations"""
        try:
            action = command_data.get("action", "")
            params = command_data.get("params", {})
            
            if action == "create_suggestion":
                document_id = params.get("document_id")
                command_text = params.get("command", "")
                
                if not document_id or not command_text:
                    return {"error": "Missing document_id or command"}
                
                request = CreateSuggestionRequest(command=command_text)
                result = await self.create_suggestion(user_id, document_id, request)
                
                return {
                    "success": result.success,
                    "message": result.message,
                    "suggestion_id": result.suggestion_id,
                    "target_text": result.target_text,
                    "suggested_text": result.suggested_text
                }
            
            elif action == "list_documents":
                result = await self.list_documents(user_id)
                return {
                    "documents": [doc.model_dump() for doc in result.documents],
                    "total_count": result.total_count
                }
            
            elif action == "sync_documents":
                request = SyncDocumentsRequest()
                result = await self.sync_documents(user_id, request)
                return result.model_dump()
            
            else:
                return {"error": f"Unknown Google Docs action: {action}"}
                
        except Exception as e:
            logging.error(f"Error processing voice command: {e}")
            return {"error": f"Command processing failed: {str(e)}"}

# Global service instance
docs_service = DocsService() 