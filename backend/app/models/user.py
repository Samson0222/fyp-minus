# backend/app/models/user.py
from pydantic import BaseModel, EmailStr

class User(BaseModel):
    """Represents an authenticated user."""
    id: str
    email: EmailStr 