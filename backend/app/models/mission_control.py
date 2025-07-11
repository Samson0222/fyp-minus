from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum

class MissionPriority(str, Enum):
    """Priority levels for mission control items"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class MissionCategory(str, Enum):
    """Categories for mission control items"""
    TASKS = "tasks"
    EMAIL = "email"
    CALENDAR = "calendar"
    DOCS = "docs"
    SYSTEM = "system"
    INTEGRATION = "integration"
    PERFORMANCE = "performance"
    SECURITY = "security"

class MissionActionType(str, Enum):
    """Types of actions that can be taken"""
    OPTIMIZE = "optimize"
    SYNC = "sync"
    REVIEW = "review"
    UPDATE = "update"
    CLEANUP = "cleanup"
    BACKUP = "backup"
    CONFIGURE = "configure"
    MONITOR = "monitor"

class MissionItem(BaseModel):
    """Individual mission control item"""
    id: str = Field(..., description="Unique identifier for the mission item")
    title: str = Field(..., description="Human-readable title")
    description: str = Field(..., description="Detailed description of the issue/recommendation")
    category: MissionCategory = Field(..., description="Category of the mission item")
    priority: MissionPriority = Field(..., description="Priority level")
    action_type: MissionActionType = Field(..., description="Type of action required")
    
    # Status and timing
    status: Literal["pending", "in_progress", "completed", "dismissed", "failed"] = Field(default="pending")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    due_date: Optional[datetime] = Field(None, description="When this should be addressed")
    
    # Action details
    action_endpoint: Optional[str] = Field(None, description="API endpoint to call for action")
    action_payload: Optional[Dict[str, Any]] = Field(None, description="Payload for the action")
    estimated_time: Optional[int] = Field(None, description="Estimated time in minutes")
    
    # Metrics and context
    impact_score: float = Field(default=0.0, description="Impact score (0-100)")
    effort_score: float = Field(default=0.0, description="Effort required (0-100)")
    related_items: List[str] = Field(default_factory=list, description="Related mission item IDs")
    context_data: Optional[Dict[str, Any]] = Field(None, description="Additional context")
    
    # User interaction
    user_dismissible: bool = Field(default=True, description="Can user dismiss this item")
    auto_executable: bool = Field(default=False, description="Can be auto-executed")
    requires_confirmation: bool = Field(default=True, description="Requires user confirmation")

class MissionSystemHealth(BaseModel):
    """Overall system health metrics"""
    overall_score: float = Field(..., description="Overall health score (0-100)")
    performance_score: float = Field(..., description="Performance health (0-100)")
    integration_score: float = Field(..., description="Integration health (0-100)")
    data_quality_score: float = Field(..., description="Data quality score (0-100)")
    security_score: float = Field(..., description="Security score (0-100)")
    
    # Counts
    total_items: int = Field(default=0)
    critical_items: int = Field(default=0)
    high_priority_items: int = Field(default=0)
    pending_items: int = Field(default=0)
    
    # Last update
    last_check: datetime = Field(default_factory=datetime.utcnow)
    next_check: Optional[datetime] = Field(None)

class MissionDashboardData(BaseModel):
    """Complete mission control dashboard data"""
    system_health: MissionSystemHealth
    mission_items: List[MissionItem]
    quick_actions: List[MissionItem] = Field(default_factory=list, description="High-priority quick actions")
    recommendations: List[MissionItem] = Field(default_factory=list, description="AI recommendations")
    
    # Summary stats
    productivity_insights: Dict[str, Any] = Field(default_factory=dict)
    integration_status: Dict[str, Any] = Field(default_factory=dict)
    recent_activities: List[Dict[str, Any]] = Field(default_factory=list)

class ExecuteMissionActionRequest(BaseModel):
    """Request to execute a mission action"""
    mission_id: str = Field(..., description="Mission item ID to execute")
    confirmed: bool = Field(default=False, description="User confirmation")
    parameters: Optional[Dict[str, Any]] = Field(None, description="Additional parameters")

class ExecuteMissionActionResponse(BaseModel):
    """Response from executing a mission action"""
    success: bool
    message: str
    mission_id: str
    execution_time: float = Field(..., description="Execution time in seconds")
    results: Optional[Dict[str, Any]] = Field(None, description="Execution results")
    updated_mission_item: Optional[MissionItem] = Field(None)

class MissionControlAnalytics(BaseModel):
    """Analytics data for mission control"""
    time_period: Literal["24h", "7d", "30d"] = Field(default="24h")
    
    # Completion metrics
    items_completed: int = Field(default=0)
    items_dismissed: int = Field(default=0)
    items_failed: int = Field(default=0)
    average_completion_time: float = Field(default=0.0, description="Average time in hours")
    
    # Category breakdown
    category_breakdown: Dict[MissionCategory, int] = Field(default_factory=dict)
    priority_breakdown: Dict[MissionPriority, int] = Field(default_factory=dict)
    
    # Trends
    productivity_trend: float = Field(default=0.0, description="Productivity change percentage")
    efficiency_trend: float = Field(default=0.0, description="Efficiency change percentage")
    
    # Top issues
    top_recurring_issues: List[str] = Field(default_factory=list)
    improvement_suggestions: List[str] = Field(default_factory=list)

class CreateMissionItemRequest(BaseModel):
    """Request to create a new mission item"""
    title: str
    description: str
    category: MissionCategory
    priority: MissionPriority
    action_type: MissionActionType
    
    # Optional fields
    due_date: Optional[datetime] = None
    action_endpoint: Optional[str] = None
    action_payload: Optional[Dict[str, Any]] = None
    estimated_time: Optional[int] = None
    impact_score: Optional[float] = None
    effort_score: Optional[float] = None
    context_data: Optional[Dict[str, Any]] = None
    auto_executable: bool = False
    requires_confirmation: bool = True

class UpdateMissionItemRequest(BaseModel):
    """Request to update a mission item"""
    status: Optional[Literal["pending", "in_progress", "completed", "dismissed", "failed"]] = None
    priority: Optional[MissionPriority] = None
    due_date: Optional[datetime] = None
    context_data: Optional[Dict[str, Any]] = None
    
    # Fields that can be updated
    title: Optional[str] = None
    description: Optional[str] = None
    estimated_time: Optional[int] = None
    impact_score: Optional[float] = None
    effort_score: Optional[float] = None 