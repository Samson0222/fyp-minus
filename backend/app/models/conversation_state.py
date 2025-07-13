from pydantic import BaseModel
from typing import Optional

class ConversationState(BaseModel):
    """
    Holds the context of a conversation, like the last items that were accessed.
    """
    last_event_id: Optional[str] = None
    last_email_id: Optional[str] = None
    last_thread_id: Optional[str] = None
    last_draft_id: Optional[str] = None
    last_recipient_email: Optional[str] = None
    # You can add more later, e.g.:
    # last_doc_id: Optional[str] = None