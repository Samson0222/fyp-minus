import os
import logging
from typing import Dict, Any, List, Optional, Literal, Tuple
from datetime import datetime, timedelta
import pytz
import dateparser

# LangChain Imports
from langchain_core.prompts import ChatPromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, AIMessage, BaseMessage
from pydantic import BaseModel, Field

# Internal Imports
from app.tools.calendar_tools import get_calendar_events, create_calendar_event_draft, edit_calendar_event
from app.tools.gmail_tools import list_emails, get_email_details, create_draft_email, send_draft, delete_draft
from app.tools.telegram_tools import find_telegram_chat, get_conversation_history, send_telegram_message, get_unread_summary
from app.tools.google_docs_tools import (
    list_documents, get_document_details, create_document, get_document_content,
    create_document_suggestion, apply_document_suggestion, reject_document_suggestion
)
from app.tools.utils_tools import get_current_time
from app.models.user_context import UserContext
from app.models.conversation_state import ConversationState
from app.models.intent import Intent
from app.services.gmail_service import GmailService
from app.services.telegram_service import TelegramService
from app.core.database import get_database

# Pydantic Models for the new two-stage router
class _IntentClassification(BaseModel):
    """The classified high-level intent of the user."""
    intent: Literal[
        'create_event', 'edit_event', 'find_event', 'list_events',
        'list_emails', 'find_email', 'compose_email', 'reply_to_email', 'send_email_draft', 'refine_email_draft', 'cancel_email_draft',
        'find_telegram_chat', 'reply_to_telegram', 'summarize_telegram_chat', 'send_telegram_draft', 'refine_telegram_draft', 'get_latest_telegram_message',
        'summarize_all_unread_telegram',
        'list_documents', 'open_document', 'close_document', 'summarize_document', 'create_document', 'edit_document', 'apply_suggestion', 'reject_suggestion',
        'general_chat'
    ] = Field(description="The user's single primary goal.")

class Message(BaseModel):
    """A single message in a conversation history."""
    role: str
    content: str

class UIContext(BaseModel):
    """The context of the UI, e.g., which page the user is on."""
    page: str
    document_id: Optional[str] = None
    document_title: Optional[str] = None
    path: Optional[str] = None

class ChatRequest(BaseModel):
    input: str = Field(..., description="The user's input message.")
    chat_history: List[Message] = Field(default=[], description="The conversation history.")
    user_context: UserContext = Field(description="The user context.")
    conversation_state: ConversationState = Field(default_factory=ConversationState, description="The state of the current conversation.")
    ui_context: Optional[UIContext] = Field(None, description="The context of the UI from which the request originates.")

class _EventResolverResponse(BaseModel):
    """The result of a reasoning task to find the best matching event."""
    matched_event: Optional[Dict[str, Any]] = Field(description="The single event object from the list that best matches the user's query, or null if no clear match is found.")

