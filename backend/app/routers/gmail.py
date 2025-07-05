from fastapi import APIRouter, HTTPException, Depends
from typing import Optional
import logging
import os
from pydantic import BaseModel

from app.models.email import (
    EmailListResponse, SendEmailRequest, SendEmailResponse, 
    VoiceEmailCommand, EmailMessage
)
from app.services.gmail_service import gmail_service
from app.services.voice_email_processor import voice_email_processor

class VoiceCommandRequest(BaseModel):
    command: str

# Get the same auth dependency from main.py
async def get_current_user(authorization: Optional[str] = None):
    """Extract user from authentication - simplified for demo but more robust"""
    try:
        # In production, this would properly validate the JWT token
        # For now, using a consistent test user with proper error handling
        user_id = "test_user_001"
        logger.info(f"Authenticated user: {user_id}")
        return {"user_id": user_id, "email": "test@example.com"}
    except Exception as e:
        logger.error(f"Authentication error: {e}")
        # Return a fallback user to prevent complete failure
        return {"user_id": "fallback_user", "email": "fallback@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/gmail", tags=["gmail"])

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
    gmail_query = query
    if unread_only:
        gmail_query = f"is:unread {gmail_query}".strip()
    if sent_only:
        gmail_query = f"in:sent {gmail_query}".strip()
    return await gmail_service.get_emails(user_id, max_results=count, query=gmail_query, minimal=minimal)

