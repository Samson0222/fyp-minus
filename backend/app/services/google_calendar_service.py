import os
import logging
from typing import Dict, Any, Optional, List

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build, Resource
from googleapiclient.errors import HttpError


from app.core.config import GOOGLE_SCOPES

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
        token_path = os.path.join(tokens_dir, f"token_google_{user_id}.json")

        if os.path.exists(token_path):
            try:
                creds = Credentials.from_authorized_user_file(token_path, GOOGLE_SCOPES)
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

    def get_events(self, user_id: str, time_min: str, time_max: str) -> Optional[List[Dict[str, Any]]]:
        """
        Retrieves events from the user's primary calendar within a specified time range.
        """
        logger.info(f"Attempting to retrieve Google Calendar events for user {user_id}")
        service = self._get_service(user_id)
        if not service:
            logger.error("Cannot retrieve events: Google Calendar service not available.")
            return None

        try:
            # Add '.000Z' to make it a valid RFC3339 timestamp if it's not already
            if 'T' not in time_min:
                time_min = f"{time_min}T00:00:00.000Z"
            if 'T' not in time_max:
                time_max = f"{time_max}T23:59:59.999Z"
            
            events_result = service.events().list(
                calendarId='primary',
                timeMin=time_min,
                timeMax=time_max,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            
            events = events_result.get('items', [])
            logger.info(f"Successfully retrieved {len(events)} events for user {user_id}")
            return events
        except HttpError as error:
            logger.error(f"An error occurred retrieving Google events for user {user_id}: {error}")
            return None

    def create_event_from_dict(self, user_id: str, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Creates a new event on Google Calendar from event data dictionary."""
        logger.info(f"Attempting to create Google Calendar event for user {user_id}")
        service = self._get_service(user_id)
        if not service:
            logger.error("Cannot create event: Google Calendar service not available.")
            return None
        
        try:
            created_event = service.events().insert(calendarId='primary', body=event_data).execute()
            logger.info(f"Successfully created Google event {created_event['id']}")
            return created_event
        except HttpError as error:
            logger.error(f"An error occurred creating Google event: {error}")
            return None

    def update_event_from_dict(self, user_id: str, event_id: str, event_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates an existing event on Google Calendar."""
        logger.info(f"Attempting to update Google Calendar event {event_id} for user {user_id}")
        service = self._get_service(user_id)
        if not service:
            logger.error("Cannot update event: Google Calendar service not available.")
            return None

        try:
            updated_event = service.events().update(
                calendarId='primary', 
                eventId=event_id, 
                body=event_data
            ).execute()
            logger.info(f"Successfully updated Google event {updated_event['id']}")
            return updated_event
        except HttpError as error:
            logger.error(f"An error occurred updating Google event {event_id}: {error}")
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