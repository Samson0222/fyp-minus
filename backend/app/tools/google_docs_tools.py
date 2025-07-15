import asyncio
import logging
from typing import List, Optional, Dict, Any
from langchain.tools import tool
from pydantic import BaseModel, Field

from app.services.docs_service import DocsService
from app.models.user_context import UserContext

logger = logging.getLogger(__name__)

# --- Pydantic Models for Tool Input Validation ---

class ListDocumentsInput(BaseModel):
    query: str = Field(default="*", description="Search query for documents. Use '*' for all documents.")
    limit: int = Field(default=20, description="Maximum number of documents to return.")
    trashed: bool = Field(default=False, description="Whether to include trashed documents.")

class GetDocumentDetailsInput(BaseModel):
    query: str = Field(..., description="Document name or search query to find a specific document.")

class CreateDocumentInput(BaseModel):
    title: str = Field(..., description="Title for the new document.")

class DraftInitialContentInput(BaseModel):
    document_id: str = Field(..., description="ID of the document to populate.")
    content: str = Field(..., description="Initial content to add to the document.")

class GetDocumentContentInput(BaseModel):
    document_id: str = Field(..., description="ID of the document to read.")
    summarize: bool = Field(default=False, description="Whether to return a summary instead of full content.")

class CreateDocumentSuggestionInput(BaseModel):
    document_id: str = Field(..., description="ID of the document to create a suggestion for.")
    target_text: Optional[str] = Field(None, description="Text to find and modify (if applicable).")
    modification: str = Field(..., description="Description of the modification to make.")
    new_content: Optional[str] = Field(None, description="New content to add (if applicable).")
    position: Optional[str] = Field("replace", description="Position for new content: 'before', 'after', or 'replace'.")

class ApplyDocumentSuggestionInput(BaseModel):
    suggestion_id: str = Field(..., description="ID of the suggestion to apply.")
    document_id: str = Field(..., description="ID of the document containing the suggestion.")

class RejectDocumentSuggestionInput(BaseModel):
    suggestion_id: str = Field(..., description="ID of the suggestion to reject.")
    document_id: str = Field(..., description="ID of the document containing the suggestion.")

# --- Google Docs Tools ---

