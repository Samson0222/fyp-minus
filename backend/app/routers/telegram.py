from fastapi import APIRouter, HTTPException, Depends, Request
from typing import List, Dict, Any, Optional
import logging
from datetime import datetime
from pydantic import BaseModel

from app.core.database import get_database, SupabaseManager
from app.services.telegram_service import TelegramService
from app.websockets import manager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/telegram", tags=["telegram"])

# Pydantic models
class MonitoredChatRequest(BaseModel):
    chat_ids: List[int]

class SendMessageRequest(BaseModel):
    chat_id: int
    message: str

class TelegramUpdate(BaseModel):
    """Simplified Telegram update model for webhook"""
    update_id: int
    message: Optional[Dict[str, Any]] = None

# Dependency to get current user (using the same pattern as other routers)
async def get_current_user():
    """Stub user extraction - replace with real auth if needed."""
    return {"user_id": "test_user_001", "email": "test@example.com"}

def get_telegram_service(db: SupabaseManager = Depends(get_database)) -> TelegramService:
    """Dependency to get Telegram service instance"""
    return TelegramService(db)

@router.get("/selectable_chats")
async def get_selectable_chats(
    user = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Get the user's recent/available chats for monitoring selection.
    
    Note: Telegram Bot API doesn't provide a direct way to list user chats.
    This endpoint returns chats that are already being monitored or have been
    interacted with through the bot.
    """
    try:
        user_id = user["user_id"]
        chats = await telegram_service.get_user_chats(user_id)
        
        return {
            "success": True,
            "chats": chats,
            "message": "Available chats retrieved successfully"
        }
        
    except Exception as e:
        logger.error(f"Error getting selectable chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve chats")

@router.post("/monitored_chats")
async def set_monitored_chats(
    request: MonitoredChatRequest,
    user = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Set which chats the user wants to monitor.
    This endpoint receives a list of chat IDs and saves them to the database.
    """
    try:
        user_id = user["user_id"]
        
        # For this implementation, we'll need to handle the limitation that
        # we can't get chat names without prior interaction
        # In a real scenario, this would be populated when messages are received
        
        success_count = 0
        for chat_id in request.chat_ids:
            # For now, use placeholder names - these will be updated when messages arrive
            chat_name = f"Chat {chat_id}"
            success = await telegram_service.save_monitored_chat(
                user_id, chat_id, chat_name, "private"
            )
            if success:
                success_count += 1
        
        return {
            "success": True,
            "monitored_count": success_count,
            "total_requested": len(request.chat_ids),
            "message": f"Successfully set up monitoring for {success_count} chats"
        }
        
    except Exception as e:
        logger.error(f"Error setting monitored chats: {e}")
        raise HTTPException(status_code=500, detail="Failed to set up chat monitoring")

@router.get("/unread_summary")
async def get_unread_summary(
    user = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Get a summary of unread messages grouped by chat.
    Returns data for the Telegram Focus Mode UI.
    """
    try:
        user_id = user["user_id"]
        summary = await telegram_service.get_unread_summary(user_id)
        
        return {
            "success": True,
            "unread_chats": summary,
            "total_unread_chats": len(summary),
            "total_unread_messages": sum(chat.get("unread_count", 0) for chat in summary)
        }
        
    except Exception as e:
        logger.error(f"Error getting unread summary: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve unread messages")

@router.get("/conversation/{chat_id}")
async def get_conversation(
    chat_id: int,
    limit: int = 50,
    user = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Get message history for a specific chat.
    """
    try:
        user_id = user["user_id"]
        messages = await telegram_service.get_conversation_history(user_id, chat_id, limit)
        
        # Mark messages as read when conversation is viewed
        await telegram_service.mark_messages_as_read(user_id, chat_id)
        
        return {
            "success": True,
            "chat_id": chat_id,
            "messages": messages,
            "count": len(messages)
        }
        
    except Exception as e:
        logger.error(f"Error getting conversation for chat {chat_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to retrieve conversation")

@router.post("/send")
async def send_message(
    request: SendMessageRequest,
    user = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Send a message to a Telegram chat.
    """
    try:
        user_id = user["user_id"]
        
        # Verify the user is allowed to send to this chat
        if not await telegram_service.is_chat_monitored(user_id, request.chat_id):
            raise HTTPException(
                status_code=403, 
                detail="You can only send messages to monitored chats"
            )
        
        success = await telegram_service.send_message(request.chat_id, request.message)
        
        if success:
            return {
                "success": True,
                "message": "Message sent successfully",
                "chat_id": request.chat_id
            }
        else:
            raise HTTPException(status_code=500, detail="Failed to send message")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error sending message: {e}")
        raise HTTPException(status_code=500, detail="Failed to send message")

@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Webhook endpoint to receive updates from Telegram.
    This endpoint should be registered with Telegram using setWebhook.
    """
    try:
        # Parse the incoming update
        update_data = await request.json()
        logger.info(f"Received Telegram update: {update_data}")
        
        # Extract message data
        message = update_data.get("message")
        if not message:
            # Not a message update, ignore for now
            return {"status": "ok", "message": "Update processed"}
        
        chat = message.get("chat", {})
        chat_id = chat.get("id")
        sender = message.get("from", {})
        
        if not chat_id:
            logger.warning("Received message without chat ID")
            return {"status": "ok", "message": "No chat ID found"}
        
        # Extract message details
        message_id = message.get("message_id")
        sender_id = sender.get("id")
        sender_name = sender.get("first_name", "Unknown")
        if sender.get("last_name"):
            sender_name += f" {sender['last_name']}"
        
        content = message.get("text", "")
        message_type = "text"
        
        # Handle different message types
        if message.get("photo"):
            content = message.get("caption", "[Photo]")
            message_type = "photo"
        elif message.get("document"):
            content = message.get("caption", "[Document]")
            message_type = "document"
        elif message.get("voice"):
            content = "[Voice message]"
            message_type = "voice"
        elif message.get("video"):
            content = message.get("caption", "[Video]")
            message_type = "video"
        elif message.get("sticker"):
            content = "[Sticker]"
            message_type = "sticker"
        elif not content:
            content = "[Unsupported message type]"
            message_type = "other"
        
        timestamp = datetime.fromtimestamp(message.get("date", 0))
        
        # Check if any user is monitoring this chat
        # Note: This is a simplified approach - in production you might want
        # to optimize this by maintaining a mapping of chat_id to user_id
        db = telegram_service.db
        if not db.client:
            return {"status": "error", "message": "Database not available"}
        
        # Find users monitoring this chat
        monitored_chats = db.client.from_("monitored_chats").select(
            "user_id, chat_name"
        ).eq("chat_id", chat_id).eq("is_active", True).execute()
        
        if not monitored_chats.data:
            # No users monitoring this chat, ignore the message
            logger.info(f"Message received for unmonitored chat {chat_id}")
            return {"status": "ok", "message": "Chat not monitored"}
        
        # Update chat name if we have better information
        chat_name = chat.get("title") or chat.get("first_name", f"Chat {chat_id}")
        
        # Save message for each monitoring user
        for monitored_chat in monitored_chats.data:
            user_id = monitored_chat["user_id"]
            
            # Update chat name if it's different
            current_name = monitored_chat["chat_name"]
            if current_name.startswith("Chat ") and chat_name != current_name:
                await telegram_service.save_monitored_chat(
                    user_id, chat_id, chat_name, chat.get("type", "private")
                )
            
            # Save the message
            message_db_id = await telegram_service.save_telegram_message(
                user_id, chat_id, message_id, sender_name, 
                sender_id, content, message_type, timestamp
            )
            
            if message_db_id:
                # Send real-time notification to the user
                try:
                    await manager.send_json({
                        "event": "new_telegram_message",
                        "chat_id": chat_id,
                        "chat_name": chat_name,
                        "sender_name": sender_name,
                        "content": content[:100] + "..." if len(content) > 100 else content,
                        "message_type": message_type,
                        "timestamp": timestamp.isoformat()
                    }, user_id)
                except Exception as ws_error:
                    logger.error(f"Failed to send WebSocket notification: {ws_error}")
        
        return {"status": "ok", "message": "Message processed successfully"}
        
    except Exception as e:
        logger.error(f"Error processing Telegram webhook: {e}")
        return {"status": "error", "message": "Failed to process update"}

@router.get("/status")
async def get_telegram_status(
    user = Depends(get_current_user),
    telegram_service: TelegramService = Depends(get_telegram_service)
):
    """
    Check Telegram integration status for the user.
    """
    try:
        user_id = user["user_id"]
        
        # Check if bot token is configured
        has_token = bool(telegram_service.bot_token)
        
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