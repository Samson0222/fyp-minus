# from fastapi import APIRouter, HTTPException, Depends
# from typing import Optional

# from ..models.mission_control import (
#     MissionDashboardData, ExecuteMissionActionRequest, ExecuteMissionActionResponse,
#     MissionControlAnalytics, CreateMissionItemRequest, MissionItem,
#     UpdateMissionItemRequest
# )
# from ..services.mission_control_service import MissionControlService

# router = APIRouter(prefix="/api/v1/mission-control", tags=["mission-control"])

# # Dependency to get mission control service
# def get_mission_control_service() -> MissionControlService:
#     # The service now gets the LLM from the factory internally.
#     return MissionControlService()

# @router.get("/dashboard", response_model=MissionDashboardData)
# async def get_mission_control_dashboard(
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """
#     Get complete mission control dashboard data including:
#     - System health metrics
#     - Mission items sorted by priority
#     - Quick actions and recommendations
#     - Productivity insights
#     - Integration status
#     - Recent activities
#     """
#     try:
#         dashboard_data = await service.get_dashboard_data()
#         return dashboard_data
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to load dashboard: {str(e)}")

# @router.post("/execute", response_model=ExecuteMissionActionResponse)
# async def execute_mission_action(
#     request: ExecuteMissionActionRequest,
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """
#     Execute a mission control action.
#     Supports both manual and automatic execution of system optimization tasks.
#     """
#     try:
#         response = await service.execute_mission_action(request)
#         return response
#     except HTTPException:
#         raise
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to execute action: {str(e)}")

# @router.get("/analytics", response_model=MissionControlAnalytics)
# async def get_mission_control_analytics(
#     time_period: str = "24h",
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """
#     Get mission control analytics and trends.
    
#     Args:
#         time_period: Analysis period ("24h", "7d", "30d")
#     """
#     if time_period not in ["24h", "7d", "30d"]:
#         raise HTTPException(status_code=400, detail="Invalid time period. Use '24h', '7d', or '30d'")
    
#     try:
#         analytics = await service.get_analytics(time_period)
#         return analytics
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to get analytics: {str(e)}")

# @router.post("/items", response_model=MissionItem)
# async def create_mission_item(
#     request: CreateMissionItemRequest,
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """
#     Create a new mission control item.
#     Used for adding custom monitoring items or manual tasks.
#     """
#     try:
#         mission_item = await service.create_mission_item(request)
#         return mission_item
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to create mission item: {str(e)}")

# @router.get("/items/{mission_id}", response_model=MissionItem)
# async def get_mission_item(
#     mission_id: str,
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """Get a specific mission item by ID"""
#     mission_item = service.mission_items.get(mission_id)
#     if not mission_item:
#         raise HTTPException(status_code=404, detail="Mission item not found")
#     return mission_item

# @router.patch("/items/{mission_id}", response_model=MissionItem)
# async def update_mission_item(
#     mission_id: str,
#     request: UpdateMissionItemRequest,
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """
#     Update a mission item.
#     Allows updating status, priority, and other fields.
#     """
#     mission_item = service.mission_items.get(mission_id)
#     if not mission_item:
#         raise HTTPException(status_code=404, detail="Mission item not found")
    
#     try:
#         # Update fields if provided
#         if request.status is not None:
#             mission_item.status = request.status
#         if request.priority is not None:
#             mission_item.priority = request.priority
#         if request.due_date is not None:
#             mission_item.due_date = request.due_date
#         if request.context_data is not None:
#             mission_item.context_data = request.context_data
#         if request.title is not None:
#             mission_item.title = request.title
#         if request.description is not None:
#             mission_item.description = request.description
#         if request.estimated_time is not None:
#             mission_item.estimated_time = request.estimated_time
#         if request.impact_score is not None:
#             mission_item.impact_score = request.impact_score
#         if request.effort_score is not None:
#             mission_item.effort_score = request.effort_score
        
#         # Update timestamp
#         from datetime import datetime
#         mission_item.updated_at = datetime.utcnow()
        
#         return mission_item
        
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to update mission item: {str(e)}")

# @router.delete("/items/{mission_id}")
# async def delete_mission_item(
#     mission_id: str,
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """Delete a mission item"""
#     if mission_id not in service.mission_items:
#         raise HTTPException(status_code=404, detail="Mission item not found")
    
#     del service.mission_items[mission_id]
#     return {"message": "Mission item deleted successfully"}

# @router.post("/items/{mission_id}/dismiss")
# async def dismiss_mission_item(
#     mission_id: str,
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """Dismiss a mission item (mark as dismissed)"""
#     mission_item = service.mission_items.get(mission_id)
#     if not mission_item:
#         raise HTTPException(status_code=404, detail="Mission item not found")
    
#     if not mission_item.user_dismissible:
#         raise HTTPException(status_code=400, detail="Mission item cannot be dismissed")
    
#     mission_item.status = "dismissed"
#     from datetime import datetime
#     mission_item.updated_at = datetime.utcnow()
    
#     return {"message": "Mission item dismissed", "mission_item": mission_item}

# @router.get("/health")
# async def get_system_health(
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """Get current system health status (lightweight endpoint)"""
#     try:
#         dashboard_data = await service.get_dashboard_data()
#         return {
#             "system_health": dashboard_data.system_health,
#             "critical_items": len([item for item in dashboard_data.mission_items if item.priority.value == "critical"]),
#             "pending_actions": len([item for item in dashboard_data.mission_items if item.status == "pending"])
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to get system health: {str(e)}")

# @router.post("/refresh")
# async def refresh_mission_control(
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """
#     Manually refresh mission control analysis.
#     Triggers a fresh analysis of system state and generates new recommendations.
#     """
#     try:
#         # In a real implementation, this would trigger a full system scan
#         # For now, we'll simulate a refresh by returning current state
#         dashboard_data = await service.get_dashboard_data()
        
#         return {
#             "message": "Mission control refreshed successfully",
#             "timestamp": dashboard_data.system_health.last_check,
#             "total_items": dashboard_data.system_health.total_items,
#             "health_score": dashboard_data.system_health.overall_score
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to refresh mission control: {str(e)}")

# @router.get("/quick-actions")
# async def get_quick_actions(
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """Get quick actions for immediate execution"""
#     try:
#         dashboard_data = await service.get_dashboard_data()
#         return {
#             "quick_actions": dashboard_data.quick_actions,
#             "count": len(dashboard_data.quick_actions)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to get quick actions: {str(e)}")

# @router.get("/recommendations")
# async def get_recommendations(
#     service: MissionControlService = Depends(get_mission_control_service)
# ):
#     """Get AI-generated recommendations for system optimization"""
#     try:
#         dashboard_data = await service.get_dashboard_data()
#         return {
#             "recommendations": dashboard_data.recommendations,
#             "productivity_insights": dashboard_data.productivity_insights,
#             "count": len(dashboard_data.recommendations)
#         }
#     except Exception as e:
#         raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}") 