@tool("list_documents", args_schema=ListDocumentsInput)
async def list_documents(query: str = "*", limit: int = 20, trashed: bool = False, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Search and list the user's Google Docs documents.
    
    Args:
        query: Search query for documents. Use '*' for all documents.
        limit: Maximum number of documents to return.
        trashed: Whether to include trashed documents.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing list of documents or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        docs_service = DocsService(user_id=user_context.user_id)
        
        print(f"DocsTool: Calling list_documents service with search_query: '{query}'")
        
        result = await docs_service.list_documents(limit=limit, trashed=trashed, search_query=query)
        
        if not result or not hasattr(result, 'documents'):
            logger.warning(f"No documents returned or invalid response for user {user_context.user_id}")
            return {"error": "Failed to retrieve documents. The response was empty or invalid."}
        
        # Format the response for the AI agent
        documents = []
        for doc in result.documents:
            documents.append({
                "document_id": doc.document_id,
                "title": doc.title,
                "last_modified": doc.last_modified_gdrive.isoformat(),
                "summary": doc.minus_summary,
                "tags": doc.minus_tags
            })
        
        logger.info(f"Listed {len(documents)} documents for user {user_context.user_id}")
        return {
            "success": True,
            "documents": documents,
            "total_count": result.total_count
        }
        
    except Exception as e:
        logger.error(f"Error in list_documents tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to list documents: {str(e)}"}

@tool("get_document_details", args_schema=GetDocumentDetailsInput)
async def get_document_details(query: str, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Find a specific document by name and return its details including document_id.
    
    Args:
        query: Document name or search query to find a specific document.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing document details or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        docs_service = DocsService(user_id=user_context.user_id)
        
        print(f"DocsTool: Calling get_document_details service with search_query: '{query}'")
        
        # First, search for documents matching the query
        result = await docs_service.list_documents(limit=20, trashed=False, search_query=query)
        
        if not result or not hasattr(result, 'documents'):
            logger.warning(f"No documents found for user {user_context.user_id} when searching for '{query}'")
            return {"error": "Could not retrieve any documents to search for details."}
        
        # This part of the logic is now redundant because the search is done at the API level.
        # However, we'll keep it as a client-side filter for exact matches if needed,
        # or it can be simplified if the API-level search is sufficient.
        
        # Find the best match for the query
        matches = []
        query_lower = query.lower()
        
        for doc in result.documents:
            # The API does a 'contains' search, here we can be more specific if needed
            # For now, we assume any result from the API is a valid match.
            matches.append({
                "document_id": doc.document_id,
                "title": doc.title,
                "last_modified": doc.last_modified_gdrive.isoformat(),
                "summary": doc.minus_summary,
                "tags": doc.minus_tags
            })
        
        logging.info(f"DocsTool: Found {len(matches)} potential matches for query '{query}'.")

        if not matches:
            logger.info(f"No document found matching '{query}' for user {user_context.user_id}")
            return {"error": f"No document found matching '{query}'. Please check the document name."}
        
        if len(matches) == 1:
            logger.info(f"Found document '{matches[0]['title']}' for user {user_context.user_id}")
            return {
                "success": True,
                "document": matches[0]
            }
        else:
            # Multiple matches - return them for clarification
            logger.info(f"Found {len(matches)} potential matches for '{query}' for user {user_context.user_id}")
            return {
                "success": False,
                "multiple_matches": True,
                "documents": matches,
                "message": f"Found {len(matches)} documents matching '{query}'. Please be more specific."
            }
        
    except Exception as e:
        logger.error(f"Error in get_document_details tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to get document details: {str(e)}"}

@tool("create_document", args_schema=CreateDocumentInput)
async def create_document(title: str, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Create a new, blank Google Docs document.
    
    Args:
        title: Title for the new document.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing new document details or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        docs_service = DocsService(user_id=user_context.user_id)
        
        logger.info(f"Attempting to create document '{title}' for user {user_context.user_id}")
        
        # Use the DocsService to create the document
        result = await docs_service.create_document(title)
        
        if result.get("success"):
            logger.info(f"Successfully created document '{title}' with ID {result.get('document_id')} for user {user_context.user_id}")
            return {
                "success": True,
                "document_id": result.get("document_id"),
                "title": result.get("title"),
                "message": result.get("message")
            }
        else:
            logger.error(f"Failed to create document '{title}' for user {user_context.user_id}: {result.get('error')}")
            return {"error": result.get("error", "Unknown error occurred during document creation")}
        
    except Exception as e:
        logger.error(f"Error in create_document tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to create document: {str(e)}"}

@tool("draft_initial_content", args_schema=DraftInitialContentInput)
async def draft_initial_content(document_id: str, content: str, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Populate an empty document with initial draft content.
    
    Args:
        document_id: ID of the document to populate.
        content: Initial content to add to the document.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing operation result or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        docs_service = DocsService(user_id=user_context.user_id)
        
        # This would use the create_suggestion functionality to add initial content
        logger.info(f"Attempting to draft initial content for document {document_id} for user {user_context.user_id}")
        return {
            "success": False,
            "error": "Initial content drafting is not yet implemented. Please use create_document_suggestion for modifications."
        }
        
    except Exception as e:
        logger.error(f"Error in draft_initial_content tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to draft initial content: {str(e)}"}

@tool("get_document_content", args_schema=GetDocumentContentInput)
async def get_document_content(document_id: str, summarize: bool = False, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Retrieve the text content of a Google Docs document, optionally summarized.
    
    Args:
        document_id: ID of the document to read.
        summarize: Whether to return a summary instead of full content.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing document content or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        docs_service = DocsService(user_id=user_context.user_id)
        
        logger.debug(f"Getting content for doc_id: {document_id}, summarize: {summarize}, user: {user_context.user_id}")
        # Use the existing DocsService method
        result = await docs_service.get_document_content(document_id)
        
        if not result.success:
            return {"error": result.message}
        
        content = result.content
        if summarize and content:
            # Use the LLM service to summarize
            logging.info(f"Summarizing content for document {document_id} for user {user_context.user_id}")
            # This is a simplified call; a real implementation might need more robust prompt engineering.
            summary_prompt = f"Please provide a concise, three-sentence summary of the following document content:\n\n---\n{content[:4000]}...\n---"
            
            # Use the generate_text method instead of process_command for plain text generation
            try:
                summary_text = await docs_service.llm_service.generate_text(summary_prompt)
                if summary_text and not summary_text.startswith("Error"):
                    content = summary_text
                else:
                    logging.warning(f"Summarization failed for document {document_id}. Returning full content as fallback.")
            except Exception as e:
                logging.error(f"Summarization error for document {document_id}: {e}")
                logging.warning(f"Summarization failed for document {document_id}. Returning full content as fallback.")
        
        logging.info(f"Successfully retrieved content for document {document_id} for user {user_context.user_id}")
        return {
            "success": True,
            "document_id": document_id,
            "content": content,
            "is_summary": summarize
        }
        
    except Exception as e:
        logger.error(f"Error in get_document_content tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to get document content: {str(e)}"}

@tool("create_document_suggestion", args_schema=CreateDocumentSuggestionInput)
async def create_document_suggestion(
    document_id: str, 
    modification: str, 
    target_text: Optional[str] = None,
    new_content: Optional[str] = None,
    position: str = "replace",
    user_context: UserContext = None
) -> Dict[str, Any]:
    """
    Create a suggestion for editing a Google Docs document.
    
    Args:
        document_id: ID of the document to create a suggestion for.
        modification: Description of the modification to make.
        target_text: Text to find and modify (if applicable).
        new_content: New content to add (if applicable).
        position: Position for new content: 'before', 'after', or 'replace'.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing suggestion details or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        docs_service = DocsService(user_id=user_context.user_id)
        
        logger.debug(f"Creating suggestion for doc_id: {document_id}, user: {user_context.user_id}, modification: '{modification}'")
        
        # Build the command string for the existing DocsService
        command_parts = [modification]
        if target_text:
            command_parts.append(f"Target text: '{target_text}'")
        if new_content:
            command_parts.append(f"New content: '{new_content}'")
        if position != "replace":
            command_parts.append(f"Position: {position}")
        
        command = ". ".join(command_parts)
        
        logger.debug(f"Constructed command for LLM: '{command}'")
        
        from app.models.docs import CreateSuggestionRequest
        request = CreateSuggestionRequest(command=command)
        
        result = await docs_service.create_suggestion(document_id, request)
        
        if not result.success:
            logger.error(f"Failed to create suggestion for document {document_id}: {result.message}")
            return {"error": result.message}
        
        logger.info(f"Successfully created suggestion {result.suggestion_id} for document {document_id} for user {user_context.user_id}")
        return {
            "success": True,
            "suggestion_id": result.suggestion_id,
            "document_id": document_id,
            "modification": modification,
            "message": result.message,
            "target_text": result.target_text,
            "suggested_text": result.suggested_text
        }
        
    except Exception as e:
        logger.error(f"Error in create_document_suggestion tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to create document suggestion: {str(e)}"}

@tool("apply_document_suggestion", args_schema=ApplyDocumentSuggestionInput)
async def apply_document_suggestion(suggestion_id: str, document_id: str, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Apply a previously created suggestion to a Google Docs document.
    
    Args:
        suggestion_id: ID of the suggestion to apply.
        document_id: ID of the document containing the suggestion.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing operation result or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        logger.debug(f"Applying suggestion {suggestion_id} to doc {document_id} for user {user_context.user_id}")
        docs_service = DocsService(user_id=user_context.user_id)
        
        # Use the existing DocsService method
        result = await docs_service.apply_suggestion(suggestion_id)
        
        if not result:
            logger.error(f"Applying suggestion {suggestion_id} failed for user {user_context.user_id}")
            return {"error": "Failed to apply suggestion. The suggestion may not exist or you may not have permission."}
        
        logger.info(f"Applied suggestion {suggestion_id} for document {document_id} for user {user_context.user_id}")
        return {
            "success": True,
            "suggestion_id": suggestion_id,
            "document_id": document_id,
            "message": "Suggestion has been successfully applied to the document."
        }
        
    except Exception as e:
        logger.error(f"Error in apply_document_suggestion tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to apply suggestion: {str(e)}"}

@tool("reject_document_suggestion", args_schema=RejectDocumentSuggestionInput)
async def reject_document_suggestion(suggestion_id: str, document_id: str, user_context: UserContext = None) -> Dict[str, Any]:
    """
    Reject a previously created suggestion for a Google Docs document.
    
    Args:
        suggestion_id: ID of the suggestion to reject.
        document_id: ID of the document containing the suggestion.
        user_context: User context with authentication credentials.
    
    Returns:
        Dictionary containing operation result or error message.
    """
    try:
        if not user_context:
            return {"error": "User context is required for document operations."}
        
        logger.debug(f"Rejecting suggestion {suggestion_id} in doc {document_id} for user {user_context.user_id}")
        docs_service = DocsService(user_id=user_context.user_id)
        
        # Use the existing DocsService method
        result = await docs_service.reject_suggestion(suggestion_id)
        
        if not result:
            logger.error(f"Rejecting suggestion {suggestion_id} failed for user {user_context.user_id}")
            return {"error": "Failed to reject suggestion. The suggestion may not exist or you may not have permission."}
        
        logger.info(f"Rejected suggestion {suggestion_id} for document {document_id} for user {user_context.user_id}")
        return {
            "success": True,
            "suggestion_id": suggestion_id,
            "document_id": document_id,
            "message": "Suggestion has been rejected and removed from the document."
        }
        
    except Exception as e:
        logger.error(f"Error in reject_document_suggestion tool for user {user_context.user_id}: {e}", exc_info=True)
        return {"error": f"Failed to reject suggestion: {str(e)}"}

# --- Helper Functions ---

def get_docs_tools(user_context: UserContext) -> List:
    """Factory function to create all Google Docs tools with the given user context."""
    return [
        list_documents,
        get_document_details,
        create_document,
        draft_initial_content,
        get_document_content,
        create_document_suggestion,
        apply_document_suggestion,
        reject_document_suggestion,
    ]