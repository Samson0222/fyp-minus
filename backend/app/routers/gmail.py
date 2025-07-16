from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
import os
from pydantic import BaseModel

from app.models.email import (
    EmailListResponse, SendEmailRequest, SendEmailResponse, 
    VoiceEmailCommand, EmailMessage
)
from app.services.gmail_service import GmailService
# from app.services.voice_email_processor import voice_email_processor

logger = logging.getLogger(__name__)

class VoiceCommandRequest(BaseModel):
    command: str

# Get the same auth dependency from main.py
async def get_current_user(authorization: Optional[str] = None):
    """Extract user from authentication - simplified for demo but more robust"""
    try:
        # In production, this would properly validate the JWT token
        # For now, using a consistent test user with proper error handling
        user_id = "cbede3b0-2f68-47df-9c26-09a46e588567"
        logger.info(f"Authenticated user: {user_id}")
        return {"user_id": user_id, "email": "test@example.com"}
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        # Return a fallback user to prevent complete failure
        return {"user_id": "fallback_user", "email": "fallback@example.com"}

router = APIRouter(
    prefix="/api/v1/gmail",
    tags=["gmail"],
    responses={404: {"description": "Not found"}},
)

# ----------------------------
# Authentication Status Check
# ----------------------------
@router.get("/auth-status", summary="Check Gmail Auth Status")
async def gmail_auth_status(user = Depends(get_current_user)):
    """Quickly verify if the current user has a valid Gmail token by attempting to instantiate GmailService."""
    try:
        GmailService(user["user_id"])
        return {"authenticated": True}
    except Exception as e:
        # Log at debug level to avoid noisy logs for expected unauthenticated cases
        logger.debug(f"Gmail auth status check failed for user {user['user_id']}: {e}")
        return {"authenticated": False}

@router.get("/emails", response_model=EmailListResponse)
async def get_emails(
    count: int = 20,
    minimal: bool = False,
    unread_only: bool = False,
    sent_only: bool = False,
    query: str = "",
    user = Depends(get_current_user)
):
    """Get emails (fast when minimal=true)"""
    user_id = user["user_id"]
    gmail_service = GmailService(user_id)
    gmail_query = query
    if unread_only:
        gmail_query = f"is:unread {gmail_query}".strip()
    if sent_only:
        gmail_query = f"in:sent {gmail_query}".strip()
    try:
        return await gmail_service.get_emails(max_results=count, query=gmail_query, minimal=minimal)
    except Exception as e:
        logger.error(f"Error fetching emails for user {user_id}: {e}", exc_info=True)
        if "User is not authenticated" in str(e):
            raise HTTPException(status_code=401, detail=str(e))
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    email_request: SendEmailRequest,
    user = Depends(get_current_user)
):
    """Send email via Gmail"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        result = await gmail_service.send_email(
            email_request=email_request
        )
        
        logger.info(f"Email sent successfully by user {user_id} to {email_request.to}")
        return result
        
    except Exception as e:
        logger.error(f"Error sending email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")

@router.post("/mark-read/{message_id}")
async def mark_email_as_read(
    message_id: str,
    user = Depends(get_current_user)
):
    """Mark email as read"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        success = await gmail_service.mark_as_read(
            message_id=message_id
        )
        
        if success:
            return {"status": "success", "message": "Email marked as read"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark email as read")
            
    except Exception as e:
        logger.error(f"Error marking email as read: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark email as read: {str(e)}")

@router.post("/mark-unread/{message_id}")
async def mark_email_as_unread(
    message_id: str,
    user = Depends(get_current_user)
):
    """Mark email as unread"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        success = await gmail_service.mark_as_unread(
            message_id=message_id
        )
        
        if success:
            return {"status": "success", "message": "Email marked as unread"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark email as unread")
            
    except Exception as e:
        logger.error(f"Error marking email as unread: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark email as unread: {str(e)}")

@router.post("/star/{message_id}")
async def star_email(
    message_id: str,
    user = Depends(get_current_user)
):
    """Star an email"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        success = await gmail_service.star_email(
            message_id=message_id
        )
        
        if success:
            return {"status": "success", "message": "Email starred"}
        else:
            raise HTTPException(status_code=500, detail="Failed to star email")
            
    except Exception as e:
        logger.error(f"Error starring email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to star email: {str(e)}")

@router.post("/unstar/{message_id}")
async def unstar_email(
    message_id: str,
    user = Depends(get_current_user)
):
    """Unstar an email"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        success = await gmail_service.unstar_email(
            message_id=message_id
        )
        
        if success:
            return {"status": "success", "message": "Email unstarred"}
        else:
            raise HTTPException(status_code=500, detail="Failed to unstar email")
            
    except Exception as e:
        logger.error(f"Error unstarring email: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to unstar email: {str(e)}")

@router.post("/mark-important/{message_id}")
async def mark_email_as_important(
    message_id: str,
    user = Depends(get_current_user)
):
    """Mark email as important"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        success = await gmail_service.mark_as_important(
            message_id=message_id
        )
        
        if success:
            return {"status": "success", "message": "Email marked as important"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark email as important")
            
    except Exception as e:
        logger.error(f"Error marking email as important: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark email as important: {str(e)}")

@router.post("/mark-unimportant/{message_id}")
async def mark_email_as_unimportant(
    message_id: str,
    user = Depends(get_current_user)
):
    """Mark email as not important"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        success = await gmail_service.mark_as_unimportant(
            message_id=message_id
        )
        
        if success:
            return {"status": "success", "message": "Email marked as not important"}
        else:
            raise HTTPException(status_code=500, detail="Failed to mark email as not important")
            
    except Exception as e:
        logger.error(f"Error marking email as not important: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark email as not important: {str(e)}")

@router.post("/search", response_model=EmailListResponse)
async def search_emails(
    query: str,
    count: int = 10,
    user = Depends(get_current_user)
):
    """Search emails"""
    try:
        user_id = user["user_id"]
        gmail_service = GmailService(user_id)
        
        result = await gmail_service.search_emails(
            query=query,
            max_results=count
        )
        
        logger.info(f"Search completed for user {user_id}, found {len(result.emails)} emails")
        return result
        
    except Exception as e:
        logger.error(f"Error searching emails: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search emails: {str(e)}")

@router.get("/message/{message_id}", response_model=EmailMessage)
async def get_message(message_id: str, user = Depends(get_current_user)):
    """Get a single email message by ID"""
    user_id = user["user_id"]
    gmail_service = GmailService(user_id)
    return await gmail_service.get_message(message_id=message_id) 