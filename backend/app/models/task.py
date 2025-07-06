from pydantic import BaseModel, Field
from typing import Optional, List
from uuid import UUID
from datetime import datetime
from enum import Enum

class TaskType(str, Enum):
    TODO = "todo"
    EVENT = "event"

class TaskPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class TaskStatus(str, Enum):
    TODO = "todo"
    INPROGRESS = "inprogress"
    DONE = "done"

class TaskBase(BaseModel):
    title: str
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: bool = False
    timezone: str = "UTC"
    
    type: TaskType = TaskType.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    status: TaskStatus = TaskStatus.TODO

    # Google Sync Fields
    google_calendar_id: Optional[str] = 'primary'
    google_event_id: Optional[str] = None
    google_task_id: Optional[str] = None
    last_synced_at: Optional[datetime] = None

    # Advanced features
    tags: List[str] = []
    rrule: Optional[str] = None

    # Metadata
    created_via: str = 'manual'
    voice_command: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    start_at: Optional[datetime] = None
    end_at: Optional[datetime] = None
    is_all_day: Optional[bool] = None
    timezone: Optional[str] = None
    type: Optional[TaskType] = None
    priority: Optional[TaskPriority] = None
    status: Optional[TaskStatus] = None
    tags: Optional[List[str]] = None
    rrule: Optional[str] = None

class Task(TaskBase):
    id: UUID
    user_id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True 