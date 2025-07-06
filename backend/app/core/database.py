import os
from typing import Optional, Dict, Any, List
from supabase import create_client, Client
import asyncpg
import asyncio
from contextlib import asynccontextmanager
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

class SupabaseManager:
    """Manages Supabase client and database operations"""
    
    def __init__(self):
        self.client: Optional[Client] = None
        self.url = os.getenv("SUPABASE_URL")
        self.anon_key = os.getenv("SUPABASE_ANON_KEY")
        self.service_key = os.getenv("SUPABASE_SERVICE_KEY")
        
    def initialize(self) -> bool:
        """Initialize Supabase client"""
        try:
            if not self.url or not self.anon_key:
                logger.warning("Supabase credentials not found in environment")
                return False
                
            self.client = create_client(self.url, self.anon_key)
            logger.info("✓ Supabase client initialized successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Supabase client: {e}")
            return False
    
    def get_client(self) -> Optional[Client]:
        """Get Supabase client"""
        if not self.client:
            self.initialize()
        return self.client
    
    async def test_connection(self) -> bool:
        """Test database connection"""
        try:
            if not self.client:
                return False
                
            # Try a simple query
            result = self.client.from_("user_profiles").select("count", count="exact").execute()
            logger.info(f"✓ Database connection test successful: {result.count} users")
            return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False

    async def store_voice_interaction(
        self, 
        user_id: str,
        transcribed_text: str,
        confidence: float,
        response_text: str,
        processing_time_ms: int,
        platform_context: Dict[str, Any]
    ) -> Optional[str]:
        """Store voice interaction in database"""
        try:
            if not self.client:
                logger.warning("Supabase client not initialized")
                return None
                
            data = {
                "user_id": user_id,
                "transcribed_text": transcribed_text,
                "confidence": confidence,
                "response_text": response_text,
                "processing_time_ms": processing_time_ms,
                "platform_context": platform_context
            }
            
            result = self.client.from_("voice_interactions").insert(data).execute()
            
            if result.data:
                interaction_id = result.data[0]["id"]
                logger.info(f"✓ Voice interaction stored: {interaction_id}")
                return interaction_id
            else:
                logger.error("Failed to store voice interaction: no data returned")
                return None
                
        except Exception as e:
            logger.error(f"Error storing voice interaction: {e}")
            return None
    
    async def store_conversation(
        self,
        user_id: str,
        session_id: str,
        message_type: str,
        content: str,
        metadata: Dict[str, Any] = None
    ) -> Optional[str]:
        """Store conversation message"""
        try:
            if not self.client:
                return None
                
            data = {
                "user_id": user_id,
                "session_id": session_id,
                "message_type": message_type,
                "content": content,
                "metadata": metadata or {}
            }
            
            result = self.client.from_("conversations").insert(data).execute()
            
            if result.data:
                return result.data[0]["id"]
            return None
                
        except Exception as e:
            logger.error(f"Error storing conversation: {e}")
            return None

    async def get_user_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get user profile by ID"""
        try:
            if not self.client:
                return None
                
            result = self.client.from_("user_profiles").select("*").eq("id", user_id).execute()
            
            if result.data:
                return result.data[0]
            return None
                
        except Exception as e:
            logger.error(f"Error getting user profile: {e}")
            return None

    async def get_platform_integration(self, user_id: str, platform: str) -> Optional[Dict[str, Any]]:
        """Get platform integration for user"""
        try:
            if not self.client:
                return None
                
            result = self.client.from_("platform_integrations").select("*").eq("user_id", user_id).eq("platform_name", platform).eq("is_active", True).execute()
            
            if result.data:
                return result.data[0]
            return None
                
        except Exception as e:
            logger.error(f"Error getting platform integration: {e}")
            return None

    async def store_platform_integration(
        self,
        user_id: str,
        platform: str,
        access_token: str,
        refresh_token: str = None,
        settings: Dict[str, Any] = None
    ) -> bool:
        """Store or update platform integration"""
        try:
            if not self.client:
                return False
                
            data = {
                "user_id": user_id,
                "platform_name": platform,
                "access_token": access_token,
                "refresh_token": refresh_token,
                "integration_settings": settings or {},
                "is_active": True
            }
            
            # Upsert (insert or update)
            result = self.client.from_("platform_integrations").upsert(data).execute()
            
            return len(result.data) > 0
                
        except Exception as e:
            logger.error(f"Error storing platform integration: {e}")
            return False

    async def get_recent_interactions(self, user_id: str, limit: int = 10) -> list:
        """Get recent voice interactions for user"""
        try:
            if not self.client:
                return []
                
            result = self.client.from_("voice_interactions").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
            
            return result.data or []
                
        except Exception as e:
            logger.error(f"Error getting recent interactions: {e}")
            return []

    async def create_task(self, task_data: Dict[str, Any], user_id: str) -> Optional[Dict[str, Any]]:
        """Creates a new task in the database."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return None

        try:
            # Ensure user_id is in the data
            task_data['user_id'] = user_id
            
            # Insert the new task
            result = self.client.from_("tasks").insert(task_data).execute()
            
            if result.data:
                logger.info(f"✓ Task created successfully: {result.data[0]['id']}")
                return result.data[0]
            else:
                logger.error(f"Failed to create task, no data returned. Supabase error: {getattr(result, 'error', 'N/A')}")
                return None
        except Exception as e:
            logger.error(f"Error creating task in Supabase: {e}")
            return None

    async def get_task_by_id(self, task_id: str, user_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single task by its ID."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return None
        try:
            result = self.client.from_("tasks").select("*").eq("id", task_id).eq("user_id", user_id).single().execute()
            if result.data:
                return result.data
            else:
                logger.warning(f"Task with id {task_id} not found for user {user_id}.")
                return None
        except Exception as e:
            logger.error(f"Error retrieving task {task_id}: {e}")
            return None

    async def get_tasks(self, user_id: str, offset: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Retrieves a list of tasks for a user."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return []
        try:
            result = self.client.from_("tasks").select("*").eq("user_id", user_id).order("created_at", desc=True).range(offset, offset + limit - 1).execute()
            return result.data or []
        except Exception as e:
            logger.error(f"Error retrieving tasks for user {user_id}: {e}")
            return []

    async def update_task(self, task_id: str, user_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates a task in the database."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return None
        try:
            # Ensure user_id is not changed
            if 'user_id' in update_data:
                del update_data['user_id']
            if 'id' in update_data:
                del update_data['id']

            result = self.client.from_("tasks").update(update_data).eq("id", task_id).eq("user_id", user_id).execute()
            
            if result.data:
                logger.info(f"✓ Task updated successfully: {result.data[0]['id']}")
                return result.data[0]
            else:
                logger.error(f"Failed to update task {task_id}. Supabase error: {getattr(result, 'error', 'N/A')}")
                return None
        except Exception as e:
            logger.error(f"Error updating task {task_id} in Supabase: {e}")
            return None

    async def delete_task(self, task_id: str, user_id: str) -> bool:
        """Deletes a task from the database."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return False
        try:
            result = self.client.from_("tasks").delete().eq("id", task_id).eq("user_id", user_id).execute()
            
            if result.data:
                logger.info(f"✓ Task deleted successfully: {task_id}")
                return True
            else:
                # Check if the task simply didn't exist
                check_res = await self.get_task_by_id(task_id, user_id)
                if not check_res:
                    logger.warning(f"Task {task_id} did not exist for deletion.")
                    return True # Idempotent: already deleted
                logger.error(f"Failed to delete task {task_id}. Supabase error: {getattr(result, 'error', 'N/A')}")
                return False
        except Exception as e:
            logger.error(f"Error deleting task {task_id} in Supabase: {e}")
            return False

    async def store_google_channel(self, user_id: str, channel_id: str, resource_id: str, expires_at: datetime) -> bool:
        """Stores or updates a Google Calendar webhook channel."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return False
        try:
            data = {
                "user_id": user_id,
                "channel_id": channel_id,
                "resource_id": resource_id,
                "expires_at": expires_at.isoformat(),
            }
            # Use upsert to handle both creation of a new channel and updates to an existing one for the user
            result = self.client.from_("google_calendar_channels").upsert(data, on_conflict="channel_id").execute()
            
            if result.data:
                logger.info(f"✓ Google Calendar channel stored successfully for user {user_id}: {channel_id}")
                return True
            else:
                logger.error(f"Failed to store Google Calendar channel. Supabase error: {getattr(result, 'error', 'N/A')}")
                return False
        except Exception as e:
            logger.error(f"Error storing Google channel for user {user_id}: {e}")
            return False

    async def get_user_from_channel_id(self, channel_id: str) -> Optional[str]:
        """Retrieves a user_id from a Google Calendar channel_id."""
        if not self.client:
            logger.warning("Supabase client not initialized")
            return None
        try:
            result = self.client.from_("google_calendar_channels").select("user_id").eq("channel_id", channel_id).single().execute()
            if result.data:
                return result.data['user_id']
            else:
                logger.warning(f"No user found for channel_id {channel_id}.")
                return None
        except Exception as e:
            logger.error(f"Error retrieving user from channel_id {channel_id}: {e}")
            return None

# Global instance
supabase_manager = SupabaseManager()

def get_database() -> SupabaseManager:
    """Get database manager instance"""
    return supabase_manager

async def init_database():
    """Initialize database connection"""
    success = supabase_manager.initialize()
    if success:
        await supabase_manager.test_connection()
    return success 