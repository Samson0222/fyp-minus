import asyncio
import uuid
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from fastapi import HTTPException
import logging

from ..models.mission_control import (
    MissionItem, MissionSystemHealth, MissionDashboardData,
    MissionPriority, MissionCategory, MissionActionType,
    ExecuteMissionActionRequest, ExecuteMissionActionResponse,
    MissionControlAnalytics, CreateMissionItemRequest
)
from ..core.llm_factory import get_llm_service
from ..core.llm_base import AbstractLLMService


class MissionControlService:
    """
    Mission Control service for AI-driven system analysis and optimization recommendations.
    Provides intelligent insights into system health and actionable improvement suggestions.
    """
    
    def __init__(self):
        self.llm_service: Optional[AbstractLLMService] = get_llm_service()
        self.mission_items: Dict[str, MissionItem] = {}
        self.analytics_data = {}
        
        if not self.llm_service:
            logging.warning("MissionControlService: LLM could not be initialized. AI-driven insights will be disabled.")

        # Initialize with some sample mission items for demonstration
        self._initialize_sample_data()
    
    def _initialize_sample_data(self):
        """Initialize with sample mission control data"""
        sample_items = [
            {
                "title": "Optimize Email Processing Speed",
                "description": "Gmail processing is taking 15% longer than average. Consider implementing batch processing.",
                "category": MissionCategory.EMAIL,
                "priority": MissionPriority.MEDIUM,
                "action_type": MissionActionType.OPTIMIZE,
                "impact_score": 75.0,
                "effort_score": 40.0,
                "action_endpoint": "/api/v1/gmail/optimize",
                "estimated_time": 30
            },
            {
                "title": "Sync Calendar Data",
                "description": "Calendar sync has been pending for 2 hours. Manual sync recommended.",
                "category": MissionCategory.CALENDAR,
                "priority": MissionPriority.HIGH,
                "action_type": MissionActionType.SYNC,
                "impact_score": 85.0,
                "effort_score": 20.0,
                "action_endpoint": "/api/v1/calendar/sync",
                "estimated_time": 10
            },
            {
                "title": "Review Google Docs Integration",
                "description": "Google Docs integration shows 3 failed suggestion attempts. Review API credentials.",
                "category": MissionCategory.DOCS,
                "priority": MissionPriority.HIGH,
                "action_type": MissionActionType.REVIEW,
                "impact_score": 90.0,
                "effort_score": 50.0,
                "estimated_time": 45
            },
            {
                "title": "Clean Up Completed Tasks",
                "description": "157 completed tasks from last month. Archive to improve performance.",
                "category": MissionCategory.TASKS,
                "priority": MissionPriority.LOW,
                "action_type": MissionActionType.CLEANUP,
                "impact_score": 30.0,
                "effort_score": 15.0,
                "action_endpoint": "/api/v1/tasks/cleanup",
                "estimated_time": 5,
                "auto_executable": True,
                "requires_confirmation": False
            },
            {
                "title": "Update LLM Service Configuration",
                "description": "New LLM model available with 20% better performance. Update recommended.",
                "category": MissionCategory.SYSTEM,
                "priority": MissionPriority.MEDIUM,
                "action_type": MissionActionType.UPDATE,
                "impact_score": 65.0,
                "effort_score": 60.0,
                "estimated_time": 60
            }
        ]
        
        for item_data in sample_items:
            mission_id = str(uuid.uuid4())
            mission_item = MissionItem(
                id=mission_id,
                **item_data
            )
            self.mission_items[mission_id] = mission_item
    
    async def get_dashboard_data(self) -> MissionDashboardData:
        """Get complete mission control dashboard data"""
        try:
            # Calculate system health
            system_health = self._calculate_system_health()
            
            # Get mission items sorted by priority and impact
            sorted_items = sorted(
                self.mission_items.values(),
                key=lambda x: (
                    x.priority == MissionPriority.CRITICAL,
                    x.priority == MissionPriority.HIGH,
                    x.impact_score
                ),
                reverse=True
            )
            
            # Separate quick actions and recommendations
            quick_actions = [
                item for item in sorted_items 
                if item.priority in [MissionPriority.CRITICAL, MissionPriority.HIGH] 
                and item.status == "pending"
            ][:5]
            
            recommendations = [
                item for item in sorted_items 
                if item.action_type in [MissionActionType.OPTIMIZE, MissionActionType.UPDATE]
                and item.status == "pending"
            ][:3]
            
            # Generate productivity insights
            productivity_insights = await self._generate_productivity_insights()
            
            # Get integration status
            integration_status = self._get_integration_status()
            
            # Get recent activities
            recent_activities = self._get_recent_activities()
            
            return MissionDashboardData(
                system_health=system_health,
                mission_items=sorted_items,
                quick_actions=quick_actions,
                recommendations=recommendations,
                productivity_insights=productivity_insights,
                integration_status=integration_status,
                recent_activities=recent_activities
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to get dashboard data: {str(e)}")
    
    def _calculate_system_health(self) -> MissionSystemHealth:
        """Calculate overall system health metrics"""
        items = list(self.mission_items.values())
        
        # Count items by priority and status
        critical_items = len([i for i in items if i.priority == MissionPriority.CRITICAL])
        high_priority_items = len([i for i in items if i.priority == MissionPriority.HIGH])
        pending_items = len([i for i in items if i.status == "pending"])
        
        # Calculate health scores (simplified algorithm)
        performance_score = max(0, 100 - (critical_items * 20) - (high_priority_items * 10))
        integration_score = max(0, 100 - len([i for i in items if i.category == MissionCategory.INTEGRATION and i.status == "pending"]) * 15)
        data_quality_score = max(0, 100 - len([i for i in items if "sync" in i.title.lower() and i.status == "pending"]) * 25)
        security_score = max(0, 100 - len([i for i in items if i.category == MissionCategory.SECURITY and i.status == "pending"]) * 30)
        
        overall_score = (performance_score + integration_score + data_quality_score + security_score) / 4
        
        return MissionSystemHealth(
            overall_score=overall_score,
            performance_score=performance_score,
            integration_score=integration_score,
            data_quality_score=data_quality_score,
            security_score=security_score,
            total_items=len(items),
            critical_items=critical_items,
            high_priority_items=high_priority_items,
            pending_items=pending_items,
            next_check=datetime.utcnow() + timedelta(minutes=30)
        )
    
    async def _generate_productivity_insights(self) -> Dict[str, Any]:
        """Generate AI-powered productivity insights"""
        try:
            # Analyze current system state
            items = list(self.mission_items.values())
            
            # Create context for LLM analysis
            context = f"""
            System Analysis Request:
            - Total mission items: {len(items)}
            - Pending items: {len([i for i in items if i.status == 'pending'])}
            - High priority items: {len([i for i in items if i.priority == MissionPriority.HIGH])}
            - Categories with issues: {', '.join(set(i.category.value for i in items if i.status == 'pending'))}
            
            Please provide productivity insights and recommendations in JSON format.
            """
            
            if not self.llm_service:
                logging.warning("Cannot generate productivity insights: LLM service is unavailable.")
                return {} # Return empty dict if LLM is not available

            # Mock LLM response for now (replace with actual LLM call in production)
            insights = {
                "productivity_score": 78,
                "efficiency_trend": "+12%",
                "bottlenecks": [
                    "Email processing delays",
                    "Calendar sync issues",
                    "Manual task cleanup needed"
                ],
                "quick_wins": [
                    "Enable automatic task archiving",
                    "Schedule calendar sync every 30 minutes",
                    "Batch process emails during low usage hours"
                ],
                "focus_areas": [
                    "Integration reliability",
                    "Process automation",
                    "Performance optimization"
                ]
            }
            
            return insights
            
        except Exception as e:
            # Fallback insights
            return {
                "productivity_score": 75,
                "efficiency_trend": "Stable",
                "bottlenecks": ["System analysis in progress"],
                "quick_wins": ["Review mission control recommendations"],
                "focus_areas": ["System health monitoring"]
            }
    
    def _get_integration_status(self) -> Dict[str, Any]:
        """Get integration status for all connected services"""
        return {
            "gmail": {"status": "healthy", "last_sync": "2 minutes ago", "issues": 0},
            "calendar": {"status": "warning", "last_sync": "2 hours ago", "issues": 1},
            "docs": {"status": "error", "last_sync": "1 day ago", "issues": 3},
            "tasks": {"status": "healthy", "last_sync": "5 minutes ago", "issues": 0},
            "voice": {"status": "healthy", "last_sync": "active", "issues": 0}
        }
    
    def _get_recent_activities(self) -> List[Dict[str, Any]]:
        """Get recent system activities"""
        return [
            {
                "time": "5 minutes ago",
                "activity": "Gmail sync completed successfully",
                "type": "sync",
                "status": "success"
            },
            {
                "time": "15 minutes ago",
                "activity": "Voice command processed: 'add task'",
                "type": "command",
                "status": "success"
            },
            {
                "time": "1 hour ago",
                "activity": "Calendar sync failed - credentials expired",
                "type": "sync",
                "status": "error"
            },
            {
                "time": "2 hours ago",
                "activity": "Task batch processing completed",
                "type": "cleanup",
                "status": "success"
            }
        ]
    
    async def execute_mission_action(self, request: ExecuteMissionActionRequest) -> ExecuteMissionActionResponse:
        """Execute a mission control action"""
        start_time = datetime.utcnow()
        
        try:
            mission_item = self.mission_items.get(request.mission_id)
            if not mission_item:
                raise HTTPException(status_code=404, detail="Mission item not found")
            
            # Check if confirmation is required
            if mission_item.requires_confirmation and not request.confirmed:
                raise HTTPException(status_code=400, detail="Action requires user confirmation")
            
            # Update status to in_progress
            mission_item.status = "in_progress"
            mission_item.updated_at = datetime.utcnow()
            
            # Simulate action execution based on action type
            success, message, results = await self._execute_action(mission_item, request.parameters)
            
            # Update final status
            mission_item.status = "completed" if success else "failed"
            mission_item.updated_at = datetime.utcnow()
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ExecuteMissionActionResponse(
                success=success,
                message=message,
                mission_id=request.mission_id,
                execution_time=execution_time,
                results=results,
                updated_mission_item=mission_item
            )
            
        except Exception as e:
            # Mark as failed if in our items
            if request.mission_id in self.mission_items:
                self.mission_items[request.mission_id].status = "failed"
                self.mission_items[request.mission_id].updated_at = datetime.utcnow()
            
            execution_time = (datetime.utcnow() - start_time).total_seconds()
            
            return ExecuteMissionActionResponse(
                success=False,
                message=f"Action failed: {str(e)}",
                mission_id=request.mission_id,
                execution_time=execution_time
            )
    
    async def _execute_action(self, mission_item: MissionItem, parameters: Optional[Dict[str, Any]]) -> tuple[bool, str, Optional[Dict[str, Any]]]:
        """Execute the actual mission action"""
        # Simulate different action types
        if mission_item.action_type == MissionActionType.SYNC:
            await asyncio.sleep(0.5)  # Simulate API call
            return True, f"Successfully synced {mission_item.category.value} data", {"synced_items": 42}
            
        elif mission_item.action_type == MissionActionType.CLEANUP:
            await asyncio.sleep(0.2)  # Simulate cleanup
            return True, f"Cleaned up {mission_item.category.value} data", {"cleaned_items": 157}
            
        elif mission_item.action_type == MissionActionType.OPTIMIZE:
            await asyncio.sleep(1.0)  # Simulate optimization
            return True, f"Optimized {mission_item.category.value} performance", {"improvement": "15% faster"}
            
        elif mission_item.action_type == MissionActionType.UPDATE:
            await asyncio.sleep(1.5)  # Simulate update
            return True, f"Updated {mission_item.category.value} configuration", {"version": "2.1.0"}
            
        elif mission_item.action_type == MissionActionType.REVIEW:
            await asyncio.sleep(0.3)  # Simulate review
            return True, f"Reviewed {mission_item.category.value} status", {"issues_found": 2}
            
        else:
            return True, f"Completed {mission_item.action_type.value} action", None
    
    async def create_mission_item(self, request: CreateMissionItemRequest) -> MissionItem:
        """Create a new mission control item"""
        mission_id = str(uuid.uuid4())
        
        # Calculate impact and effort scores if not provided
        impact_score = request.impact_score or self._calculate_impact_score(request.category, request.priority)
        effort_score = request.effort_score or self._calculate_effort_score(request.action_type)
        
        mission_item = MissionItem(
            id=mission_id,
            title=request.title,
            description=request.description,
            category=request.category,
            priority=request.priority,
            action_type=request.action_type,
            due_date=request.due_date,
            action_endpoint=request.action_endpoint,
            action_payload=request.action_payload,
            estimated_time=request.estimated_time,
            impact_score=impact_score,
            effort_score=effort_score,
            context_data=request.context_data,
            auto_executable=request.auto_executable,
            requires_confirmation=request.requires_confirmation
        )
        
        self.mission_items[mission_id] = mission_item
        return mission_item
    
    def _calculate_impact_score(self, category: MissionCategory, priority: MissionPriority) -> float:
        """Calculate impact score based on category and priority"""
        priority_multiplier = {
            MissionPriority.CRITICAL: 1.0,
            MissionPriority.HIGH: 0.8,
            MissionPriority.MEDIUM: 0.6,
            MissionPriority.LOW: 0.4,
            MissionPriority.INFO: 0.2
        }
        
        category_base = {
            MissionCategory.SYSTEM: 90,
            MissionCategory.SECURITY: 95,
            MissionCategory.PERFORMANCE: 80,
            MissionCategory.INTEGRATION: 75,
            MissionCategory.EMAIL: 60,
            MissionCategory.CALENDAR: 55,
            MissionCategory.DOCS: 50,
            MissionCategory.TASKS: 45
        }
        
        return category_base.get(category, 50) * priority_multiplier.get(priority, 0.5)
    
    def _calculate_effort_score(self, action_type: MissionActionType) -> float:
        """Calculate effort score based on action type"""
        effort_scores = {
            MissionActionType.MONITOR: 10,
            MissionActionType.SYNC: 20,
            MissionActionType.CLEANUP: 25,
            MissionActionType.REVIEW: 40,
            MissionActionType.CONFIGURE: 50,
            MissionActionType.OPTIMIZE: 60,
            MissionActionType.UPDATE: 70,
            MissionActionType.BACKUP: 30
        }
        
        return effort_scores.get(action_type, 50)
    
    async def get_analytics(self, time_period: str = "24h") -> MissionControlAnalytics:
        """Get mission control analytics"""
        items = list(self.mission_items.values())
        
        # Filter items by time period
        cutoff_time = datetime.utcnow()
        if time_period == "24h":
            cutoff_time -= timedelta(hours=24)
        elif time_period == "7d":
            cutoff_time -= timedelta(days=7)
        elif time_period == "30d":
            cutoff_time -= timedelta(days=30)
        
        recent_items = [item for item in items if item.created_at >= cutoff_time]
        
        # Calculate metrics
        completed = len([i for i in recent_items if i.status == "completed"])
        dismissed = len([i for i in recent_items if i.status == "dismissed"])
        failed = len([i for i in recent_items if i.status == "failed"])
        
        # Category breakdown
        category_breakdown = {}
        for category in MissionCategory:
            category_breakdown[category] = len([i for i in recent_items if i.category == category])
        
        # Priority breakdown
        priority_breakdown = {}
        for priority in MissionPriority:
            priority_breakdown[priority] = len([i for i in recent_items if i.priority == priority])
        
        return MissionControlAnalytics(
            time_period=time_period,
            items_completed=completed,
            items_dismissed=dismissed,
            items_failed=failed,
            average_completion_time=8.5,  # Mock data
            category_breakdown=category_breakdown,
            priority_breakdown=priority_breakdown,
            productivity_trend=12.5,
            efficiency_trend=8.3,
            top_recurring_issues=[
                "Calendar sync delays",
                "Email processing optimization needed",
                "Document collaboration bottlenecks"
            ],
            improvement_suggestions=[
                "Implement automated sync scheduling",
                "Batch process emails during off-peak hours",
                "Upgrade document processing pipeline"
            ]
        ) 