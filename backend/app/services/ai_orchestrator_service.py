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
from app.models.user_context import UserContext
from app.models.conversation_state import ConversationState
from app.models.intent import Intent

# Pydantic Models for the new two-stage router
class _IntentClassification(BaseModel):
    """The classified high-level intent of the user."""
    intent: Literal['create_event', 'edit_event', 'find_event', 'list_events', 'general_chat'] = Field(
        description="The user's single primary goal."
    )

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
             "`create_event`, `edit_event`, `find_event`, `list_events`, or `general_chat`. \n"
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
        extracted_data.intent = intent_name
        return extracted_data

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

    # --- MAIN ENTRY POINT ---
    async def process_message(self, request: ChatRequest) -> Dict[str, Any]:
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
            }

            handler = handler_map.get(intent.intent)
            
            if handler:
                response = await handler(intent, request.user_context, request.conversation_state, request.input)
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