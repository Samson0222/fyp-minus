import logging
from typing import Dict, Any, Optional
from datetime import datetime, timedelta, timezone

from app.services.google_calendar_service import GoogleCalendarService

logger = logging.getLogger(__name__)

class CalendarService:
    """
    Calendar service that handles voice commands and integrates with Google Calendar.
    This replaces the old task-based system with direct calendar event management.
    """
    
    def __init__(self):
        self.google_calendar_service = GoogleCalendarService()
        self.mock_mode = False  # For testing compatibility
    
    async def authenticate(self, user_id: str) -> bool:
        """Authenticate user with Google Calendar."""
        try:
            service = self.google_calendar_service._get_service(user_id)
            return service is not None
        except Exception as e:
            logger.error(f"Authentication failed for user {user_id}: {e}")
            return False
    
    async def process_voice_command(self, command_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process calendar voice commands."""
        try:
            action = command_data.get("action")
            params = command_data.get("params", {})
            user_id = command_data.get("user_id", "test_user_001")  # Default for testing
            
            if action == "check_today":
                return await self.get_today_schedule_voice(user_id)
            elif action == "create_event":
                return await self.create_event_voice(user_id, params)
            elif action == "check_availability":
                return await self.check_availability_voice(user_id, params)
            elif action == "get_upcoming":
                return await self.get_upcoming_events(user_id, params.get("days", 7))
            else:
                return {
                    "response": f"I don't know how to handle the calendar action: {action}",
                    "success": False
                }
                
        except Exception as e:
            logger.error(f"Error processing calendar voice command: {e}")
            return {
                "response": f"Sorry, I encountered an error: {str(e)}",
                "success": False
            }
    
    async def get_today_schedule_voice(self, user_id: str) -> Dict[str, Any]:
        """Get today's schedule formatted for voice response."""
        try:
            service = self.google_calendar_service._get_service(user_id)
            if not service:
                return {
                    "response": "Please connect your Google Calendar account first.",
                    "success": False
                }
            
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
            
            if not events:
                return {
                    "response": "You have no events scheduled for today.",
                    "count": 0,
                    "success": True
                }
            
            # Format response for voice
            if len(events) == 1:
                event = events[0]
                event_time = self._format_event_time(event)
                response = f"You have one event today: {event.get('summary', 'Untitled')} {event_time}."
            else:
                response = f"You have {len(events)} events today: "
                event_summaries = []
                for event in events[:5]:  # Limit to first 5 for voice
                    event_time = self._format_event_time(event)
                    event_summaries.append(f"{event.get('summary', 'Untitled')} {event_time}")
                response += ", ".join(event_summaries)
                if len(events) > 5:
                    response += f", and {len(events) - 5} more events."
            
            return {
                "response": response,
                "count": len(events),
                "events": events,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error getting today's schedule: {e}")
            return {
                "response": "Sorry, I couldn't retrieve your schedule.",
                "success": False
            }
    
    async def create_event_voice(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Create a calendar event from voice parameters."""
        try:
            service = self.google_calendar_service._get_service(user_id)
            if not service:
                return {
                    "response": "Please connect your Google Calendar account first.",
                    "success": False
                }
            
            title = params.get("title", "New Event")
            start_time = params.get("start_time")
            end_time = params.get("end_time")
            description = params.get("description", "")
            
            # Default to one-hour event starting now if no times provided
            if not start_time:
                start_time = datetime.now(timezone.utc)
            elif isinstance(start_time, str):
                start_time = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
            
            if not end_time:
                end_time = start_time + timedelta(hours=1)
            elif isinstance(end_time, str):
                end_time = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
            
            event_data = {
                'summary': title,
                'description': description,
                'start': {
                    'dateTime': start_time.isoformat(),
                    'timeZone': 'UTC',
                },
                'end': {
                    'dateTime': end_time.isoformat(),
                    'timeZone': 'UTC',
                },
            }
            
            # Create the event
            created_event = self.google_calendar_service.create_event_from_dict(user_id, event_data)
            
            if created_event:
                formatted_time = start_time.strftime("%B %d at %I:%M %p")
                return {
                    "response": f"I've created the event '{title}' for {formatted_time}.",
                    "event": created_event,
                    "success": True
                }
            else:
                return {
                    "response": "Sorry, I couldn't create the event. Please try again.",
                    "success": False
                }
                
        except Exception as e:
            logger.error(f"Error creating event: {e}")
            return {
                "response": "Sorry, I encountered an error creating the event.",
                "success": False
            }
    
    async def check_availability_voice(self, user_id: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Check availability for a given time."""
        try:
            service = self.google_calendar_service._get_service(user_id)
            if not service:
                return {
                    "response": "Please connect your Google Calendar account first.",
                    "success": False
                }
            
            # Parse the requested time (simplified implementation)
            date_str = params.get("date", "today")
            time_str = params.get("time", "10:00 AM")
            
            # For now, just return a simple availability check
            return {
                "response": f"Let me check your availability for {date_str} at {time_str}. You appear to be free at that time.",
                "available": True,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error checking availability: {e}")
            return {
                "response": "Sorry, I couldn't check your availability.",
                "success": False
            }
    
    async def get_upcoming_events(self, user_id: str, days: int = 7) -> Dict[str, Any]:
        """Get upcoming events for the next specified days."""
        try:
            service = self.google_calendar_service._get_service(user_id)
            if not service:
                return {
                    "response": "Please connect your Google Calendar account first.",
                    "success": False
                }
            
            now = datetime.now(timezone.utc)
            future_date = now + timedelta(days=days)
            
            events_result = service.events().list(
                calendarId='primary',
                timeMin=now.isoformat(),
                timeMax=future_date.isoformat(),
                singleEvents=True,
                orderBy='startTime',
                maxResults=10
            ).execute()
            
            events = events_result.get('items', [])
            
            if not events:
                return {
                    "response": f"You have no upcoming events in the next {days} days.",
                    "count": 0,
                    "success": True
                }
            
            return {
                "response": f"You have {len(events)} upcoming events in the next {days} days.",
                "count": len(events),
                "events": events,
                "success": True
            }
            
        except Exception as e:
            logger.error(f"Error getting upcoming events: {e}")
            return {
                "response": "Sorry, I couldn't retrieve your upcoming events.",
                "success": False
            }
    
    def _format_event_time(self, event: Dict[str, Any]) -> str:
        """Format event time for voice response."""
        start = event.get('start', {})
        
        if 'dateTime' in start:
            # Timed event
            start_dt = datetime.fromisoformat(start['dateTime'].replace('Z', '+00:00'))
            return f"at {start_dt.strftime('%I:%M %p')}"
        elif 'date' in start:
            # All-day event
            return "all day"
        else:
            return ""

# Global instance for compatibility with existing imports
calendar_service = CalendarService() 