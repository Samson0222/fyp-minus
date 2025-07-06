from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime
from enum import Enum

class ConversationTurn(BaseModel):
    """Individual turn in a conversation"""
    turn_id: str = Field(..., description="Unique identifier for this turn")
    user_message: str = Field(..., description="User's message")
    ai_response: str = Field(..., description="AI's response")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Context and metadata
    platform: str = Field(default="general", description="Platform context (gmail, docs, tasks, etc.)")
    intent: Optional[str] = Field(None, description="Detected user intent")
    entities: List[Dict[str, Any]] = Field(default_factory=list, description="Extracted entities")
    sentiment: Optional[str] = Field(None, description="User message sentiment")
    confidence: float = Field(default=0.0, description="AI confidence in response")
    
    # Processing metadata
    processing_time_ms: int = Field(default=0)
    model_used: str = Field(default="enhanced_llm")
    context_tokens_used: int = Field(default=0)
    
class ConversationContext(BaseModel):
    """Context information for maintaining conversation continuity"""
    user_id: str = Field(..., description="User identifier")
    session_id: str = Field(..., description="Conversation session identifier")
    platform: str = Field(default="general", description="Platform context")
    
    # Conversation history
    turns: List[ConversationTurn] = Field(default_factory=list, description="Recent conversation turns")
    start_time: datetime = Field(default_factory=datetime.utcnow)
    last_activity: datetime = Field(default_factory=datetime.utcnow)
    
    # User context and preferences
    user_profile: Optional[Dict[str, Any]] = Field(None, description="User profile and preferences")
    current_task_context: Optional[Dict[str, Any]] = Field(None, description="Current task or workflow context")
    
    # Memory and learning
    key_facts: List[str] = Field(default_factory=list, description="Important facts about user from conversation")
    preferences: Dict[str, Any] = Field(default_factory=dict, description="Learned user preferences")
    
    # System state
    active_integrations: List[str] = Field(default_factory=list, description="Currently active platform integrations")
    pending_actions: List[Dict[str, Any]] = Field(default_factory=list, description="Actions waiting for completion")

class PersonalityProfile(BaseModel):
    """AI personality and communication style profile"""
    name: str = Field(default="Minus", description="AI assistant name")
    style: Literal["professional", "casual", "friendly", "concise", "detailed"] = Field(default="friendly")
    formality_level: float = Field(default=0.6, description="Formality level (0=very casual, 1=very formal)")
    enthusiasm_level: float = Field(default=0.7, description="Enthusiasm level (0=neutral, 1=very enthusiastic)")
    
    # Communication preferences
    use_emojis: bool = Field(default=True)
    verbosity: Literal["concise", "balanced", "detailed"] = Field(default="balanced")
    explanation_style: Literal["step-by-step", "overview", "technical"] = Field(default="overview")
    
    # Specialized knowledge emphasis
    expertise_areas: List[str] = Field(default_factory=lambda: ["productivity", "email", "calendar", "documents"])

class ContextualPrompt(BaseModel):
    """Enhanced prompt with context and personalization"""
    base_prompt: str = Field(..., description="Base system prompt")
    context_summary: str = Field(default="", description="Relevant conversation context")
    user_profile_context: str = Field(default="", description="User-specific context")
    platform_context: str = Field(default="", description="Platform-specific context")
    
    # Memory integration
    relevant_history: List[str] = Field(default_factory=list, description="Relevant previous interactions")
    key_facts: List[str] = Field(default_factory=list, description="Important user facts")
    
    # Task context
    current_task: Optional[str] = Field(None, description="Current task or goal")
    workflow_state: Optional[Dict[str, Any]] = Field(None, description="Current workflow state")

class IntelligentResponse(BaseModel):
    """Enhanced AI response with metadata"""
    response_text: str = Field(..., description="AI response text")
    confidence: float = Field(..., description="Response confidence (0-1)")
    
    # Response metadata
    intent_addressed: str = Field(..., description="User intent that was addressed")
    response_type: Literal["answer", "question", "action", "clarification"] = Field(..., description="Type of response")
    
    # Follow-up suggestions
    suggested_actions: List[str] = Field(default_factory=list, description="Suggested follow-up actions")
    clarifying_questions: List[str] = Field(default_factory=list, description="Questions to clarify user intent")
    
    # Context updates
    context_updates: Dict[str, Any] = Field(default_factory=dict, description="Updates to conversation context")
    learned_facts: List[str] = Field(default_factory=list, description="New facts learned about user")
    
    # Processing metadata
    tokens_used: int = Field(default=0)
    processing_time_ms: int = Field(default=0)
    model_temperature: float = Field(default=0.7)

class DialogueMemoryEntry(BaseModel):
    """Entry in the dialogue memory system"""
    memory_id: str = Field(..., description="Unique memory identifier")
    user_id: str = Field(..., description="User this memory belongs to")
    
    # Memory content
    content: str = Field(..., description="Memory content")
    category: Literal["fact", "preference", "goal", "context", "relationship"] = Field(..., description="Type of memory")
    importance: float = Field(..., description="Importance score (0-1)")
    
    # Memory metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_accessed: datetime = Field(default_factory=datetime.utcnow)
    access_count: int = Field(default=0)
    confidence: float = Field(default=1.0, description="Confidence in memory accuracy")
    
    # Associated data
    source_session: Optional[str] = Field(None, description="Session where memory was created")
    related_platform: Optional[str] = Field(None, description="Platform where memory originated")
    tags: List[str] = Field(default_factory=list, description="Memory tags for retrieval")

class EnhanceDialogueRequest(BaseModel):
    """Request to enhance dialogue with intelligence"""
    user_message: str = Field(..., description="User's message")
    user_id: str = Field(..., description="User identifier")
    session_id: Optional[str] = Field(None, description="Session ID (auto-generated if not provided)")
    platform: str = Field(default="general", description="Platform context")
    
    # Context overrides
    current_task_context: Optional[Dict[str, Any]] = Field(None)
    force_personality: Optional[PersonalityProfile] = Field(None)
    
    # Processing options
    include_memory: bool = Field(default=True, description="Include conversation memory")
    include_suggestions: bool = Field(default=True, description="Include follow-up suggestions")
    max_context_turns: int = Field(default=5, description="Maximum previous turns to include")

class EnhanceDialogueResponse(BaseModel):
    """Response from enhanced dialogue processing"""
    enhanced_response: IntelligentResponse
    conversation_context: ConversationContext
    
    # Processing insights
    memory_used: List[DialogueMemoryEntry] = Field(default_factory=list)
    context_summary: str = Field(default="", description="Summary of context used")
    
    # System recommendations
    system_suggestions: List[str] = Field(default_factory=list, description="Suggestions for user workflow")
    integration_opportunities: List[str] = Field(default_factory=list, description="Potential platform integrations")

class MemorySearchRequest(BaseModel):
    """Request to search dialogue memory"""
    user_id: str = Field(..., description="User to search memories for")
    query: str = Field(..., description="Search query")
    
    # Search options
    category_filter: Optional[List[str]] = Field(None, description="Filter by memory categories")
    platform_filter: Optional[str] = Field(None, description="Filter by platform")
    min_importance: float = Field(default=0.0, description="Minimum importance threshold")
    max_results: int = Field(default=10, description="Maximum results to return")

class MemorySearchResponse(BaseModel):
    """Response from memory search"""
    memories: List[DialogueMemoryEntry] = Field(..., description="Matching memories")
    total_found: int = Field(..., description="Total memories found")
    search_time_ms: int = Field(..., description="Search processing time")

class CreateMemoryRequest(BaseModel):
    """Request to create a new memory entry"""
    user_id: str = Field(..., description="User this memory belongs to")
    content: str = Field(..., description="Memory content")
    category: Literal["fact", "preference", "goal", "context", "relationship"] = Field(..., description="Memory type")
    importance: float = Field(default=0.5, description="Importance score (0-1)")
    
    # Optional metadata
    platform: Optional[str] = Field(None, description="Associated platform")
    tags: List[str] = Field(default_factory=list, description="Memory tags")
    session_id: Optional[str] = Field(None, description="Associated session")

class DialogueAnalytics(BaseModel):
    """Analytics for dialogue performance"""
    user_id: str = Field(..., description="User identifier")
    time_period: Literal["24h", "7d", "30d"] = Field(default="24h")
    
    # Conversation metrics
    total_conversations: int = Field(default=0)
    total_turns: int = Field(default=0)
    average_turns_per_conversation: float = Field(default=0.0)
    average_response_time_ms: float = Field(default=0.0)
    
    # Intelligence metrics
    memory_entries_created: int = Field(default=0)
    memory_entries_used: int = Field(default=0)
    context_retention_score: float = Field(default=0.0, description="How well context is maintained")
    
    # User satisfaction indicators
    successful_task_completions: int = Field(default=0)
    clarification_requests: int = Field(default=0)
    user_corrections: int = Field(default=0)
    
    # Platform distribution
    platform_usage: Dict[str, int] = Field(default_factory=dict)
    intent_distribution: Dict[str, int] = Field(default_factory=dict)
    
    # Improvement insights
    improvement_suggestions: List[str] = Field(default_factory=list)
    knowledge_gaps: List[str] = Field(default_factory=list) 