import logging
from typing import List, Dict, Any
from langchain_core.tools import tool
from pydantic.v1 import BaseModel, Field

from app.services.telegram_service import TelegramService
from app.core.llm_factory import get_llm_service
from app.core.database import get_database

logger = logging.getLogger(__name__)

class FindChatInput(BaseModel):
    chat_query: str = Field(description="The user's description of the chat they are looking for. For example, 'my chat with John Doe' or 'the project update group'.")

@tool('find_telegram_chat', args_schema=FindChatInput, return_direct=False)
async def find_telegram_chat(chat_query: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Finds a specific Telegram chat based on a user's natural language query.
    It searches through the user's active, monitored chats and uses an AI resolver
    to determine the best match.
    """
    print("\n--- 🔍 TOOL: find_telegram_chat ---")
    print(f"   - Received query: '{chat_query}'")
    user_id = user_context.get("user_id")
    if not user_id:
        return {"error": "User context is missing, cannot perform search."}

    db = get_database()
    telegram_service = TelegramService(db)
    llm = get_llm_service()

    try:
        active_chats = await telegram_service.get_active_chats_for_search(user_id)
        if not active_chats:
            return {"error": "No active Telegram chats found to search through."}

        # Prepare the list of chats for the resolver AI
        chat_candidates = [
            f"Chat Name: '{chat['chat_name']}', Chat ID: {chat['chat_id']}, Type: {chat['chat_type']}"
            for chat in active_chats
        ]
        chat_list_str = "\n".join(chat_candidates)
        print(f"   - Sending {len(chat_candidates)} candidates to AI resolver.")

        prompt = f"""
        From the following list of available Telegram chats, identify the single best match for the user's query: '{chat_query}'.

        Available Chats:
        {chat_list_str}

        User's Query: "{chat_query}"

        Analyze the user's query and the chat names. The user might use nicknames, partial names, or describe the group's purpose. Your task is to return ONLY the integer `chat_id` of the most likely match.

        - If you find a clear match, return its integer chat_id.
        - If the query is ambiguous or there is no good match, return the integer 0.
        - Do not provide any explanation or surrounding text, only the number.

        Example: If the best match is 'Chat Name: "Project Discussion", Chat ID: 12345', you should return '12345'.
        """

        resolver_response = await llm.llm.ainvoke(prompt)
        
        try:
            # The response is an AIMessage, so we access its content.
            response_content = resolver_response.content
            print(f"   - AI Resolver RAW response: '{response_content}'")
            chat_id = int(response_content.strip())
            print(f"   - Parsed Chat ID: {chat_id}")
            if chat_id == 0:
                return {"error": f"Could not find a definitive chat matching your query: '{chat_query}'."}
            
            # Verify the resolved chat_id is valid
            matched_chat = next((chat for chat in active_chats if chat['chat_id'] == chat_id), None)
            
            if matched_chat:
                logger.info(f"Resolver AI successfully matched query '{chat_query}' to chat '{matched_chat['chat_name']}' (ID: {chat_id})")
                return {
                    "success": True,
                    "chat_id": matched_chat['chat_id'],
                    "chat_name": matched_chat['chat_name'],
                    "chat_type": matched_chat['chat_type']
                }
            else:
                logger.warning(f"Resolver AI returned an invalid chat_id '{chat_id}' that is not in the user's active chats.")
                return {"error": "AI resolver returned an invalid chat ID."}

        except (ValueError, TypeError) as e:
            logger.error(f"Could not parse chat_id from resolver AI's response. Response was: '{resolver_response.content}'. Error: {e}")
            return {"error": "The AI failed to identify a specific chat. Please try rephrasing your request to be more specific."}

    except Exception as e:
        logger.error(f"An unexpected error occurred in find_telegram_chat: {e}", exc_info=True)
        return {"error": "An unexpected error occurred while searching for the chat."}

class GetHistoryInput(BaseModel):
    chat_id: int = Field(description="The unique integer ID of the Telegram chat.")

@tool('get_conversation_history', args_schema=GetHistoryInput, return_direct=False)
async def get_conversation_history(chat_id: int, user_context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Fetches the recent message history for a specific Telegram chat ID.
    """
    print("\n--- 📜 TOOL: get_conversation_history ---")
    print(f"   - Received Chat ID: {chat_id}")
    user_id = user_context.get("user_id")
    if not user_id:
        return [{"error": "User context is missing."}]

    db = get_database()
    telegram_service = TelegramService(db)
    
    try:
        history = await telegram_service.get_conversation_history(user_id, chat_id, limit=25)
        print(f"   - Found {len(history)} messages in DB.")
        if not history:
            return [{"info": "No message history found for this chat."}]
        
        # Format the history for the AI
        formatted_history = [
            f"{msg['sender_name']} ({msg['timestamp']}): {msg['content']}"
            for msg in history
        ]
        print("   - Successfully formatted history for AI.")
        return formatted_history
    except Exception as e:
        logger.error(f"Error getting conversation history for chat {chat_id}: {e}", exc_info=True)
        return [{"error": "Failed to retrieve conversation history."}]

class SendMessageInput(BaseModel):
    chat_id: int = Field(description="The unique integer ID of the target Telegram chat.")
    message: str = Field(description="The content of the message to be sent.")

@tool('send_telegram_message', args_schema=SendMessageInput, return_direct=False)
async def send_telegram_message(chat_id: int, message: str, user_context: Dict[str, Any]) -> Dict[str, Any]:
    """
    Sends a message to a specific Telegram chat ID on behalf of the user.
    """
    print("\n--- 💬 TOOL: send_telegram_message ---")
    print(f"   - Received Chat ID: {chat_id}, Message: '{message}'")
    user_id = user_context.get("user_id")
    if not user_id:
        return {"error": "User context is missing."}

    db = get_database()
    telegram_service = TelegramService(db)

    try:
        result = await telegram_service.send_message(chat_id=chat_id, text=message, user_id=user_id)
        if result and result.get("message_id"):
            logger.info(f"Successfully sent message to chat {chat_id} via tool.")
            return {"success": True, "message": f"Message sent successfully to chat {chat_id}."}
        else:
            logger.error(f"Failed to send message to chat {chat_id} via tool. Result: {result}")
            return {"error": "The message could not be sent."}
    except Exception as e:
        logger.error(f"Error sending message via tool to chat {chat_id}: {e}", exc_info=True)
        return {"error": "An exception occurred while sending the message."}

@tool
async def get_unread_summary(user_context: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Fetches a summary of all unread messages across all monitored Telegram chats.
    It returns a list of dictionaries, where each dictionary contains the chat name
    and a list of its unread messages.
    """
    print("\n--- 📖 TOOL: get_unread_summary ---")
    user_id = user_context.get("user_id")
    if not user_id:
        return [{"error": "User context is missing."}]

    db = get_database()
    telegram_service = TelegramService(db)
    
    try:
        summary_data = await telegram_service.get_telegram_summary(user_id)
        unread_chats = summary_data.get("unread", [])

        if not unread_chats:
            return [{"info": "You have no unread messages in any chats."}]

        print(f"   - Found {len(unread_chats)} chats with unread messages.")
        
        all_unread_details = []
        for chat in unread_chats:
            chat_id = chat.get("chat_id")
            chat_name = chat.get("chat_name")
            history = await telegram_service.get_conversation_history(user_id, chat_id, limit=50)
            
            # Filter for only the unread messages in the history
            unread_messages = [msg for msg in history if not msg.get('is_read')]
            
            if unread_messages:
                all_unread_details.append({
                    "chat_name": chat_name,
                    "messages": [
                        f"{msg['sender_name']}: {msg['content']}" for msg in unread_messages
                    ]
                })

        print(f"   - Compiled unread messages from {len(all_unread_details)} chats.")
        return all_unread_details

    except Exception as e:
        logger.error(f"Error getting unread summary: {e}", exc_info=True)
        return [{"error": "Failed to retrieve unread message summary."}] 