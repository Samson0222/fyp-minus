from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

class EmailAttachment(BaseModel):
    """Email attachment model"""
    filename: str
    content_type: str
    size: int
    attachment_id: Optional[str] = None

class EmailSender(BaseModel):
    """Email sender model"""
    name: Optional[str] = None
    email: EmailStr

class EmailRecipient(BaseModel):
    """Email recipient model"""
    name: Optional[str] = None
    email: EmailStr

class EmailMessage(BaseModel):
    """Gmail message model"""
    id: str
    thread_id: str
    subject: str
    sender: EmailSender
    recipients: List[EmailRecipient]
    cc: Optional[List[EmailRecipient]] = []
    bcc: Optional[List[EmailRecipient]] = []
    body_plain: Optional[str] = None
    body_html: Optional[str] = None
    date: datetime
    is_read: bool = False
    is_important: bool = False
    labels: List[str] = []
    attachments: List[EmailAttachment] = []
    snippet: Optional[str] = None

class EmailListResponse(BaseModel):
    """Response model for email list"""
    emails: List[EmailMessage]
    total_count: int
    next_page_token: Optional[str] = None

class SendEmailRequest(BaseModel):
    """Request model for sending emails"""
    to: List[EmailStr]
    cc: Optional[List[EmailStr]] = []
    bcc: Optional[List[EmailStr]] = []
    subject: str
    body_plain: Optional[str] = None
    body_html: Optional[str] = None
    attachments: Optional[List[Dict[str, Any]]] = []

class SendEmailResponse(BaseModel):
    """Response model for sending emails"""
    message_id: str
    thread_id: str
    status: str
    message: str

class VoiceEmailCommand(BaseModel):
    """Voice command for email operations"""
    command_type: str  # 'read_emails', 'send_email', 'search_emails'
    parameters: Dict[str, Any] = {}
    raw_command: str