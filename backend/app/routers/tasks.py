from fastapi import APIRouter, HTTPException, Depends, Query
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import logging

from app.services.calendar_service import calendar_service

# Dependency to get current user (simplified demo)
async def get_current_user(authorization: Optional[str] = None):
    """Stub user extraction – replace with real auth if needed."""
    return {"user_id": "test_user_001", "email": "test@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


# -----------------------
# Pydantic models
# -----------------------
class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: bool = True
    timezone: str = "UTC"
    priority: str = "medium"
    status: str = "todo"
    tags: Optional[List[dict]] = []
    created_via: str = "manual"
    voice_command: Optional[str] = None
    sync_to_google: bool = False  # New field for sync control

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    timezone: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[dict]] = None
    sync_to_google: Optional[bool] = None  # New field for sync control

class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: bool
    timezone: str
    priority: str
    status: str
    tags: List[dict] = []
    google_calendar_event_id: Optional[str] = None
    is_synced_to_google: bool = False
    last_synced_at: Optional[datetime] = None
    created_via: str
    voice_command: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# -----------------------
# Helper functions
# -----------------------
async def sync_task_to_google_calendar(task_data: dict, user_id: str) -> Optional[str]:
    """
    Sync a task to Google Calendar and return the Google event ID.
    
    Args:
        task_data: Task data dictionary
        user_id: User ID for authentication
        
    Returns:
        Google Calendar event ID if successful, None if failed
    """
    try:
        if not task_data.get('start_at'):
            logger.warning("Cannot sync task without start_at date")
            return None
            
        # Prepare event data for Google Calendar
        summary = task_data['title']
        start_dt = task_data['start_at']
        
        # Calculate end time if not provided
        if task_data.get('end_at'):
            end_dt = task_data['end_at']
        elif task_data.get('is_all_day', True):
            # For all-day events, end is typically the next day
            end_dt = datetime.combine(start_dt.date(), datetime.min.time())
            end_dt = end_dt.replace(tzinfo=start_dt.tzinfo)
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        else:
            # Default to 1 hour duration for timed events
            from datetime import timedelta
            end_dt = start_dt + timedelta(hours=1)
        
        # Create event in Google Calendar
        google_event = await calendar_service.create_event(
            user_id=user_id,
            summary=summary,
            start=start_dt,
            end=end_dt,
            timezone_str=task_data.get('timezone', 'UTC'),
            description=task_data.get('description', ''),
            attendees=[]
        )
        
        google_event_id = google_event.get('id')
        logger.info(f"Task synced to Google Calendar with ID: {google_event_id}")
        return google_event_id
        
    except Exception as e:
        logger.error(f"Failed to sync task to Google Calendar: {e}")
        return None


async def create_task_in_database(task_data: dict, user_id: str) -> dict:
    """
    Create task in Supabase database.
    This is a placeholder - you'll need to implement actual Supabase integration.
    """
    # TODO: Implement actual Supabase database integration
    # For now, return mock data
    import uuid
    from datetime import datetime, timezone
    
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    return {
        "id": task_id,
        "user_id": user_id,
        "title": task_data["title"],
        "description": task_data.get("description"),
        "start_at": task_data.get("start_at"),
        "end_at": task_data.get("end_at"),
        "is_all_day": task_data.get("is_all_day", True),
        "timezone": task_data.get("timezone", "UTC"),
        "priority": task_data.get("priority", "medium"),
        "status": task_data.get("status", "todo"),
        "tags": task_data.get("tags", []),
        "google_calendar_event_id": task_data.get("google_calendar_event_id"),
        "is_synced_to_google": task_data.get("is_synced_to_google", False),
        "last_synced_at": task_data.get("last_synced_at"),
        "created_via": task_data.get("created_via", "manual"),
        "voice_command": task_data.get("voice_command"),
        "created_at": now,
        "updated_at": now,
    }


async def update_task_in_database(task_id: str, updates: dict, user_id: str) -> dict:
    """
    Update task in Supabase database.
    This is a placeholder - you'll need to implement actual Supabase integration.
    """
    # TODO: Implement actual Supabase database integration
    # For now, return mock updated data
    from datetime import datetime, timezone
    
    # Get existing task (mock)
    existing_task = await create_task_in_database({"title": "Existing Task"}, user_id)
    
    # Apply updates
    for key, value in updates.items():
        if value is not None:
            existing_task[key] = value
    
    existing_task["updated_at"] = datetime.now(timezone.utc)
    return existing_task


