from pydantic import BaseModel, Field
from typing import Optional, Literal

class Intent(BaseModel):
    """The classified intent and extracted entities from a user's request."""
    intent: Literal[
        'create_event', 'edit_event', 'find_event', 'list_events', 
        'list_emails', 'find_email', 'compose_email', 'reply_to_email', 'send_email_draft', 'refine_email_draft', 'cancel_email_draft',
        'find_telegram_chat', 'reply_to_telegram', 'summarize_telegram_chat', 'send_telegram_draft', 'get_latest_telegram_message',
        'summarize_all_unread_telegram',
        'list_documents', 'open_document', 'close_document', 'summarize_document', 'create_document', 'edit_document', 'apply_suggestion', 'reject_suggestion',
        'general_chat'
    ] = Field(description="The user's primary goal.")
    
    # Calendar-specific fields
    event_description: Optional[str] = Field(
        None, description="The specific subject of the event the user is referring to (for `find_event` or `edit_event`)."
    )
    summary: Optional[str] = Field(None, description="The new or updated title for the event.")
    start_time: Optional[str] = Field(None, description="The new or updated start time in natural language.")
    end_time: Optional[str] = Field(None, description="The new or updated end time in natural language.")
    description: Optional[str] = Field(None, description="The new or updated description for the event.")
    search_start_date: Optional[str] = Field(None, description="The start date of a search query, e.g., 'today', 'this year'.")
    search_end_date: Optional[str] = Field(None, description="The end date of a search query, e.g., 'tomorrow', 'end of month'.")

    # Email-specific fields
    query: Optional[str] = Field(None, description="The search query for listing or finding emails.")
    email_to: Optional[str] = Field(None, description="The recipient for a new email.")
    email_subject: Optional[str] = Field(None, description="The subject for a new email.")
    email_body: Optional[str] = Field(None, description="The body content for a new email or a reply.")
    email_query: Optional[str] = Field(None, description="The query to find a specific email to reply to.")
    draft_id: Optional[str] = Field(None, description="The ID of the draft to be sent.")
    
    # Telegram-specific fields
    chat_query: Optional[str] = Field(None, description="The query to find a specific Telegram chat.")
    message_body: Optional[str] = Field(None, description="The body content for a new Telegram message.")
    
    # Google Docs-specific fields
    document_query: Optional[str] = Field(None, description="The query to find a specific document.")
    title: Optional[str] = Field(None, description="The title for a new document.")
    target_text: Optional[str] = Field(None, description="The specific text to find and modify in a document.")
    modification: Optional[str] = Field(None, description="The description of what changes to make to the document.")
    new_content: Optional[str] = Field(None, description="New content to add to the document.")
    position: Optional[str] = Field(None, description="Where to place new content: 'before', 'after', or 'replace'.")
    suggestion_id: Optional[str] = Field(None, description="The ID of a document suggestion to apply or reject.")