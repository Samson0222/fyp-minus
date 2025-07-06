import os
import logging
from typing import Dict, Any, Optional

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError

from app.models.task import Task

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# The scopes required for the Google Calendar API
CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events"
]

class GoogleCalendarService:
    """
    A service to interact with the Google Calendar API.
    Handles authentication, and creating, updating, and deleting events.
    """

    def _get_service(self, user_id: str) -> Optional[Resource]:
        """
        Authenticates with the Google Calendar API using stored tokens
        and returns a service object.
        """
        creds = None
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_calendar_{user_id}.json")

        if os.path.exists(token_path):
            try:
                creds = Credentials.from_authorized_user_file(token_path, CALENDAR_SCOPES)
            except Exception as e:
                logger.error(f"Failed to load credentials from {token_path}: {e}")
                return None

        # If there are no valid credentials, return None.
        # The user needs to authenticate via the web flow.
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                try:
                    creds.refresh(Request())
                    # Save the refreshed credentials back to the file
                    with open(token_path, 'w') as token:
                        token.write(creds.to_json())
                    logger.info(f"Refreshed Google Calendar token for user {user_id}")
                except Exception as e:
                    logger.error(f"Failed to refresh Google Calendar token for user {user_id}: {e}")
                    # If refresh fails, delete the invalid token file
                    os.remove(token_path)
                    return None
            else:
                logger.warning(f"User {user_id} does not have valid Google Calendar credentials.")
                return None
        
        try:
            service = build('calendar', 'v3', credentials=creds)
            return service
        except Exception as e:
            logger.error(f"Failed to build Google Calendar service for user {user_id}: {e}")
            return None

    def _task_to_google_event(self, task: Task) -> Dict[str, Any]:
        """Converts an application Task object to a Google Calendar event dictionary."""
        # This is a placeholder implementation.
        # We will need to map our Task model fields to Google Calendar event fields.
        event = {
            'summary': task.title,
            'description': task.description or '',
            'start': {
                'dateTime': task.start_time.isoformat(),
                'timeZone': 'UTC', # Or get user's timezone
            },
            'end': {
                'dateTime': task.end_time.isoformat(),
                'timeZone': 'UTC', # Or get user's timezone
            },
            # 'reminders': {
            #     'useDefault': False,
            #     'overrides': [
            #         {'method': 'email', 'minutes': 24 * 60},
            #         {'method': 'popup', 'minutes': 10},
            #     ],
            # },
        }
        return event

    def create_event(self, user_id: str, task: Task) -> Optional[Dict[str, Any]]:
        """Creates a new event on Google Calendar from a task."""
        logger.info(f"Attempting to create Google Calendar event for task {task.id} for user {user_id}")
        service = self._get_service(user_id)
        if not service:
            logger.error("Cannot create event: Google Calendar service not available.")
            return None

        event_body = self._task_to_google_event(task)
        
        try:
            created_event = service.events().insert(calendarId='primary', body=event_body).execute()
            logger.info(f"Successfully created Google event {created_event['id']} for task {task.id}")
            return created_event
        except HttpError as error:
            logger.error(f"An error occurred creating Google event for task {task.id}: {error}")
            return None

    def update_event(self, user_id: str, task: Task) -> Optional[Dict[str, Any]]:
        """Updates an existing event on Google Calendar."""
        if not task.google_event_id:
            logger.warning(f"Cannot update Google event: google_event_id is missing for task {task.id}")
            return None

        logger.info(f"Attempting to update Google Calendar event {task.google_event_id} for user {user_id}")
        service = self._get_service(user_id)
        if not service:
            logger.error("Cannot update event: Google Calendar service not available.")
            return None
        
        event_body = self._task_to_google_event(task)

        try:
            updated_event = service.events().update(
                calendarId='primary', 
                eventId=task.google_event_id, 
                body=event_body
            ).execute()
            logger.info(f"Successfully updated Google event {updated_event['id']} for task {task.id}")
            return updated_event
        except HttpError as error:
            logger.error(f"An error occurred updating Google event {task.google_event_id}: {error}")
            return None

    def delete_event(self, user_id: str, google_event_id: str) -> bool:
        """Deletes an event from Google Calendar."""
        logger.info(f"Attempting to delete Google Calendar event {google_event_id} for user {user_id}")
        service = self._get_service(user_id)
        if not service:
            logger.error("Cannot delete event: Google Calendar service not available.")
            return False

        try:
            service.events().delete(calendarId='primary', eventId=google_event_id).execute()
            logger.info(f"Successfully deleted Google event {google_event_id}")
            return True
        except HttpError as error:
            # If the event is already deleted, Google returns a 410 Gone.
            if error.resp.status == 410:
                logger.warning(f"Google event {google_event_id} was already gone.")
                return True
            logger.error(f"An error occurred deleting Google event {google_event_id}: {error}")
            return False

google_calendar_service = GoogleCalendarService() 