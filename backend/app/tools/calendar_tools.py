import datetime
import pytz
import dateparser
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
    start_time: datetime.datetime = Field(description="The start date and time for the event range.")
    end_time: datetime.datetime = Field(description="The end date and time for the event range.")


@tool("get_calendar_events", args_schema=GetEventsInput)
async def get_calendar_events(start_time: datetime.datetime, end_time: datetime.datetime, **kwargs) -> List[Dict[str, Any]]:
    """
    Retrieves Google Calendar events for a specified user within a given datetime range.
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot retrieve calendar events."}

    print(f"Tool 'get_calendar_events' called for user '{user_context.user_id}' with range: {start_time.isoformat()} to {end_time.isoformat()}")
    
    # The datetime objects from the orchestrator are already timezone-aware.
    # We just need to ensure they are formatted correctly for the Google API.
    calendar_service = GoogleCalendarService()
    
    events = calendar_service.get_events(
        user_id=user_context.user_id,
        time_min=start_time.isoformat(),
        time_max=end_time.isoformat()
    )
    
    if events is None:
        return {"error": "Could not retrieve calendar events. The user may need to re-authenticate."}
        
    return events


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

@tool("edit_calendar_event", args_schema=EditCalendarEventInput)
async def edit_calendar_event(
    event_id: str,
    summary: Optional[str] = None,
    start_time: Optional[str] = None,
    end_time: Optional[str] = None,
    attendees_to_add: Optional[List[str]] = None,
    attendees_to_remove: Optional[List[str]] = None,
    description: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Edits an existing Google Calendar event. You must provide the event_id.
    Only the fields you want to change need to be provided.
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot edit the event."}

    calendar_service = GoogleCalendarService()

    existing_event = calendar_service.get_event(user_id=user_context.user_id, event_id=event_id)
    if not existing_event:
        return {"error": f"Event with ID '{event_id}' not found."}

    # --- Step 1: Cache the original duration for timed events ---
    original_duration = None
    is_timed_event = 'dateTime' in existing_event.get('start', {})
    if is_timed_event:
        try:
            start_str = existing_event['start']['dateTime']
            end_str = existing_event['end']['dateTime']
            original_duration = datetime.datetime.fromisoformat(end_str) - datetime.datetime.fromisoformat(start_str)
        except (KeyError, ValueError) as e:
            print(f"Warning: Could not calculate original event duration: {e}")

    # --- Step 2: Apply direct updates (summary, description) ---
    if summary is not None:
        existing_event['summary'] = summary
    if description is not None:
        existing_event['description'] = description

    malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')
    parser_settings = {'PREFER_DATES_FROM': 'future'}
    new_start_dt = None

    # --- Step 3: Apply date/time updates from user input ---
    if start_time:
        normalized_start_time = _normalize_time_string(start_time)
        start_dt = dateparser.parse(normalized_start_time, settings=parser_settings)
        if not start_dt:
            return {"error": f"Could not understand the start time: '{start_time}'."}
        
        if is_timed_event:
            if start_dt.tzinfo is None:
                start_dt = malaysia_tz.localize(start_dt)
            existing_event['start'] = {'dateTime': start_dt.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}
            new_start_dt = start_dt # Keep track of the new datetime object
        else: # all-day event
            existing_event['start'] = {'date': start_dt.date().isoformat()}

    if end_time:
        normalized_end_time = _normalize_time_string(end_time)
        end_dt = dateparser.parse(normalized_end_time, settings=parser_settings)
        if not end_dt:
             return {"error": f"Could not understand the end time: '{end_time}'."}

        if is_timed_event:
            if end_dt.tzinfo is None:
                end_dt = malaysia_tz.localize(end_dt)
            existing_event['end'] = {'dateTime': end_dt.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}
        else:
            end_date = end_dt.date()
            if not start_time:
                original_start_date = datetime.date.fromisoformat(existing_event['start']['date'])
                if end_date < original_start_date:
                    end_date = original_start_date
            existing_event['end'] = {'date': (end_date + datetime.timedelta(days=1)).isoformat()}

    # --- Step 4: If only start time was changed, preserve the original duration ---
    elif start_time and new_start_dt and original_duration is not None:
        new_end_dt = new_start_dt + original_duration
        existing_event['end'] = {'dateTime': new_end_dt.isoformat(), 'timeZone': 'Asia/Kuala_Lumpur'}

    # Update attendees
    if attendees_to_add or attendees_to_remove:
        current_attendees = existing_event.get('attendees', [])
        if attendees_to_remove:
            current_attendees = [p for p in current_attendees if p.get('email') not in attendees_to_remove]
        if attendees_to_add:
            for email in attendees_to_add:
                current_attendees.append({'email': email})
        existing_event['attendees'] = current_attendees
    
    # NOTE: This assumes your GoogleCalendarService has an `update_event` method.
    updated_event = calendar_service.update_event(
        user_id=user_context.user_id,
        event_id=event_id,
        event_data=existing_event
    )

    if not updated_event:
        return {"error": "Failed to update the calendar event."}

    return {
        "status": "event_updated",
        "details": {
            "summary": updated_event.get('summary'),
            "start": updated_event.get('start', {}),
            "end": updated_event.get('end', {}),
            "html_link": updated_event.get('htmlLink'),
            "event_id": updated_event.get('id')
        }
    }