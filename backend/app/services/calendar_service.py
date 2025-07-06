"""
Google Calendar Service with Gemma 3n Voice Integration
"""
from __future__ import annotations

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import List, Dict, Any, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Mock imports for now - will implement real Google Calendar API later
# from google.auth.transport.requests import Request
# from google.oauth2.credentials import Credentials
# from google_auth_oauthlib.flow import InstalledAppFlow
# from googleapiclient.discovery import build

# Calendar API scopes – modify events and read free/busy
SCOPES = [
    "https://www.googleapis.com/auth/calendar"
]

class CalendarService:
    """Google Calendar API helper with OAuth2 per-user tokens."""

    def __init__(self):
        self.service: Optional[Any] = None
        self.credentials: Optional[Credentials] = None
        self.mock_mode = True  # Start in mock mode for testing
        logging.info("📅 Calendar service initialized in mock mode")
    
    # ---------------------------------------------------------------------
    # Authentication helpers
    # ---------------------------------------------------------------------
    async def authenticate(self, user_id: str) -> bool:
        """Authenticate the current user – lazy, cached per instance."""
        try:
            tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
            token_path = os.path.join(tokens_dir, f"token_calendar_{user_id}.json")
            creds: Optional[Credentials] = None

            if os.path.exists(token_path):
                creds = Credentials.from_authorized_user_file(token_path, SCOPES)

            # Refresh / obtain new credentials if needed
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    credentials_path = os.getenv("GOOGLE_OAUTH_CREDENTIALS_PATH")
                    if not credentials_path or not os.path.exists(credentials_path):
                        raise FileNotFoundError(
                            f"Google OAuth credentials file not found. Set GOOGLE_OAUTH_CREDENTIALS_PATH in your .env file."
                        )

                    flow = InstalledAppFlow.from_client_secrets_file(
                        credentials_path, SCOPES
                    )
                    # NOTE: For server deployments replace with flow.run_console() or proper redirect URI
                    creds = flow.run_local_server(port=0)

                # Persist credentials for next run
                os.makedirs(tokens_dir, exist_ok=True)
                with open(token_path, "w") as token_file:
                    token_file.write(creds.to_json())

            self.credentials = creds
            self.service = build("calendar", "v3", credentials=creds)
            # Switch to real mode since authentication succeeded
            self.mock_mode = False
            return True
        except Exception as exc:
            print(f"Calendar authentication error: {exc}")
            return False
    
    # ---------------------------------------------------------------------
    # Core Calendar helpers
    # ---------------------------------------------------------------------
    async def list_events(self, user_id: str, time_min: datetime, time_max: datetime, max_results: int = 20) -> List[Dict[str, Any]]:
        """Return events in the provided time window (inclusive)."""
        if not await self.authenticate(user_id):
            return []

        try:
            events_result = (
                self.service.events()
                .list(
                    calendarId="primary",
                    timeMin=time_min.isoformat(),
                    timeMax=time_max.isoformat(),
                    singleEvents=True,
                    orderBy="startTime",
                    maxResults=max_results,
                )
                .execute()
            )
            return events_result.get("items", [])
        except HttpError as error:
            print(f"Calendar list events error: {error}")
            return []

    async def create_event(
        self,
        user_id: str,
        summary: str,
        start: datetime,
        end: datetime,
        timezone_str: str = "UTC",
        attendees: Optional[List[str]] = None,
        description: str = "",
    ) -> Dict[str, Any]:
        """Create a calendar event and return the inserted resource."""
        if not await self.authenticate(user_id):
            raise RuntimeError("Calendar authentication failed")

        event_body: Dict[str, Any] = {
            "summary": summary,
            "description": description,
            "start": {"dateTime": start.isoformat(), "timeZone": timezone_str},
            "end": {"dateTime": end.isoformat(), "timeZone": timezone_str},
        }
        if attendees:
            event_body["attendees"] = [{"email": email} for email in attendees]

        try:
            event = (
                self.service.events()
                .insert(calendarId="primary", body=event_body)
                .execute()
            )
            return event
        except HttpError as error:
            print(f"Calendar create event error: {error}")
            raise

    async def get_freebusy(
        self, user_id: str, start: datetime, end: datetime, time_zone: str = "UTC"
    ) -> Dict[str, Any]:
        """Call calendar.freeBusy query to determine availability."""
        if not await self.authenticate(user_id):
            raise RuntimeError("Calendar authentication failed")

        body = {
            "timeMin": start.isoformat(),
            "timeMax": end.isoformat(),
            "timeZone": time_zone,
            "items": [{"id": "primary"}],
        }
        try:
            result = self.service.freebusy().query(body=body).execute()
            return result.get("calendars", {}).get("primary", {})
        except HttpError as error:
            print(f"Calendar freeBusy error: {error}")
            raise

    # ---------------------------------------------------------------------
    # Voice-friendly convenience helpers
    # ---------------------------------------------------------------------
    async def get_today_schedule_voice(self, user_id: str, tz: timezone = timezone.utc) -> Dict[str, Any]:
        """Return a voice-formatted summary of today's events."""
        now = datetime.now(tz)
        start_of_day = datetime(now.year, now.month, now.day, tzinfo=tz)
        end_of_day = start_of_day + timedelta(days=1)

        events = await self.list_events(user_id, start_of_day, end_of_day, max_results=20)

        if not events:
            return {"response": "You have no events scheduled for today."}

        # Build human-readable summary
        lines: List[str] = []
        for event in events:
            start_time_str = event["start"].get("dateTime") or event["start"].get("date")
            # Extract only time portion if dateTime
            time_part = None
            if "T" in start_time_str:
                time_part = start_time_str.split("T")[1][:5]  # HH:MM
            summary = event.get("summary", "(No Title)")
            lines.append(f"at {time_part or 'all-day'}: {summary}")

        spoken = "You have the following events today: " + "; ".join(lines) + "."
        return {"response": spoken, "events": events}

    async def create_event_voice(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create event based on voice/LLM parameters."""
        try:
            summary = params.get("title") or params.get("summary") or "Untitled Event"
            start_str = params.get("start") or params.get("start_time")
            end_str = params.get("end") or params.get("end_time")
            timezone_str = params.get("timezone", "UTC")
            attendees = params.get("attendees", [])

            if not start_str or not end_str:
                return {"error": "Both start and end times are required to create an event."}

            # Parse ISO 8601 strings to datetime
            start_dt = datetime.fromisoformat(start_str)
            end_dt = datetime.fromisoformat(end_str)

            event = await self.create_event(
                user_id,
                summary=summary,
                start=start_dt,
                end=end_dt,
                timezone_str=timezone_str,
                attendees=attendees,
                description=params.get("description", ""),
            )

            return {
                "response": f"Event '{summary}' created successfully.",
                "event": event,
            }
        except Exception as exc:
            return {"error": f"Failed to create event: {exc}"}

    async def check_availability_voice(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Check free/busy and return voice-friendly output."""
        try:
            start_str = params.get("start") or params.get("start_time")
            end_str = params.get("end") or params.get("end_time")
            timezone_str = params.get("timezone", "UTC")
            if not start_str or not end_str:
                return {"error": "Start and end time required."}

            start_dt = datetime.fromisoformat(start_str)
            end_dt = datetime.fromisoformat(end_str)
            fb = await self.get_freebusy(user_id, start_dt, end_dt, time_zone=timezone_str)
            busy_periods = fb.get("busy", [])
            if not busy_periods:
                return {"response": "You are available in that time range."}
            else:
                return {
                    "response": "You are busy during that time range.",
                    "busy": busy_periods,
                }
        except Exception as exc:
            return {"error": f"Failed to check availability: {exc}"}

    async def process_voice_command(self, command_data: dict) -> dict:
        """Process Calendar voice commands using Gemma 3n"""
        action = command_data.get("action")
        params = command_data.get("params", {})
        
        try:
            if action == "check_today":
                return await self.get_today_schedule_voice(params["user_id"], params.get("timezone", timezone.utc))
            elif action == "create_event":
                return await self.create_event_voice(params["user_id"], params)
            elif action == "check_availability":
                return await self.check_availability_voice(params["user_id"], params)
            else:
                return {"error": f"Unknown Calendar action: {action}"}
        except Exception as e:
            return {"error": f"Calendar command failed: {str(e)}"}
    
    async def get_upcoming_events(self, user_id: str, days: int = 7) -> dict:
        """Get upcoming events for the next N days"""
        try:
            if self.mock_mode:
                # Mock upcoming events
                upcoming = [
                    {"title": "Team Meeting", "date": "Tomorrow", "time": "10:00 AM"},
                    {"title": "Doctor Appointment", "date": "Friday", "time": "2:30 PM"},
                    {"title": "Weekend Trip", "date": "Saturday", "time": "All Day"}
                ]
                
                return {
                    "response": f"You have {len(upcoming)} upcoming events in the next {days} days.",
                    "events": upcoming
                }
            
            # TODO: Implement real upcoming events query
            
        except Exception as e:
            return {"error": f"Failed to get upcoming events: {str(e)}"}

# Global calendar service instance
calendar_service = CalendarService()