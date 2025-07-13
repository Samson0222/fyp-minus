import os
import logging
from typing import Dict, Any, List, Optional, Literal
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
from app.models.user_context import UserContext
from app.models.conversation_state import ConversationState
from app.models.intent import Intent
from app.services.gmail_service import GmailService

# Pydantic Models for the new two-stage router
class _IntentClassification(BaseModel):
    """The classified high-level intent of the user."""
    intent: Literal[
        'create_event', 'edit_event', 'find_event', 'list_events',
        'list_emails', 'find_email', 'compose_email', 'reply_to_email', 'send_email_draft', 'refine_email_draft', 'cancel_email_draft',
        'general_chat'
    ] = Field(description="The user's single primary goal.")

class Message(BaseModel):
    """A single message in a conversation history."""
    role: str
    content: str

class ChatRequest(BaseModel):
    input: str = Field(..., description="The user's input message.")
    chat_history: List[Message] = Field(default=[], description="The conversation history.")
    user_context: UserContext = Field(description="The user context.")
    conversation_state: ConversationState = Field(default_factory=ConversationState, description="The state of the current conversation.")

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

    def _prepare_chat_history(self, conversation_history: List['Message']) -> List[BaseMessage]:
        return [HumanMessage(content=msg.content) if msg.role.lower() == 'user' else AIMessage(content=msg.content) for msg in conversation_history]

    # --- ROUTER (NEW TWO-STAGE IMPLEMENTATION) ---
    async def _classify_intent(self, user_input: str, chat_history: List[BaseMessage]) -> str:
        """Stage 1: Classify the user's high-level intent."""
        prompt = ChatPromptTemplate.from_messages([
            ("system",
             "You are an expert at classifying user intent. Based on the user's message and the conversation history, "
             "identify the user's primary goal. The goal must be one of: "
             "`create_event`, `edit_event`, `find_event`, `list_events`, "
             "`list_emails`, `find_email`, `compose_email`, `reply_to_email`, `send_email_draft`, `refine_email_draft`, `cancel_email_draft`, or `general_chat`. \n"
             "- A request like 'what's new in my email?' is `list_emails`. \n"
             "- A request like 'find the email from jane' is `find_email`. \n"
             "- A request like 'draft an email to john' is `compose_email`. \n"
             "- A request like 'reply to the last email' is `reply_to_email`. \n"
             "- A request like 'make it more formal' or 'add a sentence' while a draft is being reviewed implies the `refine_email_draft` intent. \n"
             "- A user saying 'send it' or clicking 'send' on a draft review card implies the `send_email_draft` intent. \n"
             "- A user saying 'cancel that' or 'nevermind' while a draft is being reviewed implies the `cancel_email_draft` intent. \n"
             "- A request like 'what's on my calendar?' is `list_events`. \n"
             "- A request like 'find my meeting with bob' is `find_event`. \n"
             "- A request like 'when is my latest dental appointment?' is `find_event`."),
            ("placeholder", "{chat_history}"),
            ("human", "{input}")
        ])
        structured_llm = self.router_llm.with_structured_output(_IntentClassification)
        chain = prompt | structured_llm
        result = await chain.ainvoke({"input": user_input, "chat_history": chat_history})
        return result.intent

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
            'cancel_email_draft': (
                "The user wants to cancel and delete the current email draft. They might say 'cancel it', 'stop', or 'nevermind'. "
                "No parameters are needed."
            )
        }
        
        prompt_template = prompts.get(intent_name)
        if not prompt_template: # Should not happen if classified correctly
            return Intent(intent=intent_name)

        prompt = ChatPromptTemplate.from_messages([
            ("system", prompt_template),
            ("placeholder", "{chat_history}"),
            ("human", "{input}")
        ])
        structured_llm = self.router_llm.with_structured_output(Intent)
        chain = prompt | structured_llm
        # We need to manually set the intent on the result as the extractor doesn't know about it.
        extracted_data = await chain.ainvoke({"input": user_input, "chat_history": chat_history})
        if extracted_data:
        extracted_data.intent = intent_name
        return extracted_data
        
        # If the extractor returns nothing, return a base intent object to avoid errors
        return Intent(intent=intent_name)

    def _prune_event_list_for_resolver(self, events: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Prunes the event list to only include fields relevant for AI reasoning."""
        pruned_list = []
        for event in events:
            pruned_list.append({
                "id": event.get("id"),
                "summary": event.get("summary"),
                "description": event.get("description"),
                "start": event.get("start"),
                "end": event.get("end"),
            })
        return pruned_list

    # --- LOGIC HANDLERS ---
    def _get_expanded_date_range(self, start_str: str, end_str: Optional[str]) -> (Optional[datetime], Optional[datetime]):
        """
        Parses start and end date strings, handles special keywords, 
        and returns timezone-aware datetime objects.
        """
        malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
        now = datetime.now(malaysia_tz)
        
        final_end_str = end_str or start_str
        
        start_dt = None
        end_dt = None

        try:
            # Handle special keywords first
            if start_str == 'today':
                start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
            elif start_str == 'one month ago':
                start_dt = (now - timedelta(days=30))
            else:
                start_dt = dateparser.parse(start_str)

            if final_end_str == 'end_of_the_year':
                end_dt = now.replace(month=12, day=31, hour=23, minute=59, second=59, microsecond=0)
            else:
                end_dt = dateparser.parse(final_end_str)

            if not start_dt or not end_dt:
                logging.error(f"Date parsing resulted in None for: {start_str} or {final_end_str}")
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
            logging.error(f"Date calculation failed for '{start_str}' to '{final_end_str}': {e}")
            return None, None

    async def _handle_find_event_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str) -> Dict[str, Any]:
        """
        Finds a specific event by first getting a broad list of potential candidates 
        and then using a second AI call to reason over that list to find the best match.
        """
        if not intent.event_description:
            return {"response": "I can help with that, but I need to know what event you're looking for. For example, 'my meeting with Bob' or 'my dental appointment'.", "state": state.dict()}

        # Step 1: Get a broad list of candidate events
        start_time_str = intent.search_start_date or 'one month ago'
        end_time_str = intent.search_end_date or 'end_of_the_year'
        start_dt, end_dt = self._get_expanded_date_range(start_time_str, end_time_str)

        if not start_dt or not end_dt:
            return {"response": "Sorry, I had trouble understanding the date range for your search.", "state": state.dict()}

        candidate_events = await get_calendar_events.coroutine(
            start_time=start_dt, end_time=end_dt, user_context=user_context
        )

        if isinstance(candidate_events, dict) and "error" in candidate_events:
            return {"response": candidate_events["error"], "state": state.dict()}
        if not candidate_events:
            return {"response": f"I couldn't find any events at all in the timeframe from {start_time_str} to {end_time_str}.", "state": state.dict()}

        # Prune the list to make it easier for the AI to reason over
        pruned_candidates = self._prune_event_list_for_resolver(candidate_events)
        print(f"DEBUG: Pruned candidate events for resolver: {pruned_candidates}")

        # Step 2: Use a resolver LLM to reason over the list of candidates
        resolver_prompt = ChatPromptTemplate.from_messages([
            ("system", 
             "You are a reasoning engine. Below is a user's query and a list of JSON objects representing their calendar events. "
             "Your task is to analyze the query and identify the single event from the list that best matches the user's request. "
             "Consider the event summary, description, and any relative terms in the query like 'latest', 'first', or 'next'. "
             "Respond ONLY with the single best matching event object, or null if no single event is a clear match."),
            ("human", "User Query: {user_input}\n\nEvent List:\n{event_list}")
        ])
        structured_resolver_llm = self.chat_llm.with_structured_output(_EventResolverResponse)
        resolver_chain = resolver_prompt | structured_resolver_llm
        
        resolver_result = await resolver_chain.ainvoke({
            "user_input": user_input,
            "event_list": str(pruned_candidates)
        })

        best_match = resolver_result.matched_event

        # Step 3: Act on the resolved event
        if best_match:
            state.last_event_id = best_match.get('id')
            response_prompt_text = f"I found this event: {best_match}. Please summarize it for the user in a helpful way, directly answering their original question: '{user_input}'"
            final_response = await self.chat_llm.ainvoke(response_prompt_text)
            return {"response": final_response.content, "state": state.dict()}
        else:
            return {"response": f"I found a few events, but couldn't determine which one best matched your request: '{user_input}'. Could you be more specific?", "state": state.dict()}


    async def _handle_list_events_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str) -> Dict[str, Any]:
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

    async def _handle_create_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str) -> Dict[str, Any]:
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

    async def _handle_edit_intent(self, intent: Intent, user_context: UserContext, state: ConversationState, user_input: str) -> Dict[str, Any]:
        event_id_to_edit = state.last_event_id

        if not event_id_to_edit and intent.event_description:
            print(f"No event ID in state. Searching for event matching: '{intent.event_description}'")
            today = datetime.now(pytz.timezone('Asia/Kuala_Lumpur'))
            start_of_month = today.replace(day=1, hour=0, minute=0, second=0)
            end_of_month = (start_of_month + timedelta(days=32)).replace(day=1, hour=0, minute=0, second=0) - timedelta(seconds=1)

            potential_events = await get_calendar_events.coroutine(
                start_time=start_of_month.isoformat(), end_time=end_of_month.isoformat(), user_context=user_context
            )
            
            if isinstance(potential_events, dict) and "error" in potential_events:
                return {"response": potential_events["error"], "state": state.dict()}

            if potential_events:
                matching_events = [e for e in potential_events if intent.event_description.lower() in e.get('summary', '').lower()]
                if len(matching_events) == 1:
                    event_id_to_edit = matching_events[0]['id']
                    state.last_event_id = event_id_to_edit
                elif len(matching_events) > 1:
                    event_summaries = [f"'{e['summary']}' on {e['start'].get('dateTime', e['start'].get('date'))}" for e in matching_events]
                    return {"response": "I found a few events that could match: \n- " + "\n- ".join(event_summaries), "state": state.dict()}
        
        if not event_id_to_edit:
            return {"response": "I'm not sure which event you want to edit. Please specify which event.", "state": state.dict()}

        result = await edit_calendar_event.coroutine(
            event_id=event_id_to_edit,
            summary=intent.summary,
            description=intent.description,
            start_time=intent.start_time,
            end_time=intent.end_time,
            user_context=user_context
        )
        
        if isinstance(result, dict) and "error" in result:
            return {"response": result["error"], "state": state.dict()}
        
        if result.get("status") == "event_updated":
            state.last_event_id = result.get("details", {}).get("event_id")
            return {"response": "Done. I've updated the event.", "state": state.dict()}
        else:
            error_message = result.get("error", "Sorry, I couldn't update the event. Please try again.")
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
        if not intent.query:
            print("LOG: Intent has no query. Aborting.")
            return {"response": "I can help find an email, but I need to know what to search for. For example, 'the email from my manager' or 'the email about the quarterly report'.", "state": state.dict()}

        # Step 1: Fetch a broad list of recent emails (e.g., last 30 days)
        # The user's original query (e.g., 'from:Samson') is still useful for a first-pass filter.
        print(f"LOG: Step 1 - Searching for candidate emails with initial query: '{intent.query}'")
        candidate_emails = await list_emails.coroutine(query=intent.query, max_results=10, user_context=user_context, testing=testing) # Increased max_results

        if not candidate_emails:
            print("LOG: list_emails tool returned no results.")
            return {"response": f"I couldn't find any emails matching your search: '{intent.query}'. You could try being less specific to see more results.", "state": state.dict()}

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
            return {"response": f"I found a few emails matching '{intent.query}', but I'm not sure which one you meant. Here are the top results:\n{options_list}\n\nCould you be more specific?", "state": state.dict()}

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


    # --- MAIN ENTRY POINT ---
    async def process_message(self, request: ChatRequest, testing: bool = False) -> Dict[str, Any]:
        chat_history = self._prepare_chat_history(request.chat_history)
        print(f"\n--- New Request ---")
        print(f"User Input: {request.input}")
        print(f"Initial State: {request.conversation_state.dict()}")

        try:
            # STAGE 1: CLASSIFY INTENT
            intent_name = await self._classify_intent(request.input, chat_history)
            print(f"CLASSIFIER identified intent as: {intent_name}")

            if intent_name == 'general_chat':
                final_response = await self.chat_llm.ainvoke(request.input)
                return {"type": "text", "response": final_response.content, "state": request.conversation_state.dict()}

            # STAGE 2: EXTRACT DETAILS
            intent = await self._extract_details(intent_name, request.input, chat_history)
            print(f"EXTRACTOR populated details: {intent.dict(exclude_none=True)}")

            # STAGE 3: EXECUTE LOGIC
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
            }

            handler = handler_map.get(intent.intent)
            
            if handler:
                response = await handler(intent, request.user_context, request.conversation_state, request.input, testing=testing)
            else: 
                # Fallback for unhandled intents
                final_response = await self.chat_llm.ainvoke(request.input)
                response = {"response": final_response.content, "state": request.conversation_state.dict()}
            
            print(f"Final State: {response.get('state')}")
            return {"type": "text", **response}

        except Exception as e:
            logging.error(f"Error in process_message: {e}", exc_info=True)
            return {"type": "error", "response": "Sorry, I encountered an internal error."}

# --- Singleton Instantiation ---
ai_orchestrator = AIOrchestratorService()

def get_orchestrator_service():
    return ai_orchestrator 