from pydantic import BaseModel, Field
from typing import Optional

class ConversationState(BaseModel):
    """
    Holds the context of a conversation, like the last items that were accessed.
    """
    last_event_id: Optional[str] = Field(None, description="The ID of the last Google Calendar event that was interacted with.")
    last_email_id: Optional[str] = Field(None, description="The ID of the last email that was interacted with.")
    last_thread_id: Optional[str] = Field(None, description="The Thread ID of the last email thread that was interacted with.")
    last_draft_id: Optional[str] = Field(None, description="The ID of the email draft currently under review.")
    last_recipient_email: Optional[str] = Field(None, description="The email address of the recipient of the last draft.")
    last_telegram_chat_id: Optional[int] = Field(None, description="The ID of the last Telegram chat that was interacted with.")
    last_message_body: Optional[str] = Field(None, description="The body of the last message drafted for Telegram.")
    # You can add more later, e.g.:
    # last_doc_id: Optional[str] = None