@router.post("/send", response_model=SendEmailResponse)
async def send_email(
    email_request: SendEmailRequest,
    user = Depends(get_current_user)
):
    """Send email via Gmail"""
    try:
        user_id = user["user_id"]
        
        result = await gmail_service.send_email(
            user_id=user_id,
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
        
        success = await gmail_service.mark_as_read(
            user_id=user_id,
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
        
        success = await gmail_service.mark_as_unread(
            user_id=user_id,
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
        
        success = await gmail_service.star_email(
            user_id=user_id,
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
        
        success = await gmail_service.unstar_email(
            user_id=user_id,
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
        
        success = await gmail_service.mark_as_important(
            user_id=user_id,
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
        
        success = await gmail_service.mark_as_unimportant(
            user_id=user_id,
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
        
        result = await gmail_service.search_emails(
            user_id=user_id,
            query=query,
            max_results=count
        )
        
        logger.info(f"Search completed for user {user_id}, found {len(result.emails)} emails")
        return result
        
    except Exception as e:
        logger.error(f"Error searching emails: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to search emails: {str(e)}")

@router.post("/test-voice")
async def test_voice_command(request: VoiceCommandRequest):
    """Test voice command processing without authentication for debugging"""
    try:
        command = request.command
        logger.info(f"TEST: Processing command: '{command}'")
        
        # Parse the voice command
        parsed_command = voice_email_processor.parse_command(command)
        logger.info(f"TEST: Parsed command type: {parsed_command.command_type}")
        logger.info(f"TEST: Parsed parameters: {parsed_command.parameters}")
        
        response_message = voice_email_processor.generate_response(parsed_command)
        logger.info(f"TEST: Generated response: {response_message}")
        
        return {
            "command_type": parsed_command.command_type,
            "response": response_message,
            "parsed_parameters": parsed_command.parameters,
            "test_mode": True
        }
        
    except Exception as e:
        logger.error(f"TEST: Error processing command: {e}")
        return {
            "command_type": "error",
            "response": f"Test error: {str(e)}",
            "parsed_parameters": {},
            "test_mode": True
        }

@router.post("/voice-command")
async def process_voice_email_command(
    request: VoiceCommandRequest,
    user = Depends(get_current_user)
):
    """Process voice command for email operations"""
    try:
        user_id = user["user_id"]
        command = request.command
        
        logger.info(f"Processing voice command for user {user_id}: '{command}'")
        
        # Parse the voice command
        parsed_command = voice_email_processor.parse_command(command)
        logger.info(f"Parsed voice command: {parsed_command.command_type} with parameters: {parsed_command.parameters}")
        
        result = None
        response_message = ""
        
        if parsed_command.command_type == 'read_emails':
            # Get emails
            count = parsed_command.parameters.get('count', 10)
            unread_only = parsed_command.parameters.get('unread_only', False)
            
            gmail_query = "is:unread" if unread_only else ""
            result = await gmail_service.get_emails(
                user_id=user_id,
                max_results=count,
                query=gmail_query
            )
            response_message = voice_email_processor.generate_response(parsed_command, result)
            
        elif parsed_command.command_type == 'read_unread':
            # Get unread emails
            result = await gmail_service.get_emails(
                user_id=user_id,
                max_results=20,
                query="is:unread"
            )
            response_message = voice_email_processor.generate_response(parsed_command, result)
            
        elif parsed_command.command_type == 'send_email':
            # Check if we have enough info to send
            params = parsed_command.parameters
            if 'recipient' in params and 'subject' in params:
                # We have enough info, send the email
                send_request = voice_email_processor.create_send_request(parsed_command)
                result = await gmail_service.send_email(user_id, send_request)
                response_message = voice_email_processor.generate_response(parsed_command, result)
            else:
                # Need more information
                missing = []
                if 'recipient' not in params:
                    missing.append("recipient")
                if 'subject' not in params:
                    missing.append("subject")
                response_message = f"I need more information to send the email. Please provide: {', '.join(missing)}."
                
        elif parsed_command.command_type == 'search_emails':
            # Search emails
            search_query = parsed_command.parameters.get('query', '')
            count = parsed_command.parameters.get('count', 10)
            
            result = await gmail_service.search_emails(
                user_id=user_id,
                query=search_query,
                max_results=count
            )
            response_message = voice_email_processor.generate_response(parsed_command, result)
            
        elif parsed_command.command_type == 'switch_account':
            # Sign out current account
            token_path = f"tokens/token_{user_id}.json"
            if os.path.exists(token_path):
                os.remove(token_path)
            gmail_service.credentials = None
            gmail_service.service = None
            response_message = voice_email_processor.generate_response(parsed_command)
            
        elif parsed_command.command_type == 'mark_as_unread':
            # Mark email as unread - this would typically need an email ID
            # For now, return instruction for user
            response_message = voice_email_processor.generate_response(parsed_command)
            
        elif parsed_command.command_type == 'refresh_emails':
            # Refresh emails - get latest emails
            result = await gmail_service.get_emails(
                user_id=user_id,
                max_results=15,
                query="",
                minimal=True
            )
            response_message = voice_email_processor.generate_response(parsed_command, result)
            
        elif parsed_command.command_type == 'reply_email':
            # Reply to email - would need selected email context in real implementation
            response_message = voice_email_processor.generate_response(parsed_command)
            
        elif parsed_command.command_type == 'forward_email':
            # Forward email - would need selected email context in real implementation
            response_message = voice_email_processor.generate_response(parsed_command)
            
        elif parsed_command.command_type == 'send_email_simple':
            # Simple compose without full details
            response_message = voice_email_processor.generate_response(parsed_command)
            
        elif parsed_command.command_type == 'star_email':
            # Star email - would need selected email context in real implementation
            response_message = voice_email_processor.generate_response(parsed_command)
            
        elif parsed_command.command_type == 'mark_important':
            # Mark as important - would need selected email context in real implementation
            response_message = voice_email_processor.generate_response(parsed_command)
            
        else:
            logger.warning(f"Unhandled command type: {parsed_command.command_type}")
            response_message = voice_email_processor.generate_response(parsed_command)
        
        logger.info(f"Voice command processed successfully: {parsed_command.command_type}")
        return {
            "command_type": parsed_command.command_type,
            "response": response_message,
            "data": result,
            "requires_followup": parsed_command.command_type == 'send_email' and not result,
            "parsed_parameters": parsed_command.parameters
        }
        
    except Exception as e:
        logger.error(f"Error processing voice email command: {e}")
        logger.error(f"Command was: {request.command}")
        return {
            "command_type": "error",
            "response": f"Sorry, I encountered an error processing your command: {str(e)}",
            "data": None,
            "requires_followup": False,
            "parsed_parameters": {}
        }

@router.get("/auth-status")
async def get_auth_status(user = Depends(get_current_user)):
    """Check Gmail authentication status"""
    try:
        user_id = user["user_id"]
        
        # Try to authenticate (this will check if tokens exist and are valid)
        is_authenticated = await gmail_service.authenticate(user_id)
        
        return {
            "authenticated": is_authenticated,
            "user_id": user_id,
            "message": "Gmail authentication successful" if is_authenticated else "Gmail authentication required"
        }
        
    except Exception as e:
        logger.error(f"Error checking auth status: {e}")
        return {
            "authenticated": False,
            "user_id": user.get("user_id", "unknown"),
            "message": f"Authentication error: {str(e)}"
        }

@router.post("/sign-out")
async def sign_out_gmail(user = Depends(get_current_user)):
    """Sign out from Gmail and clear stored tokens"""
    try:
        user_id = user["user_id"]
        token_path = f"tokens/token_{user_id}.json"
        
        # Remove the token file if it exists
        if os.path.exists(token_path):
            os.remove(token_path)
            logger.info(f"Gmail token removed for user {user_id}")
        
        # Reset the Gmail service credentials
        gmail_service.credentials = None
        gmail_service.service = None
        
        return {
            "status": "success",
            "message": "Successfully signed out from Gmail"
        }
        
    except Exception as e:
        logger.error(f"Error signing out from Gmail: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to sign out: {str(e)}")

@router.get("/message/{message_id}", response_model=EmailMessage)
async def get_message(message_id: str, user = Depends(get_current_user)):
    """Fetch full content for one message"""
    user_id = user["user_id"]
    return await gmail_service.get_message(user_id, message_id) 