# Service Class
class AIOrchestratorService:
    def __init__(self, model: str = "gemini-2.5-flash"):
        self.model_name = model
        api_key = os.environ.get("GOOGLE_GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_GEMINI_API_KEY not found.")

        self.router_llm = ChatGoogleGenerativeAI(model=self.model_name, google_api_key=api_key, temperature=0)
        self.chat_llm = ChatGoogleGenerativeAI(model=self.model_name, google_api_key=api_key, temperature=0.7)
        
        logging.info("✅ AI Orchestrator Service initialized.")

        # Initialize tools available to the agent
        self.tools = [
            get_current_time,
            list_emails,
            get_email_details,
            create_draft_email,
            send_draft,
            delete_draft,
            get_calendar_events,
            create_calendar_event_draft,
            edit_calendar_event,
            find_telegram_chat,
            get_conversation_history,
            send_telegram_message,
            get_unread_summary,
            list_documents,
            get_document_details,
            create_document,
            get_document_content,
            create_document_suggestion,
            apply_document_suggestion,
            reject_document_suggestion,
        ]

    def _prepare_chat_history(self, conversation_history: List['Message']) -> List[BaseMessage]:
        return [HumanMessage(content=msg.content) if msg.role.lower() == 'user' else AIMessage(content=msg.content) for msg in conversation_history]

    # --- ROUTER (NEW TWO-STAGE IMPLEMENTATION) ---
    async def _classify_intent(self, user_input: str, chat_history: List[BaseMessage]) -> str:
        """Stage 1: Classify the user's high-level intent."""
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are Minus AI, a friendly and efficient assistant integrated into this application. Your primary goal is to help users manage their connected services like email, calendar, and documents.\n\n"
             "First, classify the user's intent based on their message. You must respond with a JSON object containing a single key 'intent' whose value is EXACTLY one of the allowed categories.\n\n"
             "The ONLY allowed categories are: `create_event`, `edit_event`, `find_event`, `list_emails`, "
             "`list_emails`, `find_email`, `compose_email`, `reply_to_email`, `send_email_draft`, `refine_email_draft`, `cancel_email_draft`, "
             "`find_telegram_chat`, `reply_to_telegram`, `summarize_telegram_chat`, `send_telegram_draft`, `refine_telegram_draft`, `get_latest_telegram_message`, `summarize_all_unread_telegram`, "
             "`list_documents`, `open_document`, `close_document`, `summarize_document`, `edit_document`, `apply_suggestion`, `reject_suggestion`, `general_chat`\n\n"
             "--- Important Rules ---\n"
             "1.  **Identity:** If asked 'who are you?' or 'introduce yourself', classify the intent as `general_chat`. Your identity is Minus AI, not a generic Google model.\n"
             "2.  **Clarity:** If the user's request is ambiguous, vague, or you cannot determine a clear action, classify the intent as `general_chat`. In this case, you should later ask the user to rephrase their request.\n"
             "3.  **Context is Key:** Pay close attention to the immediate previous turn. If the assistant just listed items (emails, documents, events) and the user says 'summarize the first one' or 'open the one from Samson', the intent is to act on that item (e.g., `find_email`, `open_document`). Do NOT misclassify this as `general_chat`.\n"
             "4.  **Strict Suggestions:** Only classify the intent as `apply_suggestion` or `reject_suggestion` if the AI's last message explicitly presented a suggestion to be approved or rejected.\n"
             "5.  **Markdown:** You can use markdown (like `**bold**` or `* item`) to format your responses for better readability.\n"
             "6.  **Tool-based Intents:** Classify intents based on the user's goal, not the specific tool name. For example, 'fix this paragraph' should be `edit_document`, not `create_document_suggestion`.\n\n"
             "--- Examples ---\n"
             "- 'who are you?' -> `general_chat`\n"
             "- 'what can you do?' -> `general_chat`\n"
             "- 'what's on my calendar today?' -> `find_event`\n"
             "- (After a list of emails is shown) 'summarize the latest one' -> `find_email`\n"
             "- 'read my latest email from Samson' -> `find_email`\n"
             "- 'draft a reply' -> `reply_to_email`\n"
             "- 'summarize the project update document' -> `summarize_document`\n"
             "- 'apply that change' -> `apply_suggestion`\n"
             "- 'that's not right, cancel it' -> `reject_suggestion`"),
            ("placeholder", "{chat_history}"),
            ("human", "{input}")
        ])
        
        try:
            structured_llm = self.router_llm.with_structured_output(_IntentClassification)
            chain = prompt | structured_llm
            result = await chain.ainvoke({"input": user_input, "chat_history": chat_history})
            
            if not result or not hasattr(result, 'intent'):
                logging.warning("Intent classification returned an invalid result. Defaulting to 'general_chat'.")
                return 'general_chat'
                
            allowed_intents = [
                'create_event', 'edit_event', 'find_event',
                'list_emails', 'find_email', 'compose_email', 'reply_to_email', 'send_email_draft', 'refine_email_draft', 'cancel_email_draft',
                'find_telegram_chat', 'reply_to_telegram', 'summarize_telegram_chat', 'send_telegram_draft', 'refine_telegram_draft', 'get_latest_telegram_message', 'summarize_all_unread_telegram',
                'list_documents', 'open_document', 'close_document', 'summarize_document', 'create_document', 'edit_document', 'apply_suggestion', 'reject_suggestion',
                'general_chat'
            ]
            
            if result.intent not in allowed_intents:
                logging.warning(f"LLM returned invalid intent '{result.intent}'. Defaulting to 'general_chat'.")
                return 'general_chat'
            
            return result.intent
            
        except Exception as e:
            logging.error(f"Error in intent classification: {e}")
            user_input_lower = user_input.lower()
            
            if any(word in user_input_lower for word in ['edit', 'change', 'modify', 'update', 'rewrite']):
                return 'edit_document'
            elif any(word in user_input_lower for word in ['create', 'new document', 'make document', 'new doc']):
                return 'create_document'
            elif any(word in user_input_lower for word in ['approve', 'apply', 'yes', 'accept']):
                return 'apply_suggestion'
            elif any(word in user_input_lower for word in ['reject', 'no', 'cancel', 'decline']):
                return 'reject_suggestion'
            elif any(word in user_input_lower for word in ['summarize', 'summary', 'what is this']):
                return 'summarize_document'
            elif any(word in user_input_lower for word in ['open', 'show', 'view']):
                return 'open_document'
            elif any(word in user_input_lower for word in ['list', 'documents', 'docs']):
                return 'list_documents'
            elif any(word in user_input_lower for word in ['email', 'inbox', 'mail']):
                return 'list_emails'
            elif any(word in user_input_lower for word in ['calendar', 'event', 'meeting', 'appointment']):
                return 'list_events'
            
            return 'general_chat'

    async def _extract_details(self, intent_name: str, user_input: str, chat_history: List[BaseMessage]) -> Intent:
        """Stage 2: Extract detailed information based on the classified intent."""
        prompts = {
            'find_event': (
                "You are an expert at extracting event details for a search query. The user wants to find a specific event. "
                "Your job is to extract the following: \n"
                "1. `event_description`: The subject of the event to find (e.g., 'dental appointment'). \n"
                "2. `search_start_date` and `search_end_date`: A sensible date range. \n"
                "   - If the user says 'latest' or 'next', the range should be from 'today' to the keyword 'end_of_the_year'. \n"
                "   - If no date is mentioned, default to a range from 'one month ago' to 'end_of_the_year'."
            ),
            'list_events': (
                "You are an expert at extracting a date range for listing events. The user wants a list of events. "
                "Your ONLY job is to extract the date range they specified (e.g., 'tomorrow', 'this week', 'next month') into `search_start_date` and `search_end_date`. "
                "If no date range is mentioned, default both to 'today'."
            ),
            'create_event': (
                "The user wants to create an event. Extract the details: \n"
                "1. `summary`: The main title of the event (e.g., 'call mom'). \n"
                "2. `start_time`: The FULL date and time expression (e.g., 'tomorrow 5pm'). \n"
                "3. `end_time`: Any specified end time. \n"
                "4. `description`: Any other details."
            ),
            'edit_event': (
                "The user wants to edit an event. Extract the details: \n"
                "1. `event_description`: The subject of the event to find and edit (e.g., 'dental appointment'). "
                "Look in chat history if they say 'it'.\n"
                "2. `summary`, `start_time`, `end_time`, `description`: Any NEW details to update the event with."
            ),
            'list_emails': (
                "The user wants to see their emails. Extract any search query they provide. "
                "For example, in 'show me unread emails from uber', the query is 'is:unread from:uber'. "
                "If no query is given, default to 'is:inbox'."
            ),
            'find_email': (
                "The user wants to find a specific email. Extract the essential keywords from their request. "
                "For example, for 'the latest email about the project proposal from lyft', the keywords would be 'project proposal lyft'. "
                "Crucially, DO NOT include conversational words or search operators like 'latest', 'newest', 'find', 'from:', or 'is:'. "
                "Just extract the core nouns, names, or topics."
            ),
            'compose_email': (
                "The user wants to write a new email. Extract the `email_to`, `email_subject`, and `email_body`."
            ),
            'reply_to_email': (
                "The user wants to reply to an email. First, identify the email to reply to. Look for clues like 'the last one' or a subject. "
                "If they don't specify, note that `email_query` is 'the last email'. "
                "Then, extract the core message for the `email_body`. For example, in 'tell him I will attend', the body is 'I will attend'. "
                "The AI will expand this into a full, polite email later."
            ),
            'send_email_draft': (
                "The user has approved sending a draft, either by clicking a button or by saying something like 'send it' or 'looks good'. "
                "If the user message is a JSON object, extract the `draft_id`. "
                "If it's a natural language command, you don't need to extract anything; the system will use the draft ID from its memory."
            ),
            'refine_email_draft': (
                "The user is reviewing a draft and wants to change it. "
                "Your job is to extract the user's LATEST refinement instruction from their most recent message. "
                "For example, if the user says 'make it sound more formal', the `email_body` should be 'make it sound more formal'. "
                "IGNORE previous instructions in the chat history."
            ),
            'refine_telegram_draft': (
                "The user is reviewing a Telegram message draft and wants to change it. "
                "Your job is to extract the user's LATEST refinement instruction. "
                "For example, if they say 'change it to say I will be 5 minutes late', the `message_body` is 'I will be 5 minutes late'."
            ),
            'cancel_email_draft': (
                "The user wants to cancel and delete the current email draft. They might say 'cancel it', 'stop', or 'nevermind'. "
                "No parameters are needed."
            ),
            'find_telegram_chat': (
                "The user wants to find a specific Telegram chat. Extract the user's description of the chat into the `chat_query` field. "
                "For example, for 'find my chat with the marketing team', the `chat_query` would be 'marketing team'."
            ),
            'summarize_telegram_chat': (
                "The user wants a summary of a Telegram chat. Extract their description of the chat into the `chat_query` field. "
                "For example, in 'what's new in the dev chat', the `chat_query` is 'dev chat'."
            ),
            'reply_to_telegram': (
                "The user wants to send a reply to a Telegram chat. Extract their description of the chat into the `chat_query` field, "
                "and the content of their reply into the `message_body` field. For example, in 'tell the project group I am on my way', "
                "the `chat_query` is 'project group' and `message_body` is 'I am on my way'."
            ),
            'send_telegram_draft': (
                "The user has approved sending a Telegram message that was just drafted. No parameters are needed."
            ),
            'get_latest_telegram_message': (
                "The user wants the latest message from a specific Telegram chat. "
                "Extract their description of the chat into the `chat_query` field. "
                "If the user does not specify a chat (e.g., 'my telegram chat'), you MUST set `chat_query` to the exact string 'LATEST'."
            ),
            'summarize_all_unread_telegram': (
                "The user wants a summary of all their unread Telegram messages. This action takes no parameters."
            ),
            'list_documents': (
                "The user wants to see their Google Docs documents. Extract any search query they provide. "
                "For example, in 'show me documents about marketing', the query is 'marketing'. "
                "If no query is given, default to '*' for all documents."
            ),
            'open_document': (
                "The user wants to open a specific document. Extract the document name or description into the `document_query` field. "
                "For example, in 'open the marketing strategy document', the `document_query` is 'marketing strategy'."
            ),
            'close_document': (
                "The user wants to close the current document and return to the dashboard. This is a navigation command that takes no parameters."
            ),
            'summarize_document': (
                "The user wants a summary of the current document or a specific document. "
                "If they specify a document name, extract it into the `document_query` field. "
                "If they're referring to the current document in context, leave `document_query` empty."
            ),
            'create_document': (
                "The user wants to create a new document. Extract the document title from their request. "
                "For example, in 'create a document called Meeting Notes', the `title` would be 'Meeting Notes'. "
                "If no specific title is provided, you can suggest a generic title like 'New Document' or leave it empty."
            ),
            'edit_document': (
                "The user wants to edit a document. Extract the modification details: "
                "`target_text`: ONLY extract if the user provides specific text to find (e.g., 'change the word hello to hi'). "
                "For references like 'first paragraph', 'second paragraph', etc., leave this EMPTY - the system will handle it. "
                "`modification`: A description of what changes to make. "
                "`new_content`: Any new content to add (if applicable). "
                "`position`: Where to place new content ('before', 'after', or 'replace')."
            ),
            'apply_suggestion': (
                "The user has approved applying a document suggestion. "
                "Extract the `suggestion_id` if provided, or leave it empty if the system should use the suggestion from context. "
                "The user may say 'approve', 'apply', 'yes', or similar approval words."
            ),
            'reject_suggestion': (
                "The user has rejected a document suggestion. "
                "Extract the `suggestion_id` if provided, or leave it empty if the system should use the suggestion from context. "
                "The user may say 'reject', 'no', 'cancel', or similar rejection words."
            )
        }
        
        prompt_template = prompts.get(intent_name)
        if not prompt_template:
            logging.warning(f"No prompt template found for intent '{intent_name}'. Creating basic intent.")
            return Intent(intent=intent_name)

        try:
            prompt = ChatPromptTemplate.from_messages([
                ("system", prompt_template),
                ("placeholder", "{chat_history}"),
                ("human", "{input}")
            ])
            
            structured_llm = self.router_llm.with_structured_output(Intent)
            chain = prompt | structured_llm
            
            extracted_data = await chain.ainvoke({"input": user_input, "chat_history": chat_history})
            
            if extracted_data:
                extracted_data.intent = intent_name
                return extracted_data
            else:
                logging.warning(f"Structured output returned None for intent '{intent_name}'. Creating basic intent.")
                return Intent(intent=intent_name)
        
        except Exception as e:
            logging.error(f"Error in detail extraction for intent '{intent_name}': {e}")
            return Intent(intent=intent_name)

    async def _handle_edit_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles the multi-turn process of editing a calendar event."""
        # Step 1: Check if we have an event in context.
        if not state.last_event_id:
            return {"response": "I'm not sure which event you want to edit. Please find an event first.", "state": state.dict()}

        # Step 2: If the AI hasn't extracted any details, it means it needs more info.
        # The prompt for the extractor should be improved to get all details at once if possible.
        # For now, we'll ask the user what to change.
        if not intent.summary and not intent.start_time and not intent.end_time and not intent.description:
            state.pending_action = "awaiting_event_update"
            return {"response": "Great. What would you like to change about that event?", "state": state.dict()}

        # Step 3: We have the details. Call the tool to update the event.
        result = await edit_calendar_event.coroutine(
            event_id=state.last_event_id,
            new_summary=intent.summary,
            new_start_time=intent.start_time,
            new_end_time=intent.end_time,
            new_description=intent.description,
            user_context=user_context
        )

        if "error" in result:
            return {"response": result["error"], "state": state.dict()}

        # Clear the pending action on success
        state.pending_action = None
        return {"response": result.get("confirmation_message", "I've updated the event."), "state": state.dict()}

    async def _handle_find_event_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Finds events based on a description or time range.
        If one event is found, it saves it to state for follow-up actions.
        If multiple are found, it lists them for clarification.
        This is the primary handler for all calendar read operations.
        """
        # Determine the date range for the search. Default to 'today' if not specified.
        start_time_str = intent.search_start_date or 'today'
        end_time_str = intent.search_end_date or 'today'
        
        # If a specific description is given, expand the date range to ensure we find it.
        if intent.event_description:
            start_time_str = 'one month ago'
            end_time_str = 'one year from now'

        start_dt, end_dt = self._get_expanded_date_range(start_time_str, end_time_str)
        if not start_dt or not end_dt:
            return {"response": "Sorry, I had trouble understanding that date range.", "state": state.dict()}

        # Get all events that fall within the broad date range.
        all_events = await get_calendar_events.coroutine(
            start_time=start_dt, end_time=end_dt, user_context=user_context
        )

        if isinstance(all_events, dict) and "error" in all_events:
            return {"response": all_events["error"], "state": state.dict()}
        if not all_events:
            return {"response": "I couldn't find any events in that timeframe.", "state": state.dict()}

        # If a specific event description was provided, filter the results.
        matching_events = []
        if intent.event_description:
            matching_events = [e for e in all_events if intent.event_description.lower() in e.get('summary', '').lower()]
            if not matching_events:
                return {"response": f"I couldn't find any events matching '{intent.event_description}' in that timeframe.", "state": state.dict()}
        else:
            matching_events = all_events

        # --- Core Logic: Handle based on number of matches ---
        state.last_event_id = None  # Always clear previous event context on a new search

        # Case 1: Exactly one event found. Set it in state for follow-up.
        if len(matching_events) == 1:
            event = matching_events[0]
            state.last_event_id = event['id']
            event_time = self._format_event_time(event)
            response = f"I found one event for you: **{event['summary']}** {event_time}. You can ask me to add a description, or edit it."
            return {"response": response, "state": state.dict()}

        # Case 2: Multiple events found. List them for clarification.
        else:
            event_list_str = ""
            for event in matching_events[:5]:  # Limit to 5 to avoid overwhelming the user
                event_time = self._format_event_time(event)
                event_list_str += f"\n* **{event['summary']}** {event_time}"

            response = f"I found a few events for that timeframe:{event_list_str}"
            if len(matching_events) > 5:
                response += f"\n\n...and {len(matching_events) - 5} more."
            response += "\n\nWhich one would you like to focus on?"
            
            return {"response": response, "state": state.dict()}

    def _get_expanded_date_range(self, start_date_str: str, end_date_str: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Parses start and end date strings, handles special keywords, 
        and returns timezone-aware datetime objects.
        """
        malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
        now = datetime.now(malaysia_tz)
        
        final_end_str = end_date_str or start_date_str
        
        start_dt = None
        end_dt = None

        try:
            # Handle special keywords first
            if start_date_str == 'today':
                start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif start_date_str == 'one month ago':
                start_dt = (now - timedelta(days=30))
            else:
                start_dt = dateparser.parse(start_date_str)

            if final_end_str == 'end_of_the_year':
                end_dt = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=0)
            else:
                end_dt = dateparser.parse(final_end_str)

            if not start_dt or not end_dt:
                logging.error(f"Date parsing resulted in None for: {start_date_str} or {final_end_str}")
                return None, None
            
            # Ensure timezone awareness
            if start_dt.tzinfo is None:
                start_dt = malaysia_tz.localize(start_dt)
            if end_dt.tzinfo is None:
                end_dt = malaysia_tz.localize(end_dt)

            # If it's a single day query, expand to end of day
            if start_dt.date() == end_dt.date():
                end_dt = end_dt.replace(hour=23, minute=59, second=59)

            print(f"DEBUG: Calculated date range: {start_dt.isoformat()} to {end_dt.isoformat()}")
            return start_dt, end_dt

        except Exception as e:
            logging.error(f"Date calculation failed for '{start_date_str}' to '{final_end_str}': {e}")
            return None, None

    def _format_event_time(self, event: Dict[str, Any]) -> str:
        """Formats the event start and end times into a readable string."""
        start = event.get('start', {})
        if 'dateTime' in start:
            start_dt = datetime.fromisoformat(start['dateTime'])
            # .lstrip('0') for cross-platform compatibility (removes leading zero from hour)
            start_time_str = start_dt.strftime('%I:%M %p').lstrip('0')

            end = event.get('end', {})
            if 'dateTime' in end:
                end_dt = datetime.fromisoformat(end['dateTime'])
                # Only show end time if it's more than a minute after the start
                if (end_dt - start_dt).total_seconds() > 60:
                    end_time_str = end_dt.strftime('%I:%M %p').lstrip('0')
                    return f"from {start_time_str} to {end_time_str}"
            
            return f"at {start_time_str}"
        elif 'date' in start:
            return "which is an all-day event"
        return ""

    async def _handle_find_telegram_chat_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles finding a telegram chat and returning its details."""
        if not intent.chat_query:
            return {"response": "Whoops, I have to know which chat you're looking for. Can you be more specific?", "state": state.dict()}

        chat_details = await find_telegram_chat.coroutine(chat_query=intent.chat_query, user_context=user_context.dict())

        if chat_details.get("error"):
            return {"response": chat_details["error"], "state": state.dict()}

        if chat_details.get("success"):
            state.last_telegram_chat_id = chat_details.get("chat_id")
            response = f"I found the chat: '{chat_details['chat_name']}'. What would you like to do with it?"
            return {"response": response, "state": state.dict()}
        
        return {"response": "I couldn't seem to find that chat. Please try again.", "state": state.dict()}

    async def _handle_summarize_telegram_chat_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Finds a chat, gets its history, and summarizes it."""
        print("\n--- 🧠 INTENT: _handle_summarize_telegram_chat_intent ---")
        chat_id = state.last_telegram_chat_id
        if not chat_id:
            if not intent.chat_query:
                return {"response": "I need to know which chat you want to summarize. Please specify one.", "state": state.dict()}
            print("   - No chat_id in state, calling 'find_telegram_chat' tool...")
            chat_details = await find_telegram_chat.coroutine(chat_query=intent.chat_query, user_context=user_context.dict())
            if chat_details.get("error"):
                return {"response": chat_details["error"], "state": state.dict()}
            if not chat_details.get("success"):
                return {"response": "I couldn't find the specified chat to summarize.", "state": state.dict()}
            chat_id = chat_details.get("chat_id")
            state.last_telegram_chat_id = chat_id
            print(f"   - Tool found chat_id: {chat_id}")

        print("   - Calling 'get_conversation_history' tool...")
        history = await get_conversation_history.coroutine(chat_id=chat_id, user_context=user_context.dict())
        if not history or "error" in history[0]:
            return {"response": "I found the chat but couldn't retrieve its history.", "state": state.dict()}

        summary_prompt = f"Here is the recent history for the Telegram chat '{intent.chat_query}':\n\n{history}\n\nPlease provide a concise summary of the conversation."
        print("\n--- 📝 FINAL PROMPT for Summarization ---")
        print(summary_prompt)
        print("----------------------------------------")
        summary = await self.chat_llm.ainvoke(summary_prompt)

        return {"response": summary.content, "state": state.dict()}

    async def _handle_reply_to_telegram_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Handles sending a reply to a Telegram chat.
        It prioritizes chat_id from the state. If not present, it uses the intent's query.
        If the user is correcting a previous suggestion, it handles that too.
        """
        chat_id = state.last_telegram_chat_id
        chat_name = "the last chat"
        
        # Core logic to determine the target chat
        if not chat_id or (intent.chat_query and "no" in user_input.lower()):
            # If state is missing, or user is correcting the bot ("No, send to...")
            # we need to find the chat based on the new query.
            if not intent.chat_query:
                return {
                    "response": "I'm not sure which chat to send this message to. Please specify the recipient (e.g., 'send it to the project group').",
                    "state": state.dict()
                }

            chat_details = await find_telegram_chat.coroutine(chat_query=intent.chat_query, user_context=user_context)
            if chat_details.get("error"):
                return {"response": chat_details["error"], "state": state.dict()}
            
            chat_id = chat_details.get("chat_id")
            chat_name = chat_details.get("chat_name")
            
            if not chat_id:
                return {"response": f"I couldn't find a chat matching '{intent.chat_query}'. Please try a different name.", "state": state.dict()}

        if not intent.message_body:
            return {"response": "I see you want to send a message. What should it say?", "state": state.dict()}
            
        # At this point, we have a chat_id and a message. Create a draft for confirmation.
        state.last_telegram_chat_id = chat_id
        state.last_message_body = intent.message_body

        return {
            "type": "telegram_draft",
            "response": f"Here's the draft of the message: \"{intent.message_body}\". I will send it to '{chat_name}' if it sounds good to you.",
            "details": {
                "chat_id": chat_id,
                "chat_name": chat_name,
                "body": intent.message_body
            },
            "state": state.dict()
        }

    async def _handle_send_telegram_draft_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Sends the telegram message that was previously drafted and stored in the state.
        """
        chat_id = state.last_telegram_chat_id
        message_body = state.last_message_body

        if not chat_id or not message_body:
            return {"response": "I'm not sure what to send. Please tell me who to message and what to say first.", "state": state.dict()}

        send_result = await send_telegram_message.coroutine(chat_id=chat_id, message=message_body, user_context=user_context)

        if send_result and send_result.get("success"):
            # Clear the state after sending
            state.last_telegram_chat_id = None
            state.last_message_body = None
            return {"response": "Done. The message has been sent.", "state": state.dict()}
        else:
            return {"response": send_result.get("error", "I failed to send the message."), "state": state.dict()}

    async def _handle_get_latest_telegram_message_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Gets the latest message from a specific chat or the latest unread message overall.
        If a specific chat is mentioned, it finds it and gets the history.
        If not, it gets a summary of all unread messages.
        """
        if intent.chat_query and intent.chat_query != 'LATEST':
            # User is asking for the latest message in a specific chat
            chat_info = await find_telegram_chat.coroutine(chat_query=intent.chat_query, user_context=user_context)
            if "error" in chat_info:
                return {"response": chat_info["error"], "state": state.dict()}
            
            chat_id = chat_info.get("chat_id")
            if not chat_id:
                return {"response": f"I couldn't find the chat '{intent.chat_query}'.", "state": state.dict()}

            history = await get_conversation_history.coroutine(chat_id=chat_id, user_context=user_context)
            if isinstance(history, list) and history and "error" not in history[0]:
                state.last_telegram_chat_id = chat_id # Save context
                latest_message = history[-1]
                response_text = f"The latest message in '{chat_info.get('chat_name')}' is: {latest_message}"
                return {"response": response_text, "state": state.dict()}
            else:
                return {"response": f"I found the chat, but couldn't retrieve its history.", "state": state.dict()}
        else:
            # User is asking for the latest message across all chats
            summary_result = await get_unread_summary.coroutine(user_context=user_context)

            if not summary_result or (isinstance(summary_result, list) and "info" in summary_result[0]):
                return {"response": "You have no new messages on Telegram.", "state": state.dict()}
            if isinstance(summary_result, list) and "error" in summary_result[0]:
                return {"response": summary_result[0]["error"], "state": state.dict()}

            # We care about the most recent message from the summary
            # Assuming the service and tools return lists of chats with their messages
            if isinstance(summary_result, list) and summary_result:
                # Let's find the absolute latest message across all unread chats
                latest_chat = summary_result[-1] # Often the most recent activity is last
                latest_message_text = latest_chat['messages'][-1]
                chat_name = latest_chat['chat_name']
                chat_id = latest_chat['chat_id']

                # Save the context of this latest chat
                state.last_telegram_chat_id = chat_id
                
                response_text = f"Your latest message is in '{chat_name}': {latest_message_text}"
                return {"response": response_text, "state": state.dict()}
            else:
                # This case handles empty summaries or unexpected formats
                return {"response": "I found some unread messages but couldn't determine the latest one.", "state": state.dict()}

    async def _handle_summarize_all_unread_telegram_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Fetches and presents a summary of all unread messages from all chats.
        """
        print("\n--- 🧠 INTENT: _handle_summarize_all_unread_telegram_intent ---")
        
        unread_data = await get_unread_summary.coroutine(user_context=user_context.dict())

        if not unread_data or "error" in unread_data[0]:
            error_message = unread_data[0].get("error", "I couldn't retrieve the unread message summary.")
            return {"response": error_message, "state": state.dict()}

        if "info" in unread_data[0]:
            return {"response": unread_data[0]["info"], "state": state.dict()}

        summary_prompt = f"You have received the following unread messages from Telegram. Please provide a concise summary for the user, grouped by chat.\n\n{unread_data}"
        print("\n--- 📝 FINAL PROMPT for Unread Summary ---")
        print(summary_prompt)
        print("----------------------------------------")
        summary = await self.chat_llm.ainvoke(summary_prompt)

        return {"response": summary.content, "state": state.dict()}

    async def _handle_list_events_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        start_time_str = intent.search_start_date or 'today'
        end_time_str = intent.search_end_date or start_time_str
        start_dt, end_dt = self._get_expanded_date_range(start_time_str, end_time_str)

        if not start_dt or not end_dt:
            return {"response": "Sorry, I had trouble understanding the date range for your search.", "state": state.dict()}

        events = await get_calendar_events.coroutine(
            start_time=start_dt, end_time=end_dt, user_context=user_context
        )

        if isinstance(events, dict) and "error" in events:
            return {"response": events["error"], "state": state.dict()}

        if not events:
            return {"response": f"You have no events on your calendar for {start_time_str}.", "state": state.dict()}

        response_prompt = f"Here are the events on the user's calendar for {start_time_str}: {events}. Summarize them in a clear, friendly list."
        final_response = await self.chat_llm.ainvoke(response_prompt)
        return {"response": final_response.content, "state": state.dict()}

    async def _handle_create_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles the intent to create a new calendar event."""
        result = await create_calendar_event_draft.coroutine(
            summary=intent.summary,
            start_time=intent.start_time,
            end_time=intent.end_time,
            description=intent.description,
            user_context=user_context
        )

        if isinstance(result, dict) and "error" in result:
            return {"response": result["error"], "state": state.dict()}

        if result and result.get("status") == "event_created":
            state.last_event_id = result.get("details", {}).get("event_id")
            return {"response": result.get("confirmation_message", "I've created the event."), "state": state.dict()}
        else:
            error_message = result.get("error", "Sorry, I couldn't create the event. Please try again.")
            return {"response": error_message, "state": state.dict()}

    async def _handle_list_emails_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles the 'list_emails' intent."""
        query = intent.query or "is:inbox"
        
        email_list = await list_emails.coroutine(query=query, max_results=5, user_context=user_context, testing=testing)

        if not email_list:
            return {"response": f"I couldn't find any emails for the query '{query}'.", "state": state.dict()}
            
        # Let the LLM format the response nicely
        prompt = (
            f"Here is a list of emails found for the user's query: '{user_input}'. "
            f"Please present this to the user in a clear, summarized way.\n\n"
            f"Emails: {email_list}"
        )
        final_response = await self.chat_llm.ainvoke(prompt)
        return {"response": final_response.content, "state": state.dict()}

    async def _handle_find_email_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Handles finding a specific email by first fetching a list of recent emails 
        and then using an LLM to reason over that list to find the best match.
        This approach is more robust than relying on a perfect search query from the first LLM.
        """
        print("\n--- HANDLING FIND_EMAIL INTENT ---")
        if not intent.email_query:
            print("LOG: Intent has no email_query. Aborting.")
            return {"response": "I can help find an email, but I need to know what to search for. For example, 'the email from my manager' or 'the email about the quarterly report'.", "state": state.dict()}

        # Step 1: Fetch a broad list of recent emails (e.g., last 30 days)
        # The user's original query (e.g., 'from:Samson') is still useful for a first-pass filter.
        print(f"LOG: Step 1 - Searching for candidate emails with initial query: '{intent.email_query}'")
        candidate_emails = await list_emails.coroutine(query=intent.email_query, max_results=10, user_context=user_context, testing=testing) # Increased max_results

        if not candidate_emails:
            print("LOG: list_emails tool returned no results.")
            return {"response": f"I couldn't find any emails matching your search: '{intent.email_query}'. You could try being less specific to see more results.", "state": state.dict()}

        print(f"LOG: Found {len(candidate_emails)} candidate email(s).")

        # If there's only one result, we can skip the reasoning step.
        if len(candidate_emails) == 1:
            best_match_id = candidate_emails[0]['id']
            print("LOG: Step 2 - Only one candidate found. Skipping LLM resolver.")
        else:
            # Step 2: Use a resolver LLM to reason over the list of candidates
            print(f"LOG: Step 2 - Multiple candidates found. Engaging LLM to resolve the best match.")
            resolver_prompt = ChatPromptTemplate.from_messages([
                ("system",
                 "You are a reasoning engine. Below is a user's request and a list of JSON objects representing their recent emails. "
                 "Your task is to analyze the request and identify the `id` of the single email from the list that best matches. "
                 "Pay close attention to relative terms like 'latest', 'newest', 'first', or 'oldest'. "
                 "To determine the 'latest' or 'newest', you MUST compare the `date` field of each email object. A more recent date is later. "
                 "Respond ONLY with the `id` of the single best matching email, or 'null' if no single email is a clear match."),
                ("human", "User Request: {user_input}\n\nEmail List:\n{email_list}")
            ])
            
            # A Pydantic model for the resolver's response
            class _EmailResolverResponse(BaseModel):
                matched_email_id: Optional[str] = Field(description="The 'id' of the single email object that best matches the user's request.")

            structured_resolver_llm = self.chat_llm.with_structured_output(_EmailResolverResponse)
            resolver_chain = resolver_prompt | structured_resolver_llm
            
            resolver_result = await resolver_chain.ainvoke({
                "user_input": user_input,
                "email_list": str(candidate_emails) # Pass the list of dicts as a string
            })

            # FIX: Handle the case where the resolver fails and returns a None object.
            if resolver_result:
                best_match_id = resolver_result.matched_email_id
            else:
                best_match_id = None

            print(f"LOG: LLM Resolver has finished. Best match ID: {best_match_id}")
        
        # Step 3: Act on the resolved email ID
        print(f"LOG: Step 3 - Proceeding with email ID: {best_match_id}")
        if best_match_id:
            email_details = await get_email_details.coroutine(message_id=best_match_id, summarize=True, user_context=user_context, testing=testing)
            
            if not email_details or "error" in email_details:
                 print("LOG: Error fetching details for the resolved email.")
                 return {"response": "I found the right email, but ran into an error trying to read its content.", "state": state.dict()}

            state.last_email_id = email_details.get('id')
            state.last_thread_id = email_details.get('thread_id')
            
            # The summary is already in email_details because of summarize=True
            summary = email_details.get('summary', 'The summary is not available.')
            
            prompt = f"The user asked for: '{user_input}'. I found the following email and summarized it: {summary}. Present this summary to the user and ask if they would like to reply."
            print("LOG: Generating final summary response for user.")
            final_response = await self.chat_llm.ainvoke(prompt)
            return {"response": final_response.content, "state": state.dict()}
        else:
            print("LOG: LLM resolver could not determine a best match or returned null.")
            # Create a user-friendly list of options if the resolver fails
            options_list = "\n".join([f"- From: {email.get('sender', {}).get('name', 'N/A')}, Subject: {email.get('subject', 'N/A')}" for email in candidate_emails])
            return {"response": f"I found a few emails matching '{intent.email_query}', but I'm not sure which one you meant. Here are the top results:\n{options_list}\n\nCould you be more specific?", "state": state.dict()}

    async def _handle_compose_email_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles the 'compose_email' intent by creating a draft."""
        if not intent.email_to or not intent.email_subject or not intent.email_body:
            return {"response": "To compose an email, I need to know who it's for, the subject, and the message. Could you provide those details?", "state": state.dict()}
            
        draft_details = await create_draft_email.coroutine(
            to=intent.email_to,
            subject=intent.email_subject,
            body=intent.email_body,
            user_context=user_context,
            testing=testing
        )
        
        # This is a special response type the frontend will look for
        return {
            "type": "draft_review",
            "details": draft_details,
            "state": state.dict()
        }

    async def _handle_reply_to_email_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles replying to an email by creating a draft reply."""
        thread_id = state.last_thread_id
        email_to_reply_to = None

        if not thread_id:
            # If no thread is in context, we must find the email first.
            # Default to finding the 'latest' email if no query is provided by the extractor.
            find_query = intent.email_query or "in:inbox" 
            
            found_emails = await list_emails.coroutine(query=find_query, max_results=1, user_context=user_context, testing=testing)
            if not found_emails:
                return {"response": f"I couldn't find an email to reply to based on your request: '{user_input}'.", "state": state.dict()}
            
            email_to_reply_to = await get_email_details.coroutine(message_id=found_emails[0]['id'], user_context=user_context, testing=testing)
            thread_id = email_to_reply_to.get('thread_id')
            state.last_thread_id = thread_id
            state.last_email_id = email_to_reply_to.get('id')
        else:
            # We have a thread, get the details of the last message to prepare the reply
            email_to_reply_to = await get_email_details.coroutine(message_id=state.last_email_id, user_context=user_context, testing=testing)

        if not email_to_reply_to or not thread_id:
            return {"response": "I seem to have lost track of the email we were talking about. Could you specify which one you'd like to reply to?", "state": state.dict()}

        # The 'To' for the reply should be the 'From' of the original email.
        reply_to_address = email_to_reply_to['sender']['email']
        
        # Prepend "Re: " to subject if it's not already there
        original_subject = email_to_reply_to['subject']
        reply_subject = f"Re: {original_subject}" if not original_subject.lower().startswith('re:') else original_subject
        
        # IMPROVEMENT: Use LLM to expand the user's core message into a polite email body.
        body_generation_prompt = f"A user wants to reply to an email with the subject '{original_subject}'. Their core instruction is: '{intent.email_body}'. Expand this into a polite, professional email body. For example, if the user says 'I'll be there', you could write 'Thank you for the invitation. I would be happy to attend. Looking forward to it!'. Start directly with the body, do not include a subject line, and sign off with 'Best regards, [Your Name]'."
        
        llm = self.chat_llm
        generated_body = await llm.ainvoke(body_generation_prompt)
        final_body = generated_body.content if generated_body else intent.email_body
        
        draft_details = await create_draft_email.coroutine(
            to=reply_to_address,
            subject=reply_subject,
            body=final_body,
            thread_id=thread_id,
            user_context=user_context,
            testing=testing
        )
        
        # Save the new draft_id to state for potential refinement
        if draft_details and "draft_id" in draft_details:
            state.last_draft_id = draft_details["draft_id"]
            state.last_recipient_email = reply_to_address # Remember who we're replying to

        return {
            "type": "draft_review",
            "details": draft_details,
            "state": state.dict()
        }

    async def _handle_send_email_draft_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles sending a previously created draft."""
        # The user can either click the button (passing draft_id in the intent) or say 'send it' (using draft_id from state).
        draft_id_to_send = intent.draft_id or state.last_draft_id
        
        if not draft_id_to_send:
            return {"response": "I'm sorry, I don't have a draft to send. Please create a draft first.", "state": state.dict()}
        
        send_result = await send_draft.coroutine(draft_id=draft_id_to_send, user_context=user_context, testing=testing)
        
        if send_result and send_result.get('id'):
            # Clear the last email/thread/draft context as the action is complete.
            state.last_email_id = None
            state.last_thread_id = None
            state.last_draft_id = None
            state.last_recipient_email = None
            return {"response": "Done. The email has been sent successfully.", "state": state.dict()}
        else:
            return {"response": "I encountered an error trying to send the email. Please check your drafts in Gmail.", "state": state.dict()}

    async def _handle_refine_email_draft_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles refining an existing draft."""
        draft_id = state.last_draft_id
        if not draft_id:
            return {"response": "I'm not sure which draft you want to refine. Please start by creating a reply or new email.", "state": state.dict()}

        # Acknowledging the limitation and providing a path forward:
        # Step 1: Get the current draft details
        gmail_service = GmailService(user_id=user_context.user_id, testing=testing)
        try:
            original_draft_details = await gmail_service.get_draft_details(draft_id)
        except Exception as e:
            return {"response": f"Sorry, I couldn't retrieve the original draft to modify it. Error: {e}", "state": state.dict()}

        # Step 2: Create a prompt for the LLM to refine the body
        refinement_prompt = (
            f"A user wants to refine an email draft they are writing. "
            f"Their instruction is: '{intent.email_body}'.\n\n"
            f"Here is the current email body:\n---\n{original_draft_details.body_plain}\n---\n\n"
            f"Please generate a new email body that incorporates the user's instruction. "
            f"Respond ONLY with the new, complete email body."
        )
        
        refined_body_response = await self.chat_llm.ainvoke(refinement_prompt)
        refined_body = refined_body_response.content if refined_body_response else original_draft_details.body_plain

        # Step 3: Delete the old draft
        await delete_draft.coroutine(draft_id=draft_id, user_context=user_context, testing=testing)
        
        # Get recipient from state to avoid parsing issues
        recipient_email = state.last_recipient_email
        if not recipient_email:
            return {"response": "I'm sorry, I've lost track of who this email was for. Please start the reply again.", "state": state.dict()}

        # Step 4: Create a new draft with the refined body
        new_draft_details = await create_draft_email.coroutine(
            to=recipient_email,
            subject=original_draft_details.subject,
            body=refined_body,
            thread_id=original_draft_details.thread_id,
            user_context=user_context,
            testing=testing
        )

        # Step 5: Update state and return for review
        if new_draft_details and "draft_id" in new_draft_details:
            state.last_draft_id = new_draft_details["draft_id"]
        else:
            state.last_draft_id = None # Clear if new draft creation failed

        return {
            "type": "draft_review",
            "details": new_draft_details,
            "state": state.dict()
        }

    async def _handle_cancel_email_draft_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles cancelling and deleting the current draft."""
        draft_id_to_delete = state.last_draft_id
        
        if not draft_id_to_delete:
            return {"response": "There is no active draft to cancel.", "state": state.dict()}
            
        await delete_draft.coroutine(draft_id=draft_id_to_delete, user_context=user_context, testing=testing)
        
        # Clear the draft context
        state.last_draft_id = None
        state.last_recipient_email = None
        
        return {"response": "Got it. I've cancelled and deleted the draft.", "state": state.dict()}

    # --- GOOGLE DOCS INTENT HANDLERS ---

    async def _handle_list_documents_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles listing the user's Google Docs documents."""
        # The detail extractor populates the 'document_query' field in the Intent model
        query = getattr(intent, 'document_query', '*')
        
        print(f"Orchestrator: Handling 'list_documents' with extracted query: '{query}'")

        documents_result = await list_documents.coroutine(
            query=query,  # Pass the extracted query to the 'query' parameter of the tool
            limit=20,
            trashed=False,
            user_context=user_context
        )
        
        if documents_result.get("error"):
            return {"response": f"I couldn't retrieve your documents: {documents_result['error']}", "state": state.dict()}
        
        documents = documents_result.get("documents", [])
        if not documents:
            if query != '*':
                response = f"I couldn't find any documents matching '{query}'."
            else:
                response = "You don't have any documents yet."
        else:
            doc_list = "\n".join([f"• {doc['title']}" for doc in documents[:10]])
            response = f"Here are your documents for '{query}':\n\n{doc_list}"
            if len(documents) > 10:
                response += f"\n\n...and {len(documents) - 10} more."
        
        print("Orchestrator: Successfully listed documents.")
        return {"response": response, "state": state.dict()}

    async def _handle_open_document_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles opening a specific document."""
        document_query = getattr(intent, 'document_query', None)
        
        if not document_query:
            return {"response": "Please specify which document you'd like to open.", "state": state.dict()}
        
        # Find the document
        document_result = await get_document_details.coroutine(
            query=document_query,
            user_context=user_context
        )
        
        if document_result.get("error"):
            return {"response": f"I couldn't find that document: {document_result['error']}", "state": state.dict()}
        
        if document_result.get("multiple_matches"):
            docs = document_result.get("documents", [])
            doc_list = "\n".join([f"• {doc['title']}" for doc in docs])
            return {"response": f"I found multiple documents matching '{document_query}':\n\n{doc_list}\n\nPlease be more specific.", "state": state.dict()}
        
        document = document_result.get("document")
        if not document:
            return {"response": f"I couldn't find a document matching '{document_query}'. Please check the name and try again.", "state": state.dict()}
        
        # Save the document context and trigger navigation
        state.last_document_id = document["document_id"]
        state.last_document_title = document["title"]
        
        return {
            "type": "navigation",
            "target_url": f"/docs/{document['document_id']}?title={document['title']}",
            "response": f"Opening '{document['title']}'...",
            "state": state.dict()
        }

    async def _handle_close_document_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles closing the current document and returning to dashboard."""
        
        # Check if a document is currently open
        if state.last_document_id:
            # Clear document context
            state.last_document_id = None
            state.last_document_title = None
            state.last_suggestion_id = None
            
            # Return a special response type for the frontend to handle navigation
            return {
                "type": "document_closed",
                "response": "The document has been closed.",
                "state": state.dict()
            }
        else:
            # No document is open
            return {
                "response": "There is no document currently open to close.",
                "state": state.dict()
            }

    async def _handle_summarize_document_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles summarizing a document."""
        document_query = getattr(intent, 'document_query', None)
        document_id = None
        
        if document_query:
            # Find the specific document
            document_result = await get_document_details.coroutine(
                query=document_query,
                user_context=user_context
            )
            
            if document_result.get("error"):
                return {"response": f"I couldn't find that document: {document_result['error']}", "state": state.dict()}
            
            document = document_result.get("document")
            if not document:
                return {"response": f"I couldn't find a document matching '{document_query}'.", "state": state.dict()}
            
            document_id = document["document_id"]
        else:
            # Use the current document from context
            document_id = state.last_document_id
            if not document_id:
                return {"response": "Please specify which document you'd like me to summarize, or open a document first.", "state": state.dict()}
        
        # Get the document content and summarize it
        content_result = await get_document_content.coroutine(
            document_id=document_id,
            summarize=True,
            user_context=user_context
        )
        
        if content_result.get("error"):
            return {"response": f"I couldn't read the document: {content_result['error']}", "state": state.dict()}
        
        content = content_result.get("content", "")
        if not content:
            return {"response": "This document appears to be empty.", "state": state.dict()}
        
        return {"response": f"Here's a summary of the document:\n\n{content}", "state": state.dict()}

    async def _extract_target_text_from_document(self, user_input: str, document_id: str, user_context: UserContext) -> Optional[str]:
        """
        Intelligently extract target text from actual document content.
        Handles phrases like 'first paragraph', 'second paragraph', etc.
        """
        try:
            # Get the actual document content
            content_result = await get_document_content.coroutine(
                document_id=document_id,
                summarize=False,  # Important: get actual content, not summary
                user_context=user_context
            )
            
            if content_result.get("error") or not content_result.get("content"):
                logging.error(f"Failed to get document content for target text extraction: {content_result.get('error')}")
                return None
            
            document_content = content_result.get("content", "")
            
            # Split content into paragraphs - handle different paragraph separators
            # Google Docs might use different line break patterns
            paragraphs = []
            
            # Try double newlines first
            if '\n\n' in document_content:
                paragraphs = [p.strip() for p in document_content.split('\n\n') if p.strip()]
            else:
                # Fallback to single newlines, but filter out very short lines
                potential_paragraphs = [p.strip() for p in document_content.split('\n') if p.strip()]
                paragraphs = [p for p in potential_paragraphs if len(p) > 10]  # Filter out headers, single words, etc.
            
            if not paragraphs:
                logging.warning("Document appears to be empty or has no paragraphs")
                return None
            
            user_lower = user_input.lower()
            
            # Handle specific paragraph references
            if "first paragraph" in user_lower and len(paragraphs) > 0:
                return paragraphs[0]
            elif "second paragraph" in user_lower and len(paragraphs) > 1:
                return paragraphs[1]
            elif "third paragraph" in user_lower and len(paragraphs) > 2:
                return paragraphs[2]
            elif "last paragraph" in user_lower and len(paragraphs) > 0:
                return paragraphs[-1]
            
            # Handle numbered paragraph references
            import re
            paragraph_match = re.search(r'(\d+)(?:st|nd|rd|th)?\s+paragraph', user_lower)
            if paragraph_match:
                paragraph_num = int(paragraph_match.group(1))
                if 1 <= paragraph_num <= len(paragraphs):
                    return paragraphs[paragraph_num - 1]
            
            # If no specific paragraph reference found, return None
            # The system will fall back to the original target_text extraction
            return None
            
        except Exception as e:
            logging.error(f"Error extracting target text from document: {e}")
            return None

    async def _handle_edit_document_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles editing a document by creating a suggestion."""
        document_id = state.last_document_id
        
        if not document_id:
            return {"response": "Please open a document first before making edits.", "state": state.dict()}
        
        # Extract edit parameters
        target_text = getattr(intent, 'target_text', None)
        modification = getattr(intent, 'modification', None)
        new_content = getattr(intent, 'new_content', None)
        position = getattr(intent, 'position', 'replace')
        
        if not modification:
            return {"response": "Please specify what changes you'd like me to make to the document.", "state": state.dict()}
        
        # IMPROVED: Try to extract target text from actual document content
        # This handles cases like "edit the first paragraph" properly
        if not target_text or "paragraph" in user_input.lower():
            extracted_target = await self._extract_target_text_from_document(user_input, document_id, user_context)
            if extracted_target:
                target_text = extracted_target
                logging.info(f"Extracted target text from document: '{target_text[:100]}...'")
        
        # Create the suggestion
        suggestion_result = await create_document_suggestion.coroutine(
            document_id=document_id,
            modification=modification,
            target_text=target_text,
            new_content=new_content,
            position=position,
            user_context=user_context
        )
        
        if suggestion_result.get("error"):
            return {"response": f"I couldn't create the suggestion: {suggestion_result['error']}", "state": state.dict()}
        
        # Save the suggestion ID for potential approval/rejection
        state.last_suggestion_id = suggestion_result.get("suggestion_id")
        
        # Create a user-friendly suggestion structure for the frontend
        suggestion_data = {
            "suggestion_id": suggestion_result.get("suggestion_id"),
            "document_id": suggestion_result.get("document_id"),
            "modification": suggestion_result.get("modification"),
            "original_text": suggestion_result.get("target_text", ""),
            "suggested_text": suggestion_result.get("suggested_text", ""),
            "preview_type": "document_edit"
        }
        
        return {
            "type": "tool_draft",
            "tool_name": "create_document_suggestion",
            "tool_input": suggestion_data,
            "assistant_message": f"Here's a more professional version of the text:",
            "state": state.dict()
        }

    async def _handle_apply_suggestion_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles applying a document suggestion."""
        suggestion_id = getattr(intent, 'suggestion_id', None) or state.last_suggestion_id
        document_id = state.last_document_id
        
        if not suggestion_id:
            return {"response": "I don't have a suggestion to apply. Please make an edit first.", "state": state.dict()}
        
        if not document_id:
            return {"response": "I need to know which document to apply the suggestion to.", "state": state.dict()}
        
        # Apply the suggestion
        apply_result = await apply_document_suggestion.coroutine(
            suggestion_id=suggestion_id,
            document_id=document_id,
            user_context=user_context
        )
        
        if apply_result.get("error"):
            return {"response": f"I couldn't apply the suggestion: {apply_result['error']}", "state": state.dict()}
        
        # Clear the suggestion from state
        state.last_suggestion_id = None
        
        return {"response": apply_result.get("message", "The suggestion has been applied to your document."), "state": state.dict()}

    async def _handle_reject_suggestion_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles rejecting a document suggestion."""
        suggestion_id = getattr(intent, 'suggestion_id', None) or state.last_suggestion_id
        document_id = state.last_document_id
        
        if not suggestion_id:
            return {"response": "I don't have a suggestion to reject. The suggestion may have already been processed.", "state": state.dict()}
        
        if not document_id:
            return {"response": "I need to know which document the suggestion belongs to.", "state": state.dict()}
        
        # Reject the suggestion
        reject_result = await reject_document_suggestion.coroutine(
            suggestion_id=suggestion_id,
            document_id=document_id,
            user_context=user_context
        )
        
        if reject_result.get("error"):
            return {"response": f"I couldn't reject the suggestion: {reject_result['error']}", "state": state.dict()}
        
        # Clear the suggestion from state
        state.last_suggestion_id = None
        
        return {"response": reject_result.get("message", "The suggestion has been rejected and removed."), "state": state.dict()}

    async def _handle_create_document_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """Handles creating a new document."""
        title = getattr(intent, 'title', None)
        
        if not title:
            # If no title is provided, ask the user for one
            state.pending_action = "awaiting_document_title"
            return {"response": "What would you like to name the document?", "state": state.dict()}
        
        # Create the document
        document_result = await create_document.coroutine(
            title=title,
            user_context=user_context
        )
        
        if document_result.get("error"):
            return {"response": f"I couldn't create the document: {document_result['error']}", "state": state.dict()}
        
        if document_result.get("success"):
            # Update state with the new document
            document_id = document_result.get("document_id")
            if document_id:
                state.last_document_id = document_id
                state.last_document_title = title
            
            # Clear pending action after successful creation
            state.pending_action = None
            
            return {
                "type": "navigation",
                "target_url": f"/docs/{document_id}?title={title}" if document_id else "/docs",
                "response": f"I've created a new document titled '{title}' for you.",
                "state": state.dict()
            }
        else:
            return {"response": f"An unexpected error occurred during document creation.", "state": state.dict()}

    async def _handle_refine_telegram_draft_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str, testing: bool = False) -> Dict[str, Any]:
        """
        Handles refining a previously drafted Telegram message.
        """
        chat_id = state.last_telegram_chat_id
        if not chat_id:
            return {"response": "I'm sorry, I don't know which message you're trying to refine. Please start by replying to a chat first.", "state": state.dict()}

        if not intent.message_body:
            return {"response": "What should the new message be?", "state": state.dict()}

        # We need the chat name for the response, so we'll have to find it.
        # This is slightly inefficient but required for a good user experience.
        db = get_database()
        telegram_service = TelegramService(db)
        active_chats = await telegram_service.get_active_chats_for_search(user_context.user_id)
        chat_name = "this chat"
        matched_chat = next((chat for chat in active_chats if chat['chat_id'] == chat_id), None)
        if matched_chat:
            chat_name = matched_chat['chat_name']

        # Update the state and return a new draft
        state.last_message_body = intent.message_body
        return {
            "type": "telegram_draft",
            "response": f"Okay, new draft for '{chat_name}': \"{intent.message_body}\". Does this look right?",
            "details": {
                "chat_id": chat_id,
                "chat_name": chat_name,
                "body": intent.message_body
            },
            "state": state.dict()
        }

    # --- MAIN ENTRY POINT ---
    async def process_message(self, request: ChatRequest, testing: bool = False) -> Dict[str, Any]:
        chat_history = self._prepare_chat_history(request.chat_history)
        
        # --- Context Injection from UI ---
        # If the UI provides a document context, inject it into the state at the beginning of the request.
        if request.ui_context and request.ui_context.page == 'docs' and request.ui_context.document_id:
            if request.conversation_state.last_document_id != request.ui_context.document_id:
                logging.info(f"Updating conversation state with new document context: ID {request.ui_context.document_id}")
                request.conversation_state.last_document_id = request.ui_context.document_id
                request.conversation_state.last_document_title = request.ui_context.document_title
        # ---------------------------------

        print(f"\n--- New Request ---")
        print(f"User Input: {request.input}")
        print(f"Initial State: {request.conversation_state.dict()}")

        try:
            # --- Handle Pending Actions ---
            if request.conversation_state.pending_action == "awaiting_document_title":
                # User is providing a title for the document
                intent = Intent(intent="create_document", title=request.input)
                response = await self._handle_create_document_intent(intent, request.user_context, request.conversation_state, request.input, testing=testing)
            
            elif request.conversation_state.pending_action == "awaiting_event_update":
                # User is providing the details for an event update.
                # Use the 'edit_event' extractor to parse the new details from the user's input.
                print("--- 🧠 Pending Action: awaiting_event_update ---")
                intent = await self._extract_details("edit_event", request.input, chat_history)
                print(f"2. EXTRACTOR (from pending action) populated details: {intent.dict(exclude_none=True)}")
                response = await self._handle_edit_intent(intent, request.user_context, request.conversation_state, request.input, testing=testing)

            else:
                # --- Standard Flow: No Pending Action ---
                # STAGE 1: CLASSIFY INTENT
                intent_name = await self._classify_intent(request.input, chat_history)
                print(f"\n--- 🧠 AI Orchestrator ---")
                print(f"1. CLASSIFIER identified intent as: {intent_name}")

                if intent_name == 'general_chat':
                    # Inject a more specific prompt for general chat to establish personality
                    general_chat_prompt = ChatPromptTemplate.from_messages([
                        ("system", 
                         "You are Minus AI, a helpful and friendly assistant. Your purpose is to assist users with their tasks within this application. "
                         "If you are asked to introduce yourself, explain that you are Minus AI, and you can help with things like managing emails, documents, and calendar events. Keep your introduction brief and concise. "
                         "If you don't understand a user's request, politely say so and ask them to rephrase it. "
                         "You can use markdown for formatting."),
                        ("placeholder", "{chat_history}"),
                        ("human", "{input}")
                    ])
                    chain = general_chat_prompt | self.chat_llm
                    final_response = await chain.ainvoke({"input": request.input, "chat_history": chat_history})
                    return {"type": "text", "response": final_response.content, "state": request.conversation_state.dict()}

                # STAGE 2: EXTRACT DETAILS
                intent = await self._extract_details(intent_name, request.input, chat_history)
                print(f"2. EXTRACTOR populated details: {intent.dict(exclude_none=True)}")

                # STAGE 3: EXECUTE LOGIC
                print("3. EXECUTING intent handler...")
                handler_map = {
                    'find_event': self._handle_find_event_intent,
                    'list_events': self._handle_list_events_intent,
                    'edit_event': self._handle_edit_intent,
                    'create_event': self._handle_create_intent,
                    'list_emails': self._handle_list_emails_intent,
                    'find_email': self._handle_find_email_intent,
                    'compose_email': self._handle_compose_email_intent,
                    'reply_to_email': self._handle_reply_to_email_intent,
                    'send_email_draft': self._handle_send_email_draft_intent,
                    'refine_email_draft': self._handle_refine_email_draft_intent,
                    'cancel_email_draft': self._handle_cancel_email_draft_intent,
                    'find_telegram_chat': self._handle_find_telegram_chat_intent,
                    'summarize_telegram_chat': self._handle_summarize_telegram_chat_intent,
                    'reply_to_telegram': self._handle_reply_to_telegram_intent,
                    'send_telegram_draft': self._handle_send_telegram_draft_intent,
                    'refine_telegram_draft': self._handle_refine_telegram_draft_intent,
                    'get_latest_telegram_message': self._handle_get_latest_telegram_message_intent,
                    'summarize_all_unread_telegram': self._handle_summarize_all_unread_telegram_intent,
                    'list_documents': self._handle_list_documents_intent,
                    'open_document': self._handle_open_document_intent,
                    'close_document': self._handle_close_document_intent,
                    'summarize_document': self._handle_summarize_document_intent,
                    'create_document': self._handle_create_document_intent,
                    'edit_document': self._handle_edit_document_intent,
                    'apply_suggestion': self._handle_apply_suggestion_intent,
                    'reject_suggestion': self._handle_reject_suggestion_intent,
                }
                handler = handler_map.get(intent.intent)
                
                # Special condition for 'apply_suggestion' to prevent misuse
                if intent.intent == 'apply_suggestion' and not state.last_suggestion_id:
                    response = {"response": "I don't have a suggestion to apply. Please make an edit first.", "state": state.dict()}
                elif handler:
                    response = await handler(intent, request.user_context, request.conversation_state, request.input, testing=testing)
                else: 
                    # Fallback for unhandled intents
                    final_response = await self.chat_llm.ainvoke(request.input)
                    response = {"response": final_response.content, "state": request.conversation_state.dict()}

            print(f"4. FINAL State: {response.get('state')}")
            print("---------------------------\n")

            # Handle multi-part responses
            if response.get("type") == "telegram_draft":
                 return {
                    "type": "telegram_draft",
                    "details": response["details"],
                    "response": response["response"],
                    "state": response["state"]
                }

            return {"type": "text", **response}

        except Exception as e:
            logging.error(f"Error in process_message: {e}", exc_info=True)
            return {"type": "error", "response": "Sorry, I encountered an internal error."}

# --- Singleton Instantiation ---
ai_orchestrator = AIOrchestratorService()

def get_orchestrator_service():
    return ai_orchestrator 