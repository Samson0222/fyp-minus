import os
import logging
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.core.database import SupabaseManager

logger = logging.getLogger(__name__)

class TelegramService:
    """Service for managing Telegram Bot API interactions and database operations"""
    
    def __init__(self, db: SupabaseManager):
        self.db = db
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        
        if not self.bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN not found in environment variables")
    
    async def send_message(self, chat_id: int, text: str) -> bool:
        """Send a message to a Telegram chat"""
        if not self.bot_token:
            logger.error("Cannot send message: Telegram bot token not configured")
            return False
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sendMessage",
                    json={
                        "chat_id": chat_id,
                        "text": text,
                        "parse_mode": "HTML"  # Allow basic HTML formatting
                    }
                )
                
                if response.status_code == 200:
                    logger.info(f"Message sent successfully to chat {chat_id}")
                    return True
                else:
                    logger.error(f"Failed to send message to chat {chat_id}: {response.text}")
                    return False
                    
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return False
    
    async def get_user_chats(self, user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get recent chats for the user (placeholder - Telegram doesn't provide this directly)"""
        # Note: Telegram Bot API doesn't provide a direct way to get user's chats
        # In a real implementation, you would need to:
        # 1. Store chat info when the bot receives messages
        # 2. Use getUpdates to get recent interactions
        # 3. Or implement a different approach
        
        # For now, return monitored chats from our database
        try:
            if not self.db.client:
                return []
            
            result = self.db.client.from_("monitored_chats").select(
                "chat_id, chat_name, chat_type, created_at"
            ).eq("user_id", user_id).eq("is_active", True).limit(limit).execute()
            
            if result.data:
                return [{
                    "chat_id": chat["chat_id"],
                    "chat_name": chat["chat_name"],
                    "chat_type": chat["chat_type"],
                    "created_at": chat["created_at"]
                } for chat in result.data]
            
            return []
            
        except Exception as e:
            logger.error(f"Error getting user chats: {e}")
            return []
    
    async def save_monitored_chat(self, user_id: str, chat_id: int, chat_name: str, chat_type: str = "private") -> bool:
        """Save a chat that the user wants to monitor"""
        try:
            if not self.db.client:
                return False
            
            data = {
                "user_id": user_id,
                "chat_id": chat_id,
                "chat_name": chat_name,
                "chat_type": chat_type,
                "is_active": True
            }
            
            # Upsert to handle duplicates
            result = self.db.client.from_("monitored_chats").upsert(data).execute()
            
            if result.data:
                logger.info(f"Monitored chat saved: {chat_name} (ID: {chat_id}) for user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error saving monitored chat: {e}")
            return False
    
    async def remove_monitored_chat(self, user_id: str, chat_id: int) -> bool:
        """Remove a chat from monitoring"""
        try:
            if not self.db.client:
                return False
            
            result = self.db.client.from_("monitored_chats").update(
                {"is_active": False}
            ).eq("user_id", user_id).eq("chat_id", chat_id).execute()
            
            if result.data:
                logger.info(f"Removed chat {chat_id} from monitoring for user {user_id}")
                return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error removing monitored chat: {e}")
            return False
    
    async def is_chat_monitored(self, user_id: str, chat_id: int) -> bool:
        """Check if a chat is being monitored by the user"""
        try:
            if not self.db.client:
                return False
            
            result = self.db.client.from_("monitored_chats").select("id").eq(
                "user_id", user_id
            ).eq("chat_id", chat_id).eq("is_active", True).execute()
            
            return len(result.data) > 0
            
        except Exception as e:
            logger.error(f"Error checking if chat is monitored: {e}")
            return False
    
    async def save_telegram_message(
        self, 
        user_id: str,
        chat_id: int, 
        message_id: int,
        sender_name: str,
        sender_id: int,
        content: str,
        message_type: str = "text",
        timestamp: datetime = None
    ) -> Optional[str]:
        """Save a Telegram message to the database"""
        try:
            if not self.db.client:
                return None
            
            # First, get the monitored_chat_id
            monitored_chat = self.db.client.from_("monitored_chats").select("id").eq(
                "user_id", user_id
            ).eq("chat_id", chat_id).eq("is_active", True).execute()
            
            if not monitored_chat.data:
                logger.warning(f"Message received for unmonitored chat {chat_id}")
                return None
            
            monitored_chat_id = monitored_chat.data[0]["id"]
            
            data = {
                "monitored_chat_id": monitored_chat_id,
                "message_id": message_id,
                "sender_name": sender_name,
                "telegram_sender_id": sender_id,
                "content": content,
                "message_type": message_type,
                "timestamp": timestamp or datetime.utcnow(),
                "is_read": False
            }
            
            result = self.db.client.from_("telegram_messages").upsert(data).execute()
            
            if result.data:
                msg_id = result.data[0]["id"]
                logger.info(f"Telegram message saved: {msg_id}")
                return msg_id
            
            return None
            
        except Exception as e:
            logger.error(f"Error saving Telegram message: {e}")
            return None
    
    async def get_unread_summary(self, user_id: str) -> List[Dict[str, Any]]:
        """Get summary of unread messages by chat"""
        try:
            if not self.db.client:
                return []
            
            # Get unread message counts and latest message per chat
            result = self.db.client.rpc("get_telegram_unread_summary", {"p_user_id": user_id}).execute()
            
            if result.data:
                return result.data
            
            # Fallback: manual query if RPC doesn't exist
            return await self._get_unread_summary_fallback(user_id)
            
        except Exception as e:
            logger.error(f"Error getting unread summary: {e}")
            # Fallback to manual query
            return await self._get_unread_summary_fallback(user_id)
    
    async def _get_unread_summary_fallback(self, user_id: str) -> List[Dict[str, Any]]:
        """Fallback method to get unread summary using basic queries"""
        try:
            # Get all monitored chats for the user
            monitored_chats = self.db.client.from_("monitored_chats").select(
                "id, chat_id, chat_name, chat_type"
            ).eq("user_id", user_id).eq("is_active", True).execute()
            
            if not monitored_chats.data:
                return []
            
            summary = []
            for chat in monitored_chats.data:
                # Get unread count and latest message for each chat
                unread_count = self.db.client.from_("telegram_messages").select(
                    "id", count="exact"
                ).eq("monitored_chat_id", chat["id"]).eq("is_read", False).execute()
                
                if unread_count.count > 0:
                    latest_message = self.db.client.from_("telegram_messages").select(
                        "content, sender_name, timestamp"
                    ).eq("monitored_chat_id", chat["id"]).order(
                        "timestamp", desc=True
                    ).limit(1).execute()
                    
                    latest = latest_message.data[0] if latest_message.data else None
                    
                    summary.append({
                        "chat_id": chat["chat_id"],
                        "chat_name": chat["chat_name"],
                        "chat_type": chat["chat_type"],
                        "unread_count": unread_count.count,
                        "latest_message": latest["content"] if latest else "",
                        "latest_sender": latest["sender_name"] if latest else "",
                        "latest_timestamp": latest["timestamp"] if latest else None
                    })
            
            return summary
            
        except Exception as e:
            logger.error(f"Error in fallback unread summary: {e}")
            return []
    
    async def get_conversation_history(self, user_id: str, chat_id: int, limit: int = 50) -> List[Dict[str, Any]]:
        """Get message history for a specific chat"""
        try:
            if not self.db.client:
                return []
            
            # First verify the user can access this chat
            if not await self.is_chat_monitored(user_id, chat_id):
                return []
            
            # Get the monitored chat ID
            monitored_chat = self.db.client.from_("monitored_chats").select("id").eq(
                "user_id", user_id
            ).eq("chat_id", chat_id).eq("is_active", True).execute()
            
            if not monitored_chat.data:
                return []
            
            monitored_chat_id = monitored_chat.data[0]["id"]
            
            # Get messages for this chat
            result = self.db.client.from_("telegram_messages").select(
                "id, message_id, sender_name, telegram_sender_id, content, message_type, timestamp, is_read"
            ).eq("monitored_chat_id", monitored_chat_id).order(
                "timestamp", desc=False
            ).limit(limit).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error getting conversation history: {e}")
            return []
    
    async def mark_messages_as_read(self, user_id: str, chat_id: int) -> bool:
        """Mark all messages in a chat as read"""
        try:
            if not self.db.client:
                return False
            
            # Get the monitored chat ID
            monitored_chat = self.db.client.from_("monitored_chats").select("id").eq(
                "user_id", user_id
            ).eq("chat_id", chat_id).eq("is_active", True).execute()
            
            if not monitored_chat.data:
                return False
            
            monitored_chat_id = monitored_chat.data[0]["id"]
            
            # Update all unread messages to read
            result = self.db.client.from_("telegram_messages").update(
                {"is_read": True}
            ).eq("monitored_chat_id", monitored_chat_id).eq("is_read", False).execute()
            
            logger.info(f"Marked messages as read for chat {chat_id}")
            return True
            
        except Exception as e:
            logger.error(f"Error marking messages as read: {e}")
            return False 