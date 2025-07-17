import datetime
import pytz
import dateparser
import asyncio
from typing import List, Optional, Dict, Any, Union
from langchain.tools import tool
from pydantic import BaseModel, Field

# Import the new UserContext and the service
from app.models.user_context import UserContext
from app.services.google_calendar_service import GoogleCalendarService

def _normalize_time_string(time_str: Optional[str]) -> Optional[str]:
    """Replaces common separators like '.' with ':' to help the parser."""
    if not time_str:
        return None
    # A simple heuristic: if a dot is likely used as a time separator, replace it.
    if '.' in time_str and ('am' in time_str.lower() or 'pm' in time_str.lower()):
        return time_str.replace('.', ':', 1)
    return time_str

class CalendarEventInput(BaseModel):
    """Input for creating a flexible calendar event."""
    summary: str = Field(description="The summary or title of the event.")
    start_time: str = Field(description="The start time or date for the event, in natural language (e.g., 'tomorrow at 5pm' or 'next Tuesday').")
    end_time: Optional[str] = Field(default=None, description="Optional end time/date in natural language. If not provided for a timed event, it defaults to a 1-hour duration.")
    attendees: List[str] = Field(default_factory=list, description="An optional list of attendee email addresses.")
    description: Optional[str] = Field(default=None, description="An optional detailed description for the event.")

class EditCalendarEventInput(BaseModel):
    """Input for editing an existing calendar event."""
    event_id: str = Field(description="The unique ID of the event to edit.")
    summary: Optional[str] = Field(default=None, description="The new summary or title for the event.")
    start_time: Optional[str] = Field(default=None, description="The new start time or date in natural language (e.g., 'tomorrow at 5pm').")
    end_time: Optional[str] = Field(default=None, description="The new end time or date in natural language.")
    attendees_to_add: List[str] = Field(default_factory=list, description="A list of new attendee emails to add.")
    attendees_to_remove: List[str] = Field(default_factory=list, description="A list of attendee emails to remove.")
    description: Optional[str] = Field(default=None, description="The new detailed description for the event.")

class GetEventsInput(BaseModel):
    start_time: datetime.datetime = Field(description="The start of the time range in ISO 8601 format.")
    end_time: datetime.datetime = Field(description="The end of the time range in ISO 8601 format.")


@tool("get_calendar_events", args_schema=GetEventsInput)
async def get_calendar_events(start_time: datetime.datetime, end_time: datetime.datetime, **kwargs) -> List[Dict[str, Any]]:
    """
    Retrieves Google Calendar events for a specified user within a given datetime range.
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot retrieve calendar events."}

    # Convert datetimes to ISO strings for use in API calls and logging
    start_time_iso = start_time.isoformat()
    end_time_iso = end_time.isoformat()

    print(f"Tool 'get_calendar_events' called for user '{user_context.user_id}' with range: {start_time_iso} to {end_time_iso}")
    
    calendar_service = GoogleCalendarService()
    
    # Use asyncio.to_thread to run the synchronous get_events method in a separate thread
    events = await asyncio.to_thread(
        calendar_service.get_events,
        user_id=user_context.user_id,
        time_min=start_time_iso,
        time_max=end_time_iso
    )
    
    # Prune the events to return only the most useful fields to the AI
    pruned_events = []
    if isinstance(events, list):
        for event in events:
            pruned_events.append({
                "id": event.get("id"),
                "summary": event.get("summary"),
                "start": event.get("start"),
                "end": event.get("end"),
                "description": event.get("description")
            })
            
    return pruned_events


@tool("create_calendar_event_draft", args_schema=CalendarEventInput)
async def create_calendar_event_draft(
    summary: str,
    start_time: str,
    end_time: Optional[str] = None,
    attendees: Optional[List[str]] = None,
    description: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Creates a new Google Calendar event from natural language. Handles both timed and all-day events.
    If only a start time is given for a timed event, it defaults to a 1-hour duration.
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot create calendar event."}

    # --- Validation ---
    if not summary or not summary.strip():
        return {"error": "A summary or title for the event is required."}

    print(f"Tool 'create_calendar_event_draft' called for user '{user_context.user_id}' with summary: '{summary}'")

    # --- Date Parsing Logic ---
    normalized_start_time = _normalize_time_string(start_time)
    normalized_end_time = _normalize_time_string(end_time)

    # Use dateparser to understand natural language dates
    # Settings to prefer future dates, which is common for scheduling
    parser_settings = {'PREFER_DATES_FROM': 'current_period'}
    start_dt = dateparser.parse(normalized_start_time, settings=parser_settings)
    
    if not start_dt:
        return {"error": f"Could not understand the start time: '{start_time}'. Please be more specific."}

    end_dt = None
    if normalized_end_time:
        end_dt = dateparser.parse(normalized_end_time, settings=parser_settings)
        if not end_dt:
            return {"error": f"Could not understand the end time: '{end_time}'. Please be more specific."}

    event_data = {'summary': summary}

    # Add optional fields if they are provided
    if description:
        event_data['description'] = description
    if attendees:
        event_data['attendees'] = [{'email': email} for email in attendees]

    # --- Logic to handle timed vs. all-day events ---
    # A bit of a heuristic: if the user input doesn't contain 'at', 'hour', 'minute', 'pm', 'am', assume it's an all-day event
    is_timed_event = any(kw in start_time.lower() for kw in ['at', 'h', ':', 'am', 'pm', 'hour', 'minute'])

    malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
    
    if is_timed_event:
        # If the parsed datetime is naive (no tzinfo), make it aware
        if start_dt.tzinfo is None:
            start_dt = malaysia_tz.localize(start_dt)

        # Default to 1-hour duration if end_time is not provided or invalid
        if not end_dt:
            end_dt = start_dt + datetime.timedelta(hours=1)
        
        # Also make the end_time aware if it's naive
        if end_dt.tzinfo is None:
            end_dt = malaysia_tz.localize(end_dt)

        event_data['start'] = {'dateTime': start_dt.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}
        event_data['end'] = {'dateTime': end_dt.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}
    
    else: # All-day event
        start_date = start_dt.date()
        
        # Default to a single-day event if end_time is not provided or is on the same day
        if not end_dt or end_dt.date() <= start_date:
            end_date = start_date + datetime.timedelta(days=1)
        else:
            end_date = end_dt.date()
        
        event_data['start'] = {'date': start_date.isoformat()}
        event_data['end'] = {'date': end_date.isoformat()}
    # --- End of logic ---

    calendar_service = GoogleCalendarService()
    created_event = calendar_service.create_event_from_dict(
        user_id=user_context.user_id,
        event_data=event_data
    )

    if not created_event:
        return {"error": "Failed to create the calendar event. Please check permissions or re-authenticate."}

    return {
        "status": "event_created",
        "details": {
            "summary": created_event.get('summary'),
            "start": created_event.get('start', {}),
            "end": created_event.get('end', {}),
            "attendees": [att.get('email') for att in created_event.get('attendees', [])],
            "event_id": created_event.get('id'),
            "html_link": created_event.get('htmlLink')
        },
        "confirmation_message": "The event has been successfully scheduled in your calendar."
    }

@tool(args_schema=EditCalendarEventInput)
async def edit_calendar_event(
    event_id: str,
    new_summary: Optional[str] = None,
    new_start_time: Optional[str] = None,
    new_end_time: Optional[str] = None,
    new_description: Optional[str] = None,
    user_context: UserContext = None
) -> Dict[str, Any]:
    """
    Updates an existing calendar event with new details.
    You must provide the event_id of the event to update.
    You can provide one or more fields to update: new_summary, new_start_time, new_end_time, or new_description.
    """
    if not user_context:
        return {"error": "User context is missing."}

    calendar_service = GoogleCalendarService()

    # First, get the existing event to calculate duration and apply changes
    existing_event = calendar_service.get_event(user_id=user_context.user_id, event_id=event_id)
    if not existing_event:
        return {"error": f"Could not find the event with ID {event_id} to update."}

    # --- Time Parsing and Duration Logic ---
    malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
    parser_settings = {'PREFER_DATES_FROM': 'future', 'TIMEZONE': 'Asia/Kuala_Lumpur'}
    original_duration = None
    
    if 'dateTime' in existing_event.get('start', {}):
        start_dt = datetime.datetime.fromisoformat(existing_event['start']['dateTime'])
        end_dt = datetime.datetime.fromisoformat(existing_event['end']['dateTime'])
        original_duration = end_dt - start_dt

    updates = {}
    if new_summary:
        updates['summary'] = new_summary
    if new_description:
        updates['description'] = new_description

    new_start_dt_obj = None
    if new_start_time:
        new_start_dt_obj = dateparser.parse(new_start_time, settings=parser_settings)
        if not new_start_dt_obj:
            return {"error": f"I couldn't understand the start time '{new_start_time}'."}
        if new_start_dt_obj.tzinfo is None:
            new_start_dt_obj = malaysia_tz.localize(new_start_dt_obj)
        updates['start'] = {'dateTime': new_start_dt_obj.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}

    if new_end_time:
        new_end_dt_obj = dateparser.parse(new_end_time, settings=parser_settings)
        if not new_end_dt_obj:
            return {"error": f"I couldn't understand the end time '{new_end_time}'."}
        if new_end_dt_obj.tzinfo is None:
            new_end_dt_obj = malaysia_tz.localize(new_end_dt_obj)
        updates['end'] = {'dateTime': new_end_dt_obj.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}
    
    # If only start time was changed, preserve original duration
    elif new_start_dt_obj and original_duration:
        new_end_dt_obj = new_start_dt_obj + original_duration
        updates['end'] = {'dateTime': new_end_dt_obj.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}

    if not updates:
        return {"error": "No valid update information was provided."}

    updated_event = calendar_service.update_event(
        user_id=user_context.user_id,
        event_id=event_id,
        updates=updates
    )

    if "error" in updated_event:
        return updated_event
    
    return {
        "status": "event_updated",
        "confirmation_message": "Done. I've updated the event.",
        "details": {"event_id": updated_event.get("id")}
    }