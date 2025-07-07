from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional

from app.core.database import SupabaseManager, get_database
from app.models.task import TaskCreate, TaskUpdate, Task as TaskResponse
from app.services.google_calendar_service import GoogleCalendarService
from app.services.sync_service import SyncService
import logging

# Dependency to get current user (simplified demo)
async def get_current_user(authorization: Optional[str] = None):
    """Stub user extraction – replace with real auth if needed."""
    return {"user_id": "test_user_001", "email": "test@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


@router.post("/", response_model=TaskResponse, status_code=201)
async def create_task(
    task_in: TaskCreate,
    user: dict = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """
    Create a new task. If the task has a start and end time, it will be
    synced to Google Calendar if the user is authenticated.
    """
    user_id = user["user_id"]
    
    # Create the task in our database first
    created_task_dict = await db.create_task(task_in.dict(), user_id)
    if not created_task_dict:
        raise HTTPException(status_code=500, detail="Failed to create the task in the database.")

    created_task = TaskResponse(**created_task_dict)

    # If the task is an event (has a start time), sync it to Google Calendar
    if created_task.start_time and created_task.end_time:
        gcal_service = GoogleCalendarService()
        google_event = gcal_service.create_event(user_id, created_task)
        if google_event and google_event.get('id'):
            # If sync is successful, update our task with the Google Event ID
            update_data = {"google_event_id": google_event['id']}
            updated_task_dict = await db.update_task(created_task.id, user_id, update_data)
            if updated_task_dict:
                return TaskResponse(**updated_task_dict)
            else:
                logger.error(
                    f"Task {created_task.id} created on Google Calendar ({google_event['id']}) "
                    f"but failed to update the google_event_id in our database."
                )
    
    return created_task


@router.get("/", response_model=List[TaskResponse])
async def get_all_tasks(
    user: dict = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database),
    offset: int = 0,
    limit: int = 100
):
    """Retrieve all tasks for the user."""
    user_id = user["user_id"]
    tasks_list = await db.get_tasks(user_id, offset, limit)
    return [TaskResponse(**task) for task in tasks_list]


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: str,
    user: dict = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """Retrieve a single task by its ID."""
    user_id = user["user_id"]
    task = await db.get_task_by_id(task_id, user_id)
    if not task:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found.")
    return TaskResponse(**task)


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_in: TaskUpdate,
    user: dict = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """
    Update a task. If the changes affect calendar-related fields,
    the corresponding Google Calendar event will be updated.
    """
    user_id = user["user_id"]
    
    # Get the existing task to check its current sync state
    existing_task_dict = await db.get_task_by_id(task_id, user_id)
    if not existing_task_dict:
        raise HTTPException(status_code=404, detail=f"Task with id {task_id} not found.")
    
    existing_task = TaskResponse(**existing_task_dict)
    
    # Update the task in our database
    update_data = task_in.dict(exclude_unset=True)
    updated_task_dict = await db.update_task(task_id, user_id, update_data)
    
    if not updated_task_dict:
        raise HTTPException(status_code=500, detail="Failed to update the task in the database.")
    
    updated_task = TaskResponse(**updated_task_dict)

    # Now, handle Google Calendar sync logic
    gcal_service = GoogleCalendarService()
    # Case 1: Task is already synced -> update the Google event
    if updated_task.google_event_id:
        gcal_service.update_event(user_id, updated_task)
    
    # Case 2: Task was not synced, but is now an event -> create a new Google event
    elif not existing_task.google_event_id and updated_task.start_time and updated_task.end_time:
        google_event = gcal_service.create_event(user_id, updated_task)
        if google_event and google_event.get('id'):
            # Link the new Google event to our task
            final_update = {"google_event_id": google_event['id']}
            final_task_dict = await db.update_task(task_id, user_id, final_update)
            if final_task_dict:
                return TaskResponse(**final_task_dict)

    return updated_task


@router.delete("/{task_id}", status_code=204)
async def delete_task(
    task_id: str,
    user: dict = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """
    Delete a task. This will also delete the corresponding
    event from Google Calendar if it exists.
    """
    user_id = user["user_id"]
    
    # First, get the task to find the google_event_id
    task_to_delete_dict = await db.get_task_by_id(task_id, user_id)
    if not task_to_delete_dict:
        # If it doesn't exist, we can consider the deletion successful (idempotency)
        return

    task_to_delete = TaskResponse(**task_to_delete_dict)

    # If it's synced, delete the Google Calendar event first
    if task_to_delete.google_event_id:
        gcal_service = GoogleCalendarService()
        success = gcal_service.delete_event(user_id, task_to_delete.google_event_id)
        if not success:
            # If the Google deletion fails, we might not want to delete our local task.
            # This depends on desired behavior. For now, we'll log and proceed.
            logger.warning(
                f"Failed to delete Google Calendar event {task_to_delete.google_event_id}. "
                f"The local task {task_id} will still be deleted."
            )

    # Delete the task from our database
    deleted = await db.delete_task(task_id, user_id)
    if not deleted:
        # This might happen if the task was deleted by another process between our checks
        raise HTTPException(status_code=404, detail="Task not found, could not delete.")

    return

@router.post("/sync-from-google", status_code=200)
async def sync_from_google_calendar(
    user: dict = Depends(get_current_user),
    db: SupabaseManager = Depends(get_database)
):
    """
    Triggers a full pull-sync from Google Calendar to the local database.
    """
    try:
        user_id = user["user_id"]
        sync_service = SyncService(db)
        sync_results = await sync_service.sync_from_google(user_id)
        return {
            "status": "success",
            "message": "Sync completed successfully.",
            "details": sync_results
        }
    except ConnectionError as e:
        raise HTTPException(status_code=503, detail=f"Google Calendar service unavailable: {e}")
    except Exception as e:
        logger.error(f"An unexpected error occurred during sync: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred during sync: {e}")
 
 