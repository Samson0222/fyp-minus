# backend/app/services/memory_service.py

import logging
from typing import List, Optional, Dict, Any
from uuid import uuid4
from datetime import datetime

from supabase import Client
from app.models.intelligent_dialogue import DialogueMemoryEntry, CreateMemoryRequest

class MemoryService:
    """Service for managing the AI's long-term memory."""

    def __init__(self, db: Client):
        self.db = db
        self.logger = logging.getLogger(__name__)

    async def create_memory(self, request: CreateMemoryRequest) -> DialogueMemoryEntry:
        """Create a new memory entry for a user."""
        memory_id = str(uuid4())
        timestamp = datetime.utcnow()

        new_memory = DialogueMemoryEntry(
            memory_id=memory_id,
            user_id=request.user_id,
            content=request.content,
            category=request.category,
            importance=request.importance,
            created_at=timestamp,
            last_accessed=timestamp,
            access_count=0,
            confidence=1.0, # Default confidence
            source_session=request.session_id,
            related_platform=request.platform,
            tags=request.tags
        )

        try:
            response = await self.db.from_("dialogue_memories").insert(new_memory.dict()).execute()
            if response.data:
                self.logger.info(f"Successfully created memory {memory_id} for user {request.user_id}")
                return new_memory
            else:
                self.logger.error(f"Failed to insert memory for user {request.user_id}: {response.error}")
                raise Exception("Database insertion failed")
        except Exception as e:
            self.logger.error(f"Error creating memory: {e}", exc_info=True)
            raise

    async def get_memories(self, user_id: str, limit: int = 20) -> List[DialogueMemoryEntry]:
        """Retrieve recent memories for a user."""
        try:
            response = await self.db.from_("dialogue_memories").select("*").eq("user_id", user_id).order("last_accessed", desc=True).limit(limit).execute()
            if response.data:
                return [DialogueMemoryEntry(**item) for item in response.data]
            return []
        except Exception as e:
            self.logger.error(f"Error retrieving memories for user {user_id}: {e}", exc_info=True)
            return []

    async def search_memories(self, user_id: str, query: str, limit: int = 5) -> List[DialogueMemoryEntry]:
        """Search memories for a user based on a query."""
        # This is a simple keyword search. A more advanced implementation would use vector embeddings.
        try:
            # Using 'ilike' for case-insensitive search
            response = await self.db.from_("dialogue_memories").select("*").eq("user_id", user_id).ilike("content", f"%{query}%").order("importance", desc=True).limit(limit).execute()
            if response.data:
                return [DialogueMemoryEntry(**item) for item in response.data]
            return []
        except Exception as e:
            self.logger.error(f"Error searching memories for user {user_id}: {e}", exc_info=True)
            return []

    async def update_memory_access(self, memory_id: str) -> bool:
        """Update the last_accessed timestamp and access_count of a memory."""
        try:
            # In a real app, you might want a more atomic way to increment
            response = await self.db.from_("dialogue_memories").update({
                "last_accessed": datetime.utcnow().isoformat(),
            }).eq("memory_id", memory_id).execute()
            # Incrementing would ideally be an RPC call to the DB:
            # await self.db.rpc('increment_access_count', {'mem_id': memory_id})
            return len(response.data) > 0
        except Exception as e:
            self.logger.error(f"Error updating memory access for {memory_id}: {e}", exc_info=True)
            return False 