from fastapi import APIRouter, HTTPException, Depends, Request, status
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_database, SupabaseManager
from app.services.telegram_service import TelegramService
from app.websockets import ConnectionManager
from app.dependencies import get_current_user
from app.models.user import User
from app.models.user_context import UserContext

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/telegram", tags=["telegram"])
manager = ConnectionManager()

# Pydantic models
class ChatSelection(BaseModel):
    chat_id: int
    is_active: bool

class MonitoredChatsUpdateRequest(BaseModel):
    chats: List[ChatSelection]

class SendMessageRequest(BaseModel):
    chat_id: int
    message: str

class ReplyRequest(BaseModel):
    content: str

class TelegramUpdate(BaseModel):
    """Simplified Telegram update model for webhook"""
    update_id: int
    message: Optional[Dict[str, Any]] = None

class TelegramSendMessage(BaseModel):
    chat_id: int
    message: str

# Dependency to get current user (using the same pattern as other routers)
# async def get_current_user():
#     """Stub user extraction - replace with real auth if needed."""
#     # This UUID must match a real user in the Supabase `auth.users` table.
#     return {"user_id": "cbede3b0-2f68-47df-9c26-09a46e588567", "email": "test@example.com"}

def get_telegram_service(db: SupabaseManager = Depends(get_database)) -> TelegramService:
    """Dependency to get Telegram service instance"""
    return TelegramService(db)

@router.get("/selectable_chats")
async def get_selectable_chats(
    user: UserContext = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Get the user's recent/available chats for monitoring selection.
    This returns all discovered chats (both active and inactive).
    """
    try:
        chats = await telegram_service.get_selectable_chats(user.user_id)
        
        return {
            "success": True,
            "chats": chats,
            "message": "Available chats retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error getting selectable chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chats")

@router.put("/monitored_chats")
async def update_monitored_chats(
    request: MonitoredChatsUpdateRequest,
    user: UserContext = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Update the monitoring status for multiple chats at once.
    The frontend should send the full list of selectable chats with their
    desired `is_active` status.
    """
    try:
        chat_selections = [chat.dict() for chat in request.chats]
        
        success = await telegram_service.update_monitored_chats(user.user_id, chat_selections)
        
        if success:
            return {
                "success": True,
                "message": "Chat monitoring status updated successfully."
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to update chat monitoring status.")
        
    except Exception as e:
        logger.error(f"Error updating monitored chats: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


@router.get("/summary", status_code=status.HTTP_200_OK)
async def get_telegram_summary(
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Gets a summary of unread and recent chats."""
    telegram_service = TelegramService(db)
    summary = await telegram_service.get_telegram_summary(user.user_id)
    return {"success": True, "summary": summary}

@router.get("/active_chats", status_code=status.HTTP_200_OK)
async def get_active_chats(
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Gets all active chats for the search/composer feature."""
    telegram_service = TelegramService(db)
    chats = await telegram_service.get_active_chats_for_search(user.user_id)
    return {"success": True, "chats": chats}

@router.get("/conversation/{chat_id}", status_code=status.HTTP_200_OK)
async def get_conversation(
    chat_id: int,
    limit: int = 50,
    user: UserContext = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Get message history for a specific chat.
    """
    try:
        messages = await telegram_service.get_conversation_history(user.user_id, chat_id, limit)
        
        # Mark messages as read when conversation is viewed
        # await telegram_service.mark_chat_as_read(user_id, chat_id) # Removed for new logic
        
        return {
            "success": True,
            "chat_id": chat_id,
            "messages": messages,
            "count": len(messages)
        }
        
    except Exception as e:
        logger.error(f"Error getting conversation for chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation")

@router.post("/conversation/{chat_id}/reply", status_code=status.HTTP_200_OK)
async def reply_to_chat(
    chat_id: int,
    request: ReplyRequest,
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Sends a reply to a specific chat."""
    telegram_service = TelegramService(db)
    sent_message_data = await telegram_service.send_message(
        chat_id=chat_id,
        text=request.content,
        user_id=user.user_id
    )
    if sent_message_data:
        return {"success": True, "message": sent_message_data}
    else:
        raise HTTPException(status_code=500, detail="Failed to send message")

@router.post("/send", status_code=status.HTTP_200_OK)
async def send_telegram_message(
    payload: TelegramSendMessage,
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Endpoint to send a message to a Telegram chat."""
    telegram_service = TelegramService(db)
    sent_message_data = await telegram_service.send_message(payload.chat_id, payload.message, user.user_id)
    if sent_message_data:
        return {"success": True, "message": "Message sent successfully.", "data": sent_message_data}
    else:
        raise HTTPException(status_code=500, detail="Failed to send message")

@router.post("/conversation/{chat_id}/mark_unread", status_code=status.HTTP_200_OK)
async def mark_chat_as_unread(
    chat_id: int,
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Marks all messages in a chat as UNREAD."""
    telegram_service = TelegramService(db)
    success = await telegram_service.mark_chat_as_unread(user.user_id, chat_id)
    if success:
        return {"success": True, "message": "Chat marked as unread."}
    else:
        raise HTTPException(status_code=500, detail="Failed to mark chat as unread")

@router.post("/conversation/{chat_id}/mark_read", status_code=status.HTTP_200_OK)
async def mark_chat_as_read(
    chat_id: int,
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Marks all messages in a chat as read."""
    telegram_service = TelegramService(db)
    success = await telegram_service.mark_chat_as_read(user.user_id, chat_id)
    if success:
        return {"success": True, "message": "Chat marked as read."}
    else:
        raise HTTPException(status_code=500, detail="Failed to mark chat as read")

@router.post("/conversation/{chat_id}/clear_history", status_code=status.HTTP_200_OK)
async def clear_chat_history_endpoint(
    chat_id: int,
    user: UserContext = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Deletes all messages for a specific chat."""
    telegram_service = TelegramService(db)
    success = await telegram_service.clear_chat_history(user.user_id, chat_id)
    if success:
        return {"success": True, "message": "Chat history cleared."}
    else:
        raise HTTPException(status_code=500, detail="Failed to clear chat history.")

@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    user: UserContext = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Webhook endpoint to receive updates from Telegram.
    This endpoint now delegates all logic to the TelegramService.
    """
    try:
        update_data = await request.json()
        logger.info(f"Received Telegram update: {update_data}")
        
        # The user_id is hardcoded for now, as the webhook is unauthenticated.
        # This is a key area for improvement in a real production system.
        user_id = user.user_id 
        
        await telegram_service.handle_webhook_update(update_data, user_id)
        
        return {"status": "ok", "message": "Update processed"}

    except Exception as e:
        # Log the exception but return a 200 to Telegram to prevent retries
        logger.error(f"Error processing Telegram webhook: {e}", exc_info=True)
        return {"status": "error", "message": "An internal error occurred"}

@router.post("/webhook/test")
async def telegram_webhook_test(
    request: TelegramUpdate, # Use pydantic model for testing
    user: UserContext = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Test endpoint for webhook updates.
    """
    try:
        update_data = request.dict()
        logger.info(f"Received Telegram update for test: {update_data}")
        
        # The user_id is hardcoded for now, as the webhook is unauthenticated.
        # This is a key area for improvement in a real production system.
        user_id = user.user_id 
        
        await telegram_service.handle_webhook_update(update_data, user_id)
        
        return {"status": "ok", "message": "Update processed for test"}
    except Exception as e:
        logger.error(f"Error processing Telegram webhook test: {e}")
        return {"status": "error", "message": "Failed to process test update"}

@router.get("/status")
async def get_telegram_status(
    user: UserContext = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Check Telegram integration status for the user.
    """
    try:
        user_id = user.user_id
        
        # Check if bot token is configured
        has_token = bool(telegram_service.bot_token)
        print(f"has_token: {has_token}")
        
        # Get number of monitored chats
        monitored_chats = await telegram_service.get_user_chats(user_id)
        
        return {
            "success": True,
            "bot_configured": has_token,
            "monitored_chats_count": len(monitored_chats),
            "monitored_chats": monitored_chats
        }
        
    except Exception as e:
        logger.error(f"Error getting Telegram status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get status") 