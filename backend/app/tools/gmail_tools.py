import asyncio
from typing import List, Optional, Type
from langchain.tools import BaseTool, tool
from pydantic import BaseModel, Field

from app.services.gmail_service import GmailService
from app.models.user_context import UserContext
from app.core.llm_factory import get_llm_service # Import the LLM service

class GmailTool(BaseTool):
    user_context: UserContext

    def _run(self, *args, **kwargs):
        # This method is not used for async tools
        raise NotImplementedError("This tool is async only.")

    async def _arun(self, *args, **kwargs):
        # The actual async implementation
        raise NotImplementedError("Subclasses must implement this.")

    @classmethod
    def from_user_context(cls, user_context: UserContext):
        return cls(user_context=user_context)

# --- Tool for Listing Emails ---
class ListEmailsInput(BaseModel):
    query: str = Field(description="The search query to filter emails, e.g., 'from:elon@tesla.com is:unread'. Follows Gmail's search syntax.")
    max_results: int = Field(10, description="The maximum number of emails to return.")

@tool("list_emails", args_schema=ListEmailsInput)
async def list_emails(query: str, max_results: int = 10, user_context: Optional[UserContext] = None, testing: bool = False) -> List[dict]:
    """
    Searches the user's Gmail inbox for emails matching a given query.
    Returns a list of emails with their ID, thread ID, sender, subject, and a short snippet.
    """
    if not user_context:
        raise ValueError("User context is required to list emails.")
        
    gmail_service = GmailService(user_id=user_context.user_id, testing=testing)
    response = await gmail_service.get_emails(max_results=max_results, query=query, minimal=True)
    # Convert Pydantic models to dictionaries for broader compatibility
    return [email.dict() for email in response.emails]

# --- Tool for Getting Email Details ---
class GetEmailDetailsInput(BaseModel):
    message_id: str = Field(description="The unique ID of the email message to retrieve.")
    summarize: bool = Field(False, description="If true, the AI should generate a summary of the email content instead of returning the full body.")

@tool("get_email_details", args_schema=GetEmailDetailsInput)
async def get_email_details(message_id: str, summarize: bool = False, user_context: Optional[UserContext] = None, testing: bool = False) -> dict:
    """
    Retrieves the full details of a specific email, including its body (plain and HTML), sender, recipients, and subject.
    Optionally, it can return a summary instead of the full content.
    """
    if not user_context:
        raise ValueError("User context is required to get email details.")
        
    gmail_service = GmailService(user_id=user_context.user_id, testing=testing)
    email_message = await gmail_service.get_message(message_id)
    
    result = email_message.dict()
    
    if summarize:
        # Real summarization logic
        email_content = result.get('body_plain', '')
        if not email_content:
            return {"error": "Email has no content to summarize."}
            
        llm_service = get_llm_service() # Get an instance of the LLM
        prompt = f"Please provide a concise, one-paragraph summary of the following email content:\n\n---\n{email_content}\n---"
        
        # FIX: Use the correct method to invoke the LLM and handle the response object
        response = await llm_service.llm.ainvoke(prompt)
        summary_text = response.content if response else "Could not generate summary."
        
        result['summary'] = summary_text
        # Clean up the body fields as they are no longer needed
        if 'body_plain' in result: del result['body_plain']
        if 'body_html' in result: del result['body_html']

    return result

# --- Tool for Creating a Draft Email ---
class CreateDraftEmailInput(BaseModel):
    to: str = Field(description="The recipient's email address.")
    subject: str = Field(description="The subject of the email.")
    body: str = Field(description="The content of the email.")
    thread_id: Optional[str] = Field(None, description="The ID of the email thread to reply to. If omitted, a new thread is created.")

@tool("create_draft_email", args_schema=CreateDraftEmailInput)
async def create_draft_email(to: str, subject: str, body: str, thread_id: Optional[str] = None, user_context: Optional[UserContext] = None, testing: bool = False) -> dict:
    """
    Creates a new draft email in the user's Gmail account.
    This tool prepares the email but DOES NOT send it. The user must approve it first.
    Returns the created draft's ID, which is needed to send it later.
    """
    if not user_context:
        raise ValueError("User context is required to create a draft.")
        
    gmail_service = GmailService(user_id=user_context.user_id, testing=testing)
    draft = await gmail_service.create_draft_email(to, subject, body, thread_id)
    return draft

# --- Tool for Sending a Draft ---
class SendDraftInput(BaseModel):
    draft_id: str = Field(description="The unique ID of the draft to be sent.")

@tool("send_draft", args_schema=SendDraftInput)
async def send_draft(draft_id: str, user_context: Optional[UserContext] = None, testing: bool = False) -> dict:
    """
s    Sends a previously created draft email from the user's account.
    This action is final and should only be triggered after explicit user approval.
    """
    if not user_context:
        raise ValueError("User context is required to send a draft.")
        
    gmail_service = GmailService(user_id=user_context.user_id, testing=testing)
    result = await gmail_service.send_draft(draft_id)
    return result

# --- Tool for Deleting a Draft ---
class DeleteDraftInput(BaseModel):
    draft_id: str = Field(description="The unique ID of the draft to be deleted.")

@tool("delete_draft", args_schema=DeleteDraftInput)
async def delete_draft(draft_id: str, user_context: Optional[UserContext] = None, testing: bool = False) -> dict:
    """
    Deletes a specific draft from the user's account. This is useful for cancelling a draft
    that the user has decided not to send.
    """
    if not user_context:
        raise ValueError("User context is required to delete a draft.")
        
    gmail_service = GmailService(user_id=user_context.user_id, testing=testing)
    result = await gmail_service.delete_draft(draft_id)
    return result

# --- Helper to get all tools ---
def get_gmail_tools(user_context: UserContext) -> List[BaseTool]:
    """Factory function to create all Gmail tools with the given user context."""
    # The @tool decorator already wraps our functions in a BaseTool-compatible object.
    # We just need to ensure the user_context is passed correctly.
    
    # This is a simplified approach. A more robust implementation might involve
    # creating tool instances and binding the user_context at that time.
    # For LangChain's default function-based tools, we rely on the calling agent
    # to pass the context in.
    
    return [
        list_emails,
        get_email_details,
        create_draft_email,
        send_draft,
        delete_draft,
    ] 