# -----------------------
# Endpoints
# -----------------------
@router.post("/", response_model=TaskResponse)
async def create_task(
    task_request: CreateTaskRequest,
    user = Depends(get_current_user)
):
    """
    Create a new task with optional Google Calendar sync.
    
    If sync_to_google is True, the task will be automatically 
    synced to the user's Google Calendar.
    """
    try:
        task_data = task_request.dict()
        user_id = user["user_id"]
        
        # Handle Google Calendar sync if requested
        google_event_id = None
        if task_request.sync_to_google:
            google_event_id = await sync_task_to_google_calendar(task_data, user_id)
            if google_event_id:
                task_data["google_calendar_event_id"] = google_event_id
                task_data["is_synced_to_google"] = True
                task_data["last_synced_at"] = datetime.now()
            else:
                logger.warning("Google Calendar sync failed, creating local task only")
        
        # Remove sync_to_google from task_data as it's not a database field
        task_data.pop("sync_to_google", None)
        
        # Create task in database
        created_task = await create_task_in_database(task_data, user_id)
        
        return TaskResponse(**created_task)
        
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_request: UpdateTaskRequest,
    user = Depends(get_current_user)
):
    """
    Update an existing task with optional Google Calendar sync.
    
    If sync_to_google is True and the task isn't already synced,
    it will be synced to Google Calendar.
    """
    try:
        updates = {k: v for k, v in task_request.dict().items() if v is not None}
        user_id = user["user_id"]
        
        # Handle Google Calendar sync if requested
        if task_request.sync_to_google:
            # TODO: Get existing task to check if already synced
            # For now, assume it's not synced
            
            # Create the task data for syncing
            task_data = updates.copy()
            task_data["title"] = task_data.get("title", "Updated Task")  # Fallback
            
            google_event_id = await sync_task_to_google_calendar(task_data, user_id)
            if google_event_id:
                updates["google_calendar_event_id"] = google_event_id
                updates["is_synced_to_google"] = True
                updates["last_synced_at"] = datetime.now()
        
        # Remove sync_to_google from updates as it's not a database field
        updates.pop("sync_to_google", None)
        
        # Update task in database
        updated_task = await update_task_in_database(task_id, updates, user_id)
        
        return TaskResponse(**updated_task)
        
    except Exception as e:
        logger.error(f"Failed to update task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")


@router.post("/{task_id}/sync-to-google")
async def sync_existing_task_to_google(
    task_id: str,
    user = Depends(get_current_user)
):
    """
    Sync an existing task to Google Calendar.
    """
    try:
        user_id = user["user_id"]
        
        # TODO: Get existing task from database
        # For now, create mock task data
        task_data = {
            "title": "Sample Task",
            "start_at": datetime.now(),
            "is_all_day": True,
            "timezone": "UTC"
        }
        
        google_event_id = await sync_task_to_google_calendar(task_data, user_id)
        
        if google_event_id:
            # Update task with Google Calendar info
            updates = {
                "google_calendar_event_id": google_event_id,
                "is_synced_to_google": True,
                "last_synced_at": datetime.now()
            }
            updated_task = await update_task_in_database(task_id, updates, user_id)
            
            return {
                "success": True,
                "message": "Task synced to Google Calendar successfully",
                "google_event_id": google_event_id,
                "task": TaskResponse(**updated_task)
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to sync task to Google Calendar"
            )
            
    except Exception as e:
        logger.error(f"Failed to sync task to Google Calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.delete("/{task_id}/unsync-from-google")
async def unsync_task_from_google(
    task_id: str,
    user = Depends(get_current_user)
):
    """
    Remove Google Calendar sync from a task (keeps the task, removes the sync).
    """
    try:
        user_id = user["user_id"]
        
        # TODO: Get existing task and remove from Google Calendar if needed
        
        # Update task to remove Google Calendar info
        updates = {
            "google_calendar_event_id": None,
            "is_synced_to_google": False,
            "last_synced_at": None
        }
        updated_task = await update_task_in_database(task_id, updates, user_id)
        
        return {
            "success": True,
            "message": "Task unsynced from Google Calendar",
            "task": TaskResponse(**updated_task)
        }
        
    except Exception as e:
        logger.error(f"Failed to unsync task from Google Calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Unsync failed: {str(e)}") 
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import logging

from app.services.calendar_service import calendar_service

# Dependency to get current user (simplified demo)
async def get_current_user(authorization: Optional[str] = None):
    """Stub user extraction – replace with real auth if needed."""
    return {"user_id": "test_user_001", "email": "test@example.com"}

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/tasks", tags=["tasks"])


# -----------------------
# Pydantic models
# -----------------------
class CreateTaskRequest(BaseModel):
    title: str
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: bool = True
    timezone: str = "UTC"
    priority: str = "medium"
    status: str = "todo"
    tags: Optional[List[dict]] = []
    created_via: str = "manual"
    voice_command: Optional[str] = None
    sync_to_google: bool = False  # New field for sync control

class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    timezone: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[List[dict]] = None
    sync_to_google: Optional[bool] = None  # New field for sync control

class TaskResponse(BaseModel):
    id: str
    user_id: str
    title: str
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: bool
    timezone: str
    priority: str
    status: str
    tags: List[dict] = []
    google_calendar_event_id: Optional[str] = None
    is_synced_to_google: bool = False
    last_synced_at: Optional[datetime] = None
    created_via: str
    voice_command: Optional[str] = None
    created_at: datetime
    updated_at: datetime


# -----------------------
# Helper functions
# -----------------------
async def sync_task_to_google_calendar(task_data: dict, user_id: str) -> Optional[str]:
    """
    Sync a task to Google Calendar and return the Google event ID.
    
    Args:
        task_data: Task data dictionary
        user_id: User ID for authentication
        
    Returns:
        Google Calendar event ID if successful, None if failed
    """
    try:
        if not task_data.get('start_at'):
            logger.warning("Cannot sync task without start_at date")
            return None
            
        # Prepare event data for Google Calendar
        summary = task_data['title']
        start_dt = task_data['start_at']
        
        # Calculate end time if not provided
        if task_data.get('end_at'):
            end_dt = task_data['end_at']
        elif task_data.get('is_all_day', True):
            # For all-day events, end is typically the next day
            end_dt = datetime.combine(start_dt.date(), datetime.min.time())
            end_dt = end_dt.replace(tzinfo=start_dt.tzinfo)
            end_dt = end_dt.replace(hour=23, minute=59, second=59)
        else:
            # Default to 1 hour duration for timed events
            from datetime import timedelta
            end_dt = start_dt + timedelta(hours=1)
        
        # Create event in Google Calendar
        google_event = await calendar_service.create_event(
            user_id=user_id,
            summary=summary,
            start=start_dt,
            end=end_dt,
            timezone_str=task_data.get('timezone', 'UTC'),
            description=task_data.get('description', ''),
            attendees=[]
        )
        
        google_event_id = google_event.get('id')
        logger.info(f"Task synced to Google Calendar with ID: {google_event_id}")
        return google_event_id
        
    except Exception as e:
        logger.error(f"Failed to sync task to Google Calendar: {e}")
        return None


async def create_task_in_database(task_data: dict, user_id: str) -> dict:
    """
    Create task in Supabase database.
    This is a placeholder - you'll need to implement actual Supabase integration.
    """
    # TODO: Implement actual Supabase database integration
    # For now, return mock data
    import uuid
    from datetime import datetime, timezone
    
    task_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    
    return {
        "id": task_id,
        "user_id": user_id,
        "title": task_data["title"],
        "description": task_data.get("description"),
        "start_at": task_data.get("start_at"),
        "end_at": task_data.get("end_at"),
        "is_all_day": task_data.get("is_all_day", True),
        "timezone": task_data.get("timezone", "UTC"),
        "priority": task_data.get("priority", "medium"),
        "status": task_data.get("status", "todo"),
        "tags": task_data.get("tags", []),
        "google_calendar_event_id": task_data.get("google_calendar_event_id"),
        "is_synced_to_google": task_data.get("is_synced_to_google", False),
        "last_synced_at": task_data.get("last_synced_at"),
        "created_via": task_data.get("created_via", "manual"),
        "voice_command": task_data.get("voice_command"),
        "created_at": now,
        "updated_at": now,
    }


async def update_task_in_database(task_id: str, updates: dict, user_id: str) -> dict:
    """
    Update task in Supabase database.
    This is a placeholder - you'll need to implement actual Supabase integration.
    """
    # TODO: Implement actual Supabase database integration
    # For now, return mock updated data
    from datetime import datetime, timezone
    
    # Get existing task (mock)
    existing_task = await create_task_in_database({"title": "Existing Task"}, user_id)
    
    # Apply updates
    for key, value in updates.items():
        if value is not None:
            existing_task[key] = value
    
    existing_task["updated_at"] = datetime.now(timezone.utc)
    return existing_task


# -----------------------
# Endpoints
# -----------------------
@router.post("/", response_model=TaskResponse)
async def create_task(
    task_request: CreateTaskRequest,
    user = Depends(get_current_user)
):
    """
    Create a new task with optional Google Calendar sync.
    
    If sync_to_google is True, the task will be automatically 
    synced to the user's Google Calendar.
    """
    try:
        task_data = task_request.dict()
        user_id = user["user_id"]
        
        # Handle Google Calendar sync if requested
        google_event_id = None
        if task_request.sync_to_google:
            google_event_id = await sync_task_to_google_calendar(task_data, user_id)
            if google_event_id:
                task_data["google_calendar_event_id"] = google_event_id
                task_data["is_synced_to_google"] = True
                task_data["last_synced_at"] = datetime.now()
            else:
                logger.warning("Google Calendar sync failed, creating local task only")
        
        # Remove sync_to_google from task_data as it's not a database field
        task_data.pop("sync_to_google", None)
        
        # Create task in database
        created_task = await create_task_in_database(task_data, user_id)
        
        return TaskResponse(**created_task)
        
    except Exception as e:
        logger.error(f"Failed to create task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create task: {str(e)}")


@router.put("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: str,
    task_request: UpdateTaskRequest,
    user = Depends(get_current_user)
):
    """
    Update an existing task with optional Google Calendar sync.
    
    If sync_to_google is True and the task isn't already synced,
    it will be synced to Google Calendar.
    """
    try:
        updates = {k: v for k, v in task_request.dict().items() if v is not None}
        user_id = user["user_id"]
        
        # Handle Google Calendar sync if requested
        if task_request.sync_to_google:
            # TODO: Get existing task to check if already synced
            # For now, assume it's not synced
            
            # Create the task data for syncing
            task_data = updates.copy()
            task_data["title"] = task_data.get("title", "Updated Task")  # Fallback
            
            google_event_id = await sync_task_to_google_calendar(task_data, user_id)
            if google_event_id:
                updates["google_calendar_event_id"] = google_event_id
                updates["is_synced_to_google"] = True
                updates["last_synced_at"] = datetime.now()
        
        # Remove sync_to_google from updates as it's not a database field
        updates.pop("sync_to_google", None)
        
        # Update task in database
        updated_task = await update_task_in_database(task_id, updates, user_id)
        
        return TaskResponse(**updated_task)
        
    except Exception as e:
        logger.error(f"Failed to update task: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update task: {str(e)}")


@router.post("/{task_id}/sync-to-google")
async def sync_existing_task_to_google(
    task_id: str,
    user = Depends(get_current_user)
):
    """
    Sync an existing task to Google Calendar.
    """
    try:
        user_id = user["user_id"]
        
        # TODO: Get existing task from database
        # For now, create mock task data
        task_data = {
            "title": "Sample Task",
            "start_at": datetime.now(),
            "is_all_day": True,
            "timezone": "UTC"
        }
        
        google_event_id = await sync_task_to_google_calendar(task_data, user_id)
        
        if google_event_id:
            # Update task with Google Calendar info
            updates = {
                "google_calendar_event_id": google_event_id,
                "is_synced_to_google": True,
                "last_synced_at": datetime.now()
            }
            updated_task = await update_task_in_database(task_id, updates, user_id)
            
            return {
                "success": True,
                "message": "Task synced to Google Calendar successfully",
                "google_event_id": google_event_id,
                "task": TaskResponse(**updated_task)
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to sync task to Google Calendar"
            )
            
    except Exception as e:
        logger.error(f"Failed to sync task to Google Calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")


@router.delete("/{task_id}/unsync-from-google")
async def unsync_task_from_google(
    task_id: str,
    user = Depends(get_current_user)
):
    """
    Remove Google Calendar sync from a task (keeps the task, removes the sync).
    """
    try:
        user_id = user["user_id"]
        
        # TODO: Get existing task and remove from Google Calendar if needed
        
        # Update task to remove Google Calendar info
        updates = {
            "google_calendar_event_id": None,
            "is_synced_to_google": False,
            "last_synced_at": None
        }
        updated_task = await update_task_in_database(task_id, updates, user_id)
        
        return {
            "success": True,
            "message": "Task unsynced from Google Calendar",
            "task": TaskResponse(**updated_task)
        }
        
    except Exception as e:
        logger.error(f"Failed to unsync task from Google Calendar: {e}")
        raise HTTPException(status_code=500, detail=f"Unsync failed: {str(e)}") 
 
 