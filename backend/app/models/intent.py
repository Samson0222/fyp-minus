from pydantic import BaseModel, Field
from typing import Optional, Literal

class Intent(BaseModel):
    """The classified intent and extracted entities from a user's request."""
    intent: Literal['create_event', 'edit_event', 'find_event', 'list_events', 'general_chat'] = Field(
        description="The user's primary goal."
    )
    event_description: Optional[str] = Field(
        None, description="The specific subject of the event the user is referring to (for `find_event` or `edit_event`)."
    )
    summary: Optional[str] = Field(None, description="The new or updated title for the event.")
    start_time: Optional[str] = Field(None, description="The new or updated start time in natural language.")
    end_time: Optional[str] = Field(None, description="The new or updated end time in natural language.")
    description: Optional[str] = Field(None, description="The new or updated description for the event.")
    search_start_date: Optional[str] = Field(None, description="The start date of a search query, e.g., 'today', 'this year'.")
    search_end_date: Optional[str] = Field(None, description="The end date of a search query, e.g., 'tomorrow', 'end of month'.")