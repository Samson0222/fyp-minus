from pydantic import BaseModel
from typing import Optional

class ConversationState(BaseModel):
    """
    Holds the context of a conversation, like the last items that were accessed.
    """
    last_event_id: Optional[str] = None
    # You can add more later, e.g.:
    # last_email_thread_id: Optional[str] = None
    # last_doc_id: Optional[str] = None