import os
import logging
import httpx
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

from app.core.database import SupabaseManager
from app.websockets import ConnectionManager
# Added APIError import to handle specific PostgREST exceptions if needed
from postgrest.exceptions import APIError

logger = logging.getLogger(__name__)
websocket_manager = ConnectionManager()

class TelegramService:
    """Service for managing Telegram Bot API interactions and database operations"""
    
    def __init__(self, db: SupabaseManager):
        self.db = db
        self.bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
        self.base_url = f"https://api.telegram.org/bot{self.bot_token}"
        
        if not self.bot_token:
            logger.warning("TELEGRAM_BOT_TOKEN not found in environment variables")
    
    async def handle_webhook_update(self, update_data: Dict[str, Any], user_id: str):
        """
        Handles incoming webhook updates from Telegram.
        This is the core logic for the "discover-then-activate" flow.
        """
        message = update_data.get("message")
        if not message:
            logger.info("Received a non-message update, skipping.")
            return

        chat_info = message.get("chat", {})
        chat_id = chat_info.get("id")
        if not chat_id:
            logger.warning("Received update without a chat ID, skipping.")
            return

        # 1. Discover or find the chat and get its status
        monitored_chat = await self._discover_or_get_chat(user_id, chat_info)

        # If we couldn't create or find a chat record, we can't proceed.
        if not monitored_chat:
            logger.error(f"Could not find or create a record for chat {chat_id}. Aborting message save.")
            return

        # 2. Check for consent before saving the message
        if not monitored_chat.get("is_active"):
            logger.info(f"Chat {chat_id} is not actively monitored. Message will not be saved.")
            # We still might want to notify the frontend that a new chat is available.
            # This can be a future enhancement.
            return
            
        # 3. Save the message since consent is given (is_active = true)
        saved_message_id = await self._save_message_from_webhook(monitored_chat["id"], message)

        # 4. Notify frontend via WebSocket
        if saved_message_id:
            logger.info(f"Notifying frontend about new message in chat {chat_id}")
            # The frontend is listening for updates on the user's ID
            await websocket_manager.send_json(
                {"event": "telegram_new_message", "chat_id": chat_id},
                user_id
            )

    async def _discover_or_get_chat(self, user_id: str, chat_info: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Finds a chat in the database for a user. If not found, creates a new,
        inactive record for it ("discovers" it).
        """
        chat_id = chat_info.get("id")
        
        try:
            # First attempt – rely on upsert to create or update the record.
            # (We removed the preliminary SELECT that triggered 204 errors.)
            
            chat_name = chat_info.get("title") or (f"{chat_info.get('first_name', '')} {chat_info.get('last_name', '')}".strip()) or f"Chat {chat_id}"

            # 1. Upsert the chat details. This creates the record if it doesn't exist
            # or updates the name if it does. DB defaults will handle is_active etc. on create.
            self.db.client.from_("monitored_chats").upsert({
                "user_id": user_id,
                "chat_id": chat_id,
                "chat_name": chat_name,
                "chat_type": chat_info.get("type", "unknown"),
            }, on_conflict="user_id, chat_id").execute()

            # 2. Now that we're sure the record exists, fetch it to get its ID and status.
            fetch_result = self.db.client.from_("monitored_chats").select(
                "id, is_active"
            ).eq("user_id", user_id).eq("chat_id", chat_id).single().execute()

            if fetch_result.data:
                logger.info(f"Successfully discovered and fetched record for chat {chat_id}")
                return fetch_result.data
            else:
                # This should be almost impossible if the upsert succeeded.
                logger.error(f"Failed to fetch chat {chat_id} immediately after upsert. Error: {fetch_result.error}")
                return None

        except Exception as e:
            logger.error(f"Database error while discovering chat {chat_id}: {e}", exc_info=True)
            return None

    async def _save_message_from_webhook(self, monitored_chat_id: str, message: Dict[str, Any]) -> Optional[str]:
        """Saves a message's content to the database, linked to a monitored chat."""
        sender = message.get("from", {})
        sender_name = sender.get("first_name", "Unknown")
        if sender.get("last_name"):
            sender_name += f" {sender['last_name']}"

        content = message.get("text", "")
        message_type = "text"
        
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
            emoji = message["sticker"].get("emoji", "")
            content = f"[{emoji} Sticker]"
            message_type = "sticker"
        elif not content:
            content = "[Unsupported message type]"
            message_type = "other"

        message_data = {
            "monitored_chat_id": monitored_chat_id,
            "message_id": message.get("message_id"),
            "sender_name": sender_name,
            "telegram_sender_id": sender.get("id"),
            "content": content,
            "message_type": message_type,
            "timestamp": datetime.fromtimestamp(message.get("date"), tz=timezone.utc).isoformat(),
            "is_read": False,
        }
        
        try:
            result = self.db.client.from_("telegram_messages").insert(message_data).execute()
            if result.data:
                saved_id = result.data[0]["id"]
                logger.info(f"Saved message {saved_id} to database.")
                return saved_id
            logger.warning(f"Failed to save message, no data returned. Details: {result}")
            return None
        except Exception as e:
            logger.error(f"Error saving message from webhook: {e}")
            return None
    
    async def send_message(self, chat_id: int, text: str, user_id: str) -> Optional[Dict[str, Any]]:
        """
        Send a message to a Telegram chat and return the message data
        for optimistic UI updates.
        """
        if not self.bot_token:
            logger.error("Cannot send message: Telegram bot token not configured")
            return None
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/sendMessage",
                    json={ "chat_id": chat_id, "text": text, "parse_mode": "HTML" }
                )
                
                response_data = response.json()
                if response.status_code == 200 and response_data.get("ok"):
                    logger.info(f"Message sent successfully to chat {chat_id}")
                    sent_message = response_data["result"]
                    
                    # Save the outgoing message to our DB
                    await self._save_outgoing_message(user_id, sent_message)

                    # Return a formatted message for the frontend
                    return {
                        "id": f"temp-{datetime.now().timestamp()}", # Temporary ID
                        "message_id": sent_message.get("message_id"),
                        "sender_name": "You", # Sent by the user from our app
                        "telegram_sender_id": sent_message.get("from", {}).get("id"),
                        "content": sent_message.get("text"),
                        "message_type": "text",
                        "timestamp": datetime.fromtimestamp(sent_message.get("date"), tz=timezone.utc).isoformat(),
                        "is_read": True, # Always considered read
                    }
                else:
                    logger.error(f"Failed to send message to chat {chat_id}: {response.text}")
                    return None
                    
        except Exception as e:
            logger.error(f"Error sending Telegram message: {e}")
            return None

    async def _save_outgoing_message(self, user_id: str, message: Dict[str, Any]):
        """Saves an outgoing message (sent from our app) to the database."""
        try:
            # 1. Find the monitored_chat_id for this chat
            chat_id = message.get("chat", {}).get("id")
            chat_record = self.db.client.from_("monitored_chats").select("id").eq("user_id", user_id).eq("chat_id", chat_id).single().execute()

            if not chat_record.data:
                logger.warning(f"Could not find monitored chat record for outgoing message to chat {chat_id}. Not saving.")
                return

            monitored_chat_id = chat_record.data["id"]

            # 2. Prepare and save the message
            message_data = {
                "monitored_chat_id": monitored_chat_id,
                "message_id": message.get("message_id"),
                "sender_name": "You",
                "telegram_sender_id": message.get("from", {}).get("id"),
                "content": message.get("text"),
                "message_type": "text",
                "timestamp": datetime.fromtimestamp(message.get("date"), tz=timezone.utc).isoformat(),
                "is_read": True, # Messages sent by us are always "read"
            }
            self.db.client.from_("telegram_messages").insert(message_data).execute()
            logger.info(f"Saved outgoing message to chat {chat_id} in DB.")

        except Exception as e:
            logger.error(f"Error saving outgoing message to DB: {e}", exc_info=True)


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
    
    async def get_selectable_chats(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Gets all discovered chats for a user so they can choose which ones to monitor.
        This now returns both active and inactive chats.
        """
        try:
            if not self.db.client: return []
            
            result = self.db.client.from_("monitored_chats").select(
                "chat_id, chat_name, chat_type, is_active"
            ).eq("user_id", user_id).order("created_at", desc=True).execute()

            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Error getting selectable chats: {e}")
            return []

    async def get_active_chats_for_search(self, user_id: str) -> List[Dict[str, Any]]:
        """
        Gets all ACTIVE chats for a user, optimized for the search/composer feature.
        """
        try:
            if not self.db.client: return []
            
            result = self.db.client.from_("monitored_chats").select(
                "chat_id, chat_name, chat_type"
            ).eq("user_id", user_id).eq("is_active", True).order("chat_name", desc=False).execute()

            return result.data if result.data else []
        except Exception as e:
            logger.error(f"Error getting active chats for search: {e}")
            return []

    async def update_monitored_chats(self, user_id: str, chat_selections: List[Dict[str, Any]]) -> bool:
        """
        Updates the monitoring status (is_active) for a list of chats.
        """
        try:
            if not self.db.client: return False
            
            success = True
            for selection in chat_selections:
                result = self.db.client.from_("monitored_chats").update({
                    "is_active": selection["is_active"],
                    "user_consent": selection["is_active"]
                }).eq("user_id", user_id).eq("chat_id", selection["chat_id"]).execute()
                
                # The result for an update operation might not contain data, 
                # but an error attribute will be present on failure.
                if hasattr(result, 'error') and result.error:
                    logger.error(f"Error updating chat {selection['chat_id']}: {result.error}")
                    success = False

            return success
        except Exception as e:
            logger.error(f"Exception during chat status update: {e}")
            return False

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
            
            # This method is now primarily for *internal* use, e.g., saving a bot's own message.
            # The main webhook flow uses _save_message_from_webhook.
            monitored_chat = self.db.client.from_("monitored_chats").select("id").eq(
                "user_id", user_id
            ).eq("chat_id", chat_id).eq("is_active", True).single().execute()
            
            if not monitored_chat.data:
                logger.warning(f"Attempted to save message for unmonitored chat {chat_id}. If this was from a user, it's okay. If from the bot, it's a bug.")
                return None
            
            monitored_chat_id = monitored_chat.data["id"]
            
            data = {
                "monitored_chat_id": monitored_chat_id,
                "message_id": message_id,
                "sender_name": sender_name,
                "telegram_sender_id": sender_id,
                "content": content,
                "message_type": message_type,
                "timestamp": (timestamp or datetime.now(timezone.utc)).isoformat(),
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
    
    async def get_telegram_summary(self, user_id: str) -> Dict[str, List]:
        """
        Gets a structured summary of unread and recent chats using the new RPC function.
        """
        try:
            if not self.db.client: return {"unread": [], "recent": []}
            
            result = self.db.client.rpc("get_telegram_summary", {"p_user_id": user_id}).execute()
            
            if hasattr(result, 'data') and result.data:
                # The RPC function returns a single list. We need to categorize it.
                all_chats = result.data
                unread = [chat for chat in all_chats if (chat.get('unread_count') or 0) > 0]
                recent = [chat for chat in all_chats if (chat.get('unread_count') or 0) == 0]
                return {"unread": unread, "recent": recent}

            # Handle cases where the RPC call might fail silently or return no data
            if hasattr(result, 'error') and result.error:
                 logger.error(f"Database function error getting telegram summary: {result.error}")

            return {"unread": [], "recent": []}
        except APIError as e:
            logger.error(f"Database function error getting telegram summary: {e.message}")
            # If the function is missing, return empty lists to prevent frontend crash
            return {"unread": [], "recent": []}
        except Exception as e:
            logger.error(f"Error getting telegram summary: {e}")
            return {"unread": [], "recent": []}

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

    async def mark_chat_as_read(self, user_id: str, chat_id: int) -> bool:
        """
        Marks all messages in a specific chat for a user as read.
        """
        try:
            if not self.db.client: return False
            # Find the internal monitored_chat_id
            chat_record = self.db.client.from_("monitored_chats").select("id").eq("user_id", user_id).eq("chat_id", chat_id).single().execute()
            if not chat_record.data:
                logger.warning(f"Could not find chat {chat_id} for user {user_id} to mark as read.")
                return False

            monitored_chat_id = chat_record.data['id']
            # Update all messages in that chat
            self.db.client.from_("telegram_messages").update({"is_read": True}).eq("monitored_chat_id", monitored_chat_id).execute()
            logger.info(f"Marked all messages in chat {chat_id} as read for user {user_id}.")
            return True
        except Exception as e:
            logger.error(f"Error marking chat as read: {e}", exc_info=True)
            return False

    async def mark_chat_as_unread(self, user_id: str, chat_id: int) -> bool:
        """Marks all messages in a specific chat as unread for a user."""
        if not self.db.client:
            logger.error("Database client not available.")
            return False
            
        try:
            # First, find the internal ID of the monitored chat
            chat_record = self.db.client.from_("monitored_chats").select("id").eq("user_id", user_id).eq("chat_id", chat_id).single().execute()
            
            if not chat_record.data:
                logger.warning(f"Attempted to mark unread for a chat not monitored by user {user_id}: chat {chat_id}")
                return False

            monitored_chat_id = chat_record.data['id']
            
            # Now, update all messages linked to this chat ID
            # Note: RLS policies must allow this user to update these messages.
            update_result = self.db.client.from_("telegram_messages").update(
                {"is_read": False}
            ).eq("monitored_chat_id", monitored_chat_id).execute()
            
            # The API response for an update doesn't typically return an error on "0 rows updated",
            # so we just check for a direct exception.
            logger.info(f"Marked all messages in chat {chat_id} as unread for user {user_id}. Response: {update_result.data}")
            return True
            
        except Exception as e:
            logger.error(f"Error marking chat {chat_id} as unread for user {user_id}: {e}", exc_info=True)
            return False

    async def get_total_unread_count(self, user_id: str) -> int:
        """Gets the total count of unread messages across all monitored chats for a user."""
        try:
            if not self.db.client:
                return 0
            
            result = self.db.client.rpc("get_total_unread_count", {"p_user_id": user_id}).execute()
            
            if result.data and result.data[0]:
                return result.data[0]["count"]
            
            return 0
        except Exception as e:
            logger.error(f"Error getting total unread count: {e}")
            return 0

    async def clear_chat_history(self, user_id: str, chat_id: int) -> bool:
        """Deletes all messages for a specific chat, but keeps the chat monitored."""
        try:
            if not self.db.client: return False
            
            # Find the internal monitored_chat_id
            chat_record = self.db.client.from_("monitored_chats").select("id").eq("user_id", user_id).eq("chat_id", chat_id).single().execute()
            
            if not chat_record.data:
                logger.warning(f"Could not find chat {chat_id} for user {user_id} to clear history.")
                return False

            monitored_chat_id = chat_record.data['id']
            
            # Delete all messages for that chat
            delete_result = self.db.client.from_("telegram_messages").delete().eq("monitored_chat_id", monitored_chat_id).execute()
            
            if hasattr(delete_result, 'data') and delete_result.data is not None:
                logger.info(f"Cleared history for chat {chat_id} for user {user_id}. Messages deleted: {len(delete_result.data)}")
                return True
            else:
                logger.warning(f"No messages found to delete or error occurred for chat {chat_id}. Result: {delete_result}")
                # It's not a failure if there were no messages to delete.
                return True

        except Exception as e:
            logger.error(f"Error clearing history for chat {chat_id}: {e}", exc_info=True)
            return False 