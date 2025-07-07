from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime, timedelta, timezone
import logging

from app.services.google_calendar_service import GoogleCalendarService
from app.services.sync_service import SyncService
from app.core.database import get_database

# Dependency to get current user (simplified demo)
async def get_current_user(authorization: Optional[str] = None):
    """Stub user extraction – replace with real auth if needed."""
    return {"user_id": "test_user_001", "email": "test@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/calendar", tags=["calendar"])


# -----------------------
# Pydantic models
# -----------------------
class CreateEventRequest(BaseModel):
    summary: str
    start: datetime  # ISO 8601
    end: datetime    # ISO 8601
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


# -----------------------
# Endpoints
# -----------------------
@router.get("/today")
async def get_today_schedule(user = Depends(get_current_user)):
    """Return today events in voice-friendly format."""
    result = await calendar_service.get_today_schedule_voice(user["user_id"])
    return result


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
            "start": {"dateTime": req.start.isoformat(), "timeZone": req.timezone},
            "end": {"dateTime": req.end.isoformat(), "timeZone": req.timezone},
            "attendees": [{"email": email} for email in req.attendees],
        }

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
    authenticated = await calendar_service.authenticate(user["user_id"])
    return {"authenticated": authenticated}


@router.post("/sync", status_code=200)
async def sync_google_calendar(
    user = Depends(get_current_user), 
    db = Depends(get_database)
):
    """
    Manually trigger a sync from Google Calendar to the local database.
    """
    try:
        user_id = user["user_id"]
        sync_service = SyncService(db=db)
        sync_result = await sync_service.sync_from_google(user_id)
        
        logger.info(f"Manual sync completed for user {user_id}. Results: {sync_result}")
        return {
            "status": "success",
            "message": "Synchronization with Google Calendar completed.",
            "details": sync_result
        }
    except ConnectionError as e:
        logger.error(f"Sync failed for user {user['user_id']}: {e}")
        raise HTTPException(status_code=503, detail="Could not connect to Google Calendar.")
    except Exception as e:
        logger.error(f"An unexpected error occurred during sync for user {user['user_id']}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="An unexpected error occurred during synchronization.")


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
            # Default to current month
            now = datetime.now(timezone.utc)
            time_min = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            # Next month's first day
            if now.month == 12:
                time_max = now.replace(year=now.year + 1, month=1, day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                time_max = now.replace(month=now.month + 1, day=1, hour=0, minute=0, second=0, microsecond=0)
        
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
 
 