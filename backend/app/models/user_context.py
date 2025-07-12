from pydantic import BaseModel, Field
from typing import Optional

class UserContext(BaseModel):
    """
    A standardized model for passing user-specific information, including
    identity and credentials, through the system.
    """
    user_id: str = Field(description="The unique identifier for the user.")
    google_credentials: Optional[str] = Field(default=None, description="The user's Google OAuth token string (optional).") 