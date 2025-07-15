from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import logging
import re

from app.services.google_calendar_service import GoogleCalendarService
from app.services.calendar_service import CalendarService
from app.core.database import get_database

# Dependency to get current user (simplified demo)
async def get_current_user(authorization: Optional[str] = None):
    """Stub user extraction – replace with real auth if needed."""
    return {"user_id": "cbede3b0-2f68-47df-9c26-09a46e588567", "email": "test@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])


# -----------------------
# Pydantic models
# -----------------------
class CreateEventRequest(BaseModel):
    summary: str
    start: str
    end: Optional[str] = None
    all_day: bool = False
    timezone: Optional[str] = "UTC"
    attendees: Optional[List[str]] = []
    description: Optional[str] = ""

class AvailabilityRequest(BaseModel):
    start: datetime
    end: datetime
    timezone: Optional[str] = "UTC"

class GoogleCalendarEvent(BaseModel):
    """Standardized Google Calendar event for frontend consumption."""
    id: str
    summary: str
    description: Optional[str] = None
    start: datetime
    end: Optional[datetime] = None
    all_day: bool
    location: Optional[str] = None
    attendees: List[str] = []
    creator_email: Optional[str] = None
    html_link: Optional[str] = None
    status: str = "confirmed"
    source: str = "google_calendar"

class VoiceCommandRequest(BaseModel):
    command: str
    context: Optional[dict] = None


# -----------------------
# Endpoints
# -----------------------
@router.get("/today")
async def get_today_schedule(user = Depends(get_current_user)):
    """Return today events in voice-friendly format."""
    try:
        gcal_service = GoogleCalendarService()
        service = gcal_service._get_service(user["user_id"])
        if not service:
            raise HTTPException(status_code=401, detail="User not authenticated with Google Calendar.")
        
        # Get today's events
        now = datetime.now(timezone.utc)
        start_of_day = now.replace(hour=0, minute=0, second=0, microsecond=0)
        end_of_day = now.replace(hour=23, minute=59, second=59, microsecond=999999)
        
        events_result = service.events().list(
            calendarId='primary',
            timeMin=start_of_day.isoformat(),
            timeMax=end_of_day.isoformat(),
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        events = events_result.get('items', [])
        return {"events": events, "count": len(events)}
        
    except Exception as e:
        logger.error(f"Failed to get today's schedule: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/create-event")
async def create_event(req: CreateEventRequest, user = Depends(get_current_user)):
    try:
        gcal_service = GoogleCalendarService()
        service = gcal_service._get_service(user["user_id"])
        if not service:
            raise HTTPException(status_code=401, detail="User not authenticated with Google Calendar.")

        event_body = {
            "summary": req.summary,
            "description": req.description,
            "attendees": [{"email": email} for email in req.attendees],
        }

        if req.all_day:
            event_body["start"] = {"date": req.start}
            # For all-day events, the end date is exclusive. If no end is provided, it's a single-day event.
            # Google Calendar UI often sets the end date to the next day.
            event_body["end"] = {"date": req.end if req.end else req.start}
        else:
            if not req.end:
                raise HTTPException(status_code=400, detail="End time is required for timed events.")
            event_body["start"] = {"dateTime": req.start, "timeZone": req.timezone}
            event_body["end"] = {"dateTime": req.end, "timeZone": req.timezone}


        created_event = service.events().insert(calendarId='primary', body=event_body).execute()
        return created_event

    except Exception as e:
        logger.error(f"Calendar create event error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/availability")
async def check_availability(req: AvailabilityRequest, user = Depends(get_current_user)):
    try:
        gcal_service = GoogleCalendarService()
        service = gcal_service._get_service(user["user_id"])
        if not service:
            raise HTTPException(status_code=401, detail="User not authenticated with Google Calendar.")

        body = {
            "timeMin": req.start.isoformat(),
            "timeMax": req.end.isoformat(),
            "timeZone": req.timezone,
            "items": [{"id": "primary"}],
        }
        
        result = service.freebusy().query(body=body).execute()
        return result.get("calendars", {}).get("primary", {})

    except Exception as e:
        logger.error(f"Calendar availability error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/auth-status")
async def calendar_auth_status(user = Depends(get_current_user)):
    """Simple endpoint to verify if Calendar API is authenticated for the user."""
    try:
        gcal_service = GoogleCalendarService()
        service = gcal_service._get_service(user["user_id"])
        authenticated = service is not None
        return {"authenticated": authenticated}
    except Exception as e:
        logger.error(f"Failed to check calendar auth status: {e}")
        return {"authenticated": False}





@router.get("/events", response_model=List[GoogleCalendarEvent])
async def get_google_calendar_events(
    start_date: Optional[str] = Query(None, description="Start date in ISO format (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date in ISO format (YYYY-MM-DD)"),
    max_results: Optional[int] = Query(50, description="Maximum number of events to return"),
    user = Depends(get_current_user)
):
    """
    Fetch events from authenticated user's Google Calendar.
    
    This endpoint fetches real Google Calendar events and formats them 
    for consumption by the frontend calendar component.
    """
    try:
        user_id = user["user_id"]
        gcal_service = GoogleCalendarService()
        service = gcal_service._get_service(user_id)

        if not service:
            raise HTTPException(status_code=401, detail="User not authenticated with Google Calendar.")

        # Parse date range or default to current month
        if start_date and end_date:
            time_min = datetime.fromisoformat(start_date).replace(tzinfo=timezone.utc)
            time_max = datetime.fromisoformat(end_date).replace(tzinfo=timezone.utc)
        else:
            # Default to the entire current year
            now = datetime.now(timezone.utc)
            time_min = now.replace(month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            time_max = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
        
        # Fetch events from Google Calendar
        events_result = service.events().list(
            calendarId='primary',
            timeMin=time_min.isoformat(),
            timeMax=time_max.isoformat(),
            maxResults=max_results,
            singleEvents=True,
            orderBy='startTime'
        ).execute()
        
        raw_events = events_result.get('items', [])
        
        # Convert to standardized format
        formatted_events = []
        for event in raw_events:
            try:
                # Parse start time
                start_info = event.get("start", {})
                if "dateTime" in start_info:
                    start_dt = datetime.fromisoformat(start_info["dateTime"].replace('Z', '+00:00'))
                    all_day = False
                else:
                    # All-day event
                    start_dt = datetime.fromisoformat(start_info.get("date", "")).replace(tzinfo=timezone.utc)
                    all_day = True
                
                # Parse end time
                end_dt = None
                end_info = event.get("end", {})
                if "dateTime" in end_info:
                    end_dt = datetime.fromisoformat(end_info["dateTime"].replace('Z', '+00:00'))
                elif "date" in end_info:
                    end_dt = datetime.fromisoformat(end_info["date"]).replace(tzinfo=timezone.utc)
                
                # Extract attendees
                attendees = []
                for attendee in event.get("attendees", []):
                    if attendee.get("email"):
                        attendees.append(attendee["email"])
                
                # Create standardized event
                formatted_event = GoogleCalendarEvent(
                    id=f"gcal_{event['id']}",  # Prefix to distinguish from local tasks
                    summary=event.get("summary", "Untitled Event"),
                    description=event.get("description"),
                    start=start_dt,
                    end=end_dt,
                    all_day=all_day,
                    location=event.get("location"),
                    attendees=attendees,
                    creator_email=event.get("creator", {}).get("email"),
                    html_link=event.get("htmlLink"),
                    status=event.get("status", "confirmed"),
                    source="google_calendar"
                )
                
                formatted_events.append(formatted_event)
                
            except Exception as parse_error:
                logger.warning(f"Failed to parse Google Calendar event {event.get('id', 'unknown')}: {parse_error}")
                continue
        
        logger.info(f"Fetched {len(formatted_events)} Google Calendar events for user {user['user_id']}")
        return formatted_events
        
    except Exception as e:
        logger.error(f"Failed to fetch Google Calendar events: {e}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to fetch calendar events: {str(e)}"
        ) 
 
 
@router.post("/voice-command")
async def process_calendar_voice_command(
    request: VoiceCommandRequest,
    user = Depends(get_current_user)
):
    """Process voice commands for calendar operations."""
    try:
        user_id = user["user_id"]
        command = request.command.lower()
        
        calendar_service = CalendarService()
        
        # Parse the voice command to extract intent and parameters
        if "today" in command or "schedule" in command:
            command_data = {
                "action": "check_today",
                "params": {},
                "user_id": user_id
            }
        elif "create" in command or "schedule" in command or "remind" in command:
            # Extract event details from the command
            params = _parse_create_event_command(command)
            command_data = {
                "action": "create_event", 
                "params": params,
                "user_id": user_id
            }
        elif "upcoming" in command or "next" in command:
            # Extract number of days if mentioned
            days_match = re.search(r'(\d+)\s*days?', command)
            days = int(days_match.group(1)) if days_match else 7
            command_data = {
                "action": "get_upcoming",
                "params": {"days": days},
                "user_id": user_id
            }
        else:
            # Default to general calendar inquiry
            command_data = {
                "action": "check_today",
                "params": {},
                "user_id": user_id
            }
        
        # Process the command
        result = await calendar_service.process_voice_command(command_data)
        
        return {
            "command_type": "calendar",
            "response": result.get("response", "Command processed."),
            "data": result,
            "success": result.get("success", True)
        }
        
    except Exception as e:
        logger.error(f"Error processing calendar voice command: {e}")
        return {
            "command_type": "error",
            "response": f"Sorry, I encountered an error: {str(e)}",
            "success": False
        }


def _parse_create_event_command(command: str) -> dict:
    """Parse a voice command to extract event creation parameters."""
    params = {}
    
    # Extract title - common patterns
    title_patterns = [
        r'(?:create|schedule|add|remind me to)\s+(?:a\s+)?(?:task|event|meeting|appointment)?\s*(?:to\s+|for\s+)?(.+?)(?:\s+(?:at|on|for|tomorrow|today|next week))',
        r'(?:create|schedule|add|remind me to)\s+(.+?)(?:\s+(?:at|on|for|tomorrow|today|next week))',
        r'(?:create|schedule|add|remind me to)\s+(.+)'
    ]
    
    for pattern in title_patterns:
        match = re.search(pattern, command, re.IGNORECASE)
        if match:
            params['title'] = match.group(1).strip()
            break
    
    if not params.get('title'):
        params['title'] = "New Event"
    
    # Extract time information
    now = datetime.now(timezone.utc)
    
    if "tomorrow" in command:
        start_time = now.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=1)
    elif "today" in command:
        start_time = now.replace(hour=10, minute=0, second=0, microsecond=0)
        if start_time < now:
            start_time = now + timedelta(hours=1)
    elif "next week" in command:
        start_time = now.replace(hour=10, minute=0, second=0, microsecond=0) + timedelta(days=7)
    else:
        # Try to extract specific time
        time_match = re.search(r'(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)', command, re.IGNORECASE)
        if time_match:
            hour = int(time_match.group(1))
            minute = int(time_match.group(2)) if time_match.group(2) else 0
            ampm = time_match.group(3).lower()
            
            if ampm == 'pm' and hour != 12:
                hour += 12
            elif ampm == 'am' and hour == 12:
                hour = 0
                
            start_time = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if start_time < now:
                start_time += timedelta(days=1)
        else:
            # Default to next hour
            start_time = now.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    
    params['start_time'] = start_time.isoformat()
    params['end_time'] = (start_time + timedelta(hours=1)).isoformat()
    
    return params