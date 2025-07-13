import datetime
import pytz
from typing import List, Optional, Dict, Any, Union
from langchain.tools import tool
from pydantic import BaseModel, Field

# Import the new UserContext and the service
from app.models.user_context import UserContext
from app.services.google_calendar_service import GoogleCalendarService

class CalendarEventInput(BaseModel):
    """Input for creating a flexible calendar event."""
    summary: str = Field(description="The summary or title of the event.")
    start_time: Union[datetime.datetime, datetime.date] = Field(description="The start time or date for the event.")
    end_time: Optional[Union[datetime.datetime, datetime.date]] = Field(default=None, description="Optional end time/date. Defaults to a 1-hour duration for timed events or a single day for all-day events.")
    attendees: List[str] = Field(default_factory=list, description="An optional list of attendee email addresses.")
    description: Optional[str] = Field(default=None, description="An optional detailed description for the event.")

class EditCalendarEventInput(BaseModel):
    """Input for editing an existing calendar event."""
    event_id: str = Field(description="The unique ID of the event to edit.")
    summary: Optional[str] = Field(default=None, description="The new summary or title for the event.")
    start_time: Optional[Union[datetime.datetime, datetime.date]] = Field(default=None, description="The new start time or date.")
    end_time: Optional[Union[datetime.datetime, datetime.date]] = Field(default=None, description="The new end time or date.")
    attendees_to_add: List[str] = Field(default_factory=list, description="A list of new attendee emails to add.")
    attendees_to_remove: List[str] = Field(default_factory=list, description="A list of attendee emails to remove.")
    description: Optional[str] = Field(default=None, description="The new detailed description for the event.")

class GetEventsInput(BaseModel):
    start_time: datetime.datetime = Field(description="The start date and time for the event range in ISO 8601 format.")
    end_time: datetime.datetime = Field(description="The end date and time for the event range in ISO 8601 format.")


@tool("get_calendar_events", args_schema=GetEventsInput)
async def get_calendar_events(start_time: datetime.datetime, end_time: datetime.datetime, **kwargs) -> List[Dict[str, Any]]:
    """
    Retrieves Google Calendar events for a specified user within a given datetime range.
    Use this tool to answer any questions about what is on a user's calendar.

    - You MUST convert any relative time phrases into specific start and end datetimes.
    - Examples of relative time phrases you must handle:
      - "today": from the start of the current day to the end of the current day.
      - "next hour": from the current time to one hour from the current time.
      - "this afternoon": from 12:00 PM to 5:00 PM on the current day.
      - "tomorrow at 3pm": A one-hour event starting at 3:00 PM tomorrow.
      - "this weekend": from Friday at 5:00 PM to Sunday at 11:59 PM.
    - All datetimes must be in ISO 8601 format (e.g., YYYY-MM-DDTHH:MM:SS).
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot retrieve calendar events."}

    print(f"Tool 'get_calendar_events' called for user '{user_context.user_id}' with range: {start_time} to {end_time}")
    
    # Ensure the datetime objects are timezone-aware (UTC) before formatting.
    # This is required for the Google Calendar API.
    start_time_aware = start_time.replace(tzinfo=datetime.timezone.utc)
    end_time_aware = end_time.replace(tzinfo=datetime.timezone.utc)

    calendar_service = GoogleCalendarService()
    
    events = calendar_service.get_events(
        user_id=user_context.user_id,
        time_min=start_time_aware.isoformat(),
        time_max=end_time_aware.isoformat()
    )
    
    if events is None:
        return {"error": "Could not retrieve calendar events. The user may need to re-authenticate."}
        
    return events


@tool("create_calendar_event_draft", args_schema=CalendarEventInput)
async def create_calendar_event_draft(
    summary: str,
    start_time: Union[datetime.datetime, datetime.date],
    end_time: Optional[Union[datetime.datetime, datetime.date]] = None,
    attendees: Optional[List[str]] = None,
    description: Optional[str] = None,
    **kwargs
) -> Dict[str, Any]:
    """
    Creates a new Google Calendar event. Handles both timed and all-day events with flexible inputs.
    If only a start time is given for a timed event, it defaults to a 1-hour duration.
    If only a start date is given, it creates an all-day event.
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot create calendar event."}

    print(f"Tool 'create_calendar_event_draft' called for user '{user_context.user_id}' with summary: '{summary}'")

    event_data = {'summary': summary}

    # Add optional fields if they are provided
    if description:
        event_data['description'] = description
    if attendees:
        event_data['attendees'] = [{'email': email} for email in attendees]

    # --- Logic to handle timed vs. all-day events ---
    if isinstance(start_time, datetime.datetime):
        # Set the timezone for the event
        malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')

        # If the datetime object is naive (no tzinfo), make it aware
        if start_time.tzinfo is None:
            start_time = malaysia_tz.localize(start_time)

        # Default to 1-hour duration if end_time is not provided
        if end_time is None:
            end_time = start_time + datetime.timedelta(hours=1)
        
        # Also make the end_time aware if it's naive
        if isinstance(end_time, datetime.datetime) and end_time.tzinfo is None:
            end_time = malaysia_tz.localize(end_time)

        event_data['start'] = {'dateTime': start_time.isoformat()}
        event_data['end'] = {'dateTime': end_time.isoformat()}
    
    elif isinstance(start_time, datetime.date):
        # Default to a single-day event if end_time is not provided
        if end_time is None or end_time <= start_time:
            end_time = start_time + datetime.timedelta(days=1)
        
        event_data['start'] = {'date': start_time.isoformat()}
        event_data['end'] = {'date': end_time.isoformat()}
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
    start_time: Optional[Union[datetime.datetime, datetime.date]] = None,
    end_time: Optional[Union[datetime.datetime, datetime.date]] = None,
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

    # Get the existing event to apply changes
    # NOTE: This assumes your GoogleCalendarService has a `get_event` method.
    existing_event = calendar_service.get_event(user_id=user_context.user_id, event_id=event_id)
    if not existing_event:
        return {"error": f"Event with ID '{event_id}' not found."}

    # Apply updates to the event data
    if summary is not None:
        existing_event['summary'] = summary
    if description is not None:
        existing_event['description'] = description

    malaysia_tz = pytz.timezone('Asia/Kuala_Lumpur')

    if start_time:
        if isinstance(start_time, datetime.datetime):
            if start_time.tzinfo is None:
                start_time = malaysia_tz.localize(start_time)
            existing_event['start'] = {'dateTime': start_time.isoformat()}
        else:
            existing_event['start'] = {'date': start_time.isoformat()}
    
    if end_time:
        if isinstance(end_time, datetime.datetime):
            if end_time.tzinfo is None:
                end_time = malaysia_tz.localize(end_time)
            existing_event['end'] = {'dateTime': end_time.isoformat()}
        else:
            existing_event['end'] = {'date': end_time.isoformat()}

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