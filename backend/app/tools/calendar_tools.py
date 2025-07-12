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
    start_date: str = Field(description="The start date for the range in ISO format (e.g., YYYY-MM-DD).")
    end_date: str = Field(description="The end date for the range in ISO format (e.g., YYYY-MM-DD).")


@tool("get_calendar_events", args_schema=GetEventsInput)
async def get_calendar_events(start_date: str, end_date: str, user_context: UserContext) -> List[Dict[str, Any]]:
    """
    Retrieves Google Calendar events for a specified user within a given date range.
    Use this tool to answer any questions about what is on a user's calendar,
    such as "what's on my calendar today?" or "do I have any events next week?".

    - When a user asks for events for "today", you must calculate the current date
      and provide it as both the start_date and end_date.
    - The user's query may be relative (e.g., "tomorrow", "next Tuesday"). You
      must convert these relative terms to absolute dates in ISO 8601 format.
    - All dates must be in ISO 8601 format (YYYY-MM-DD).
    """
    print(f"Tool 'get_calendar_events' called for user '{user_context.user_id}' with range: {start_date} to {end_date}")
    
    calendar_service = GoogleCalendarService()
    # The get_events method on the service is not async, so we call it directly.
    # In a real-world scenario with I/O, you would run this in a thread pool.
    events = calendar_service.get_events(
        user_id=user_context.user_id,
        time_min=start_date,
        time_max=end_date
    )
    
    if events is None:
        return {"error": "Could not retrieve calendar events. The user may need to re-authenticate."}
        
    return events


@tool("create_calendar_event_draft", args_schema=CalendarEventInput)
async def create_calendar_event_draft(summary: str, start_time: datetime.datetime, end_time: datetime.datetime, user_context: UserContext, attendees: List[str]) -> Dict[str, Any]:
    """
    Creates a new calendar event for the specified user.
    """
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