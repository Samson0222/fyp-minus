import datetime
from typing import List, Optional, Dict, Any
from langchain.tools import tool
from pydantic import BaseModel, Field

# Import the new UserContext and the service
from app.models.user_context import UserContext
from app.services.google_calendar_service import GoogleCalendarService

class CalendarEventInput(BaseModel):
    summary: str = Field(description="The summary or title of the calendar event.")
    start_time: datetime.datetime = Field(description="The start time of the event in ISO format.")
    end_time: datetime.datetime = Field(description="The end time of the event in ISO format.")
    attendees: List[str] = Field(default_factory=list, description="A list of attendee email addresses.")

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
async def create_calendar_event_draft(summary: str, start_time: datetime.datetime, end_time: datetime.datetime, attendees: List[str], **kwargs) -> Dict[str, Any]:
    """
    Creates a new calendar event for the specified user.
    """
    user_context = kwargs.get("user_context")
    if not user_context:
        return {"error": "User context is missing, cannot create calendar event."}

    print(f"Tool 'create_calendar_event_draft' called for user '{user_context.user_id}' with summary: '{summary}'")
    
    calendar_service = GoogleCalendarService()
    
    event_data = {
        'summary': summary,
        'start': {'dateTime': start_time.isoformat(), 'timeZone': 'UTC'},
        'end': {'dateTime': end_time.isoformat(), 'timeZone': 'UTC'},
        'attendees': [{'email': email} for email in attendees] if attendees else [],
    }
    
    # The create_event_from_dict method is not async
    created_event = calendar_service.create_event_from_dict(
        user_id=user_context.user_id,
        event_data=event_data
    )

    if not created_event:
        return {"error": "Failed to create the calendar event. The user may need to re-authenticate or check their calendar permissions."}

    return {
        "status": "event_created",
        "details": {
            "summary": created_event.get('summary'),
            "start": created_event.get('start', {}).get('dateTime'),
            "end": created_event.get('end', {}).get('dateTime'),
            "attendees": [att['email'] for att in created_event.get('attendees', [])],
            "event_id": created_event.get('id'),
            "html_link": created_event.get('htmlLink')
        },
        "confirmation_message": "The event has been successfully scheduled in your calendar."
    } 