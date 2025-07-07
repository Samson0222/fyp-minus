import logging
from typing import List, Dict, Any
from datetime import datetime, timezone

from app.core.database import SupabaseManager, get_database
from app.services.google_calendar_service import GoogleCalendarService
from app.models.task import Task, TaskCreate

logger = logging.getLogger(__name__)

class SyncService:
    """
    Handles the synchronization of events between Google Calendar and the local database.
    """

    def __init__(self, db: SupabaseManager):
        self.db = db

    async def sync_from_google(self, user_id: str) -> Dict[str, int]:
        """
        Performs a full pull-sync from Google Calendar to the local database.

        - Fetches all future events from Google Calendar.
        - Reconciles them with local tasks.
        - Creates new tasks for new Google events.
        - Updates existing tasks if the Google event has changed.

        Returns:
            A dictionary with the count of created and updated tasks.
        """
        logger.info(f"Starting Google Calendar sync for user {user_id}...")
        
        # 1. Get authenticated Google Calendar service
        self.calendar_service = GoogleCalendarService()
        g_service = self.calendar_service._get_service(user_id)
        if not g_service:
            logger.error(f"Cannot sync: Google Calendar service not available for user {user_id}.")
            raise ConnectionError("Failed to connect to Google Calendar.")

        # 2. Fetch all future events from Google Calendar
        now = datetime.utcnow().isoformat() + 'Z'  # 'Z' indicates UTC time
        try:
            events_result = g_service.events().list(
                calendarId='primary', 
                timeMin=now,
                singleEvents=True,
                orderBy='startTime'
            ).execute()
            google_events = events_result.get('items', [])
            logger.info(f"Found {len(google_events)} upcoming events in Google Calendar for user {user_id}.")
        except Exception as e:
            logger.error(f"Failed to fetch Google Calendar events for user {user_id}: {e}")
            return {"created": 0, "updated": 0, "failed": 0}

        # 3. Get all existing local tasks that are synced with Google
        local_tasks_list = await self.db.get_tasks(user_id, limit=1000) # Assuming max 1000 tasks to sync
        synced_local_tasks = {task['google_event_id']: task for task in local_tasks_list if task.get('google_event_id')}

        created_count = 0
        updated_count = 0
        failed_count = 0

        # 4. Reconcile each Google event with local tasks
        for g_event in google_events:
            google_event_id = g_event['id']
            
            try:
                # Convert Google event to our Task format
                task_from_google = self._google_event_to_task(g_event, user_id)

                # Case 1: Event already exists locally
                if google_event_id in synced_local_tasks:
                    local_task = synced_local_tasks[google_event_id]
                    # Check if Google event is more recent
                    g_updated = datetime.fromisoformat(g_event['updated'].replace('Z', '+00:00'))
                    local_updated = local_task['updated_at'].astimezone(timezone.utc)
                    
                    if g_updated > local_updated:
                        logger.info(f"Updating local task {local_task['id']} from Google event {google_event_id}...")
                        await self.db.update_task(local_task['id'], user_id, task_from_google.dict(exclude={'id', 'user_id', 'created_at', 'updated_at'}))
                        updated_count += 1
                
                # Case 2: New event from Google -> create new local task
                else:
                    logger.info(f"Creating new local task from Google event {google_event_id}...")
                    await self.db.create_task(task_from_google.dict(), user_id)
                    created_count += 1

            except Exception as e:
                logger.error(f"Failed to process Google event {google_event_id}: {e}")
                failed_count += 1

        logger.info(f"Sync complete for user {user_id}. Created: {created_count}, Updated: {updated_count}, Failed: {failed_count}")
        return {"created": created_count, "updated": updated_count, "failed": failed_count}

    def _google_event_to_task(self, g_event: Dict[str, Any], user_id: str) -> TaskCreate:
        """Converts a Google Calendar event into a TaskCreate model."""
        start = g_event.get('start', {})
        end = g_event.get('end', {})

        start_time = start.get('dateTime') or start.get('date')
        end_time = end.get('dateTime') or end.get('date')
        
        is_all_day = 'date' in start # Events with 'date' but not 'dateTime' are all-day

        return TaskCreate(
            title=g_event.get('summary', 'Untitled Event'),
            description=g_event.get('description'),
            start_time=datetime.fromisoformat(start_time) if start_time else None,
            end_time=datetime.fromisoformat(end_time) if end_time else None,
            is_all_day=is_all_day,
            google_event_id=g_event['id'],
            type='event', # Mark as an event
            # Default values for fields not present in Google Event
            priority='medium',
            status='todo',
            user_id=user_id,
        )

# Instantiate the service with its dependencies
sync_service = SyncService(db=get_database()) 