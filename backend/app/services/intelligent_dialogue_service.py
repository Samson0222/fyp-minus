import uuid
import json
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from fastapi import HTTPException

from ..models.intelligent_dialogue import (
    ConversationTurn, ConversationContext, PersonalityProfile,
    ContextualPrompt, IntelligentResponse, DialogueMemoryEntry,
    EnhanceDialogueRequest, EnhanceDialogueResponse,
    MemorySearchRequest, MemorySearchResponse, CreateMemoryRequest,
    DialogueAnalytics
)
from ..core.enhanced_llm_service import EnhancedLLMService

class IntelligentDialogueService:
    """
    Enhanced dialogue service with memory, context awareness, and personalization.
    Provides intelligent conversation capabilities that learn and adapt to users.
    """
    
    def __init__(self, llm_service: EnhancedLLMService):
        self.llm_service = llm_service
        
        # In-memory storage (in production, use proper database)
        self.conversation_contexts: Dict[str, ConversationContext] = {}
        self.dialogue_memories: Dict[str, List[DialogueMemoryEntry]] = {}
        self.user_personalities: Dict[str, PersonalityProfile] = {}
        
        # Initialize with sample data
        self._initialize_sample_data()
    
    def _initialize_sample_data(self):
        """Initialize with sample memories and personality profiles"""
        # Sample user memories
        sample_user_id = "cbede3b0-2f68-47df-9c26-09a46e588567"
        sample_memories = [
            {
                "content": "User prefers concise responses and doesn't like verbose explanations",
                "category": "preference",
                "importance": 0.8,
                "platform": "general",
                "tags": ["communication", "style"]
            },
            {
                "content": "User works in tech industry and frequently handles emails about project deadlines",
                "category": "context",
                "importance": 0.9,
                "platform": "gmail",
                "tags": ["work", "projects", "deadlines"]
            },
            {
                "content": "User mentioned they have important client meeting every Tuesday at 2 PM",
                "category": "fact",
                "importance": 0.7,
                "platform": "calendar",
                "tags": ["meetings", "schedule", "clients"]
            },
            {
                "content": "User wants to improve productivity and automate repetitive tasks",
                "category": "goal",
                "importance": 0.9,
                "platform": "general",
                "tags": ["productivity", "automation", "goals"]
            }
        ]
        
        memories = []
        for memory_data in sample_memories:
            memory = DialogueMemoryEntry(
                memory_id=str(uuid.uuid4()),
                user_id=sample_user_id,
                **memory_data
            )
            memories.append(memory)
        
        self.dialogue_memories[sample_user_id] = memories
        
        # Default personality profile
        default_personality = PersonalityProfile(
            name="Minus",
            style="friendly",
            formality_level=0.6,
            enthusiasm_level=0.7,
            use_emojis=True,
            verbosity="balanced",
            explanation_style="overview"
        )
        self.user_personalities["default"] = default_personality
    
    async def enhance_dialogue(self, request: EnhanceDialogueRequest) -> EnhanceDialogueResponse:
        """Main method to enhance dialogue with intelligence and context"""
        start_time = datetime.utcnow()
        
        try:
            # Generate or get session ID
            session_id = request.session_id or str(uuid.uuid4())
            
            # Get or create conversation context
            context_key = f"{request.user_id}:{session_id}"
            context = self.conversation_contexts.get(
                context_key,
                ConversationContext(
                    user_id=request.user_id,
                    session_id=session_id,
                    platform=request.platform
                )
            )
            
            # Retrieve relevant memories
            relevant_memories = []
            if request.include_memory:
                relevant_memories = await self._search_relevant_memories(
                    request.user_id,
                    request.user_message,
                    request.platform
                )
            
            # Get personality profile
            personality = request.force_personality or self._get_user_personality(request.user_id)
            
            # Build contextual prompt
            contextual_prompt = await self._build_contextual_prompt(
                request.user_message,
                context,
                relevant_memories,
                personality,
                request.current_task_context
            )
            
            # Generate enhanced response
            enhanced_response = await self._generate_intelligent_response(
                contextual_prompt,
                request,
                personality
            )
            
            # Create conversation turn
            turn = ConversationTurn(
                turn_id=str(uuid.uuid4()),
                user_message=request.user_message,
                ai_response=enhanced_response.response_text,
                platform=request.platform,
                processing_time_ms=int((datetime.utcnow() - start_time).total_seconds() * 1000)
            )
            
            # Update conversation context
            context.turns.append(turn)
            context.last_activity = datetime.utcnow()
            context.platform = request.platform
            
            # Keep only recent turns
            if len(context.turns) > request.max_context_turns:
                context.turns = context.turns[-request.max_context_turns:]
            
            # Learn from conversation
            await self._learn_from_interaction(
                request.user_id,
                request.user_message,
                enhanced_response,
                session_id,
                request.platform
            )
            
            # Store context
            self.conversation_contexts[context_key] = context
            
            # Generate system suggestions
            system_suggestions = await self._generate_system_suggestions(context, request.platform)
            integration_opportunities = self._identify_integration_opportunities(context)
            
            processing_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
            enhanced_response.processing_time_ms = processing_time
            
            return EnhanceDialogueResponse(
                enhanced_response=enhanced_response,
                conversation_context=context,
                memory_used=relevant_memories,
                context_summary=contextual_prompt.context_summary,
                system_suggestions=system_suggestions,
                integration_opportunities=integration_opportunities
            )
            
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to enhance dialogue: {str(e)}")
    
    async def _search_relevant_memories(
        self,
        user_id: str,
        query: str,
        platform: str
    ) -> List[DialogueMemoryEntry]:
        """Search for relevant memories based on query and context"""
        user_memories = self.dialogue_memories.get(user_id, [])
        if not user_memories:
            return []
        
        # Simple relevance scoring (in production, use vector embeddings)
        relevant_memories = []
        query_lower = query.lower()
        
        for memory in user_memories:
            score = 0.0
            
            # Content relevance
            content_words = memory.content.lower().split()
            query_words = query_lower.split()
            common_words = set(content_words) & set(query_words)
            if common_words:
                score += len(common_words) / len(query_words) * 0.4
            
            # Platform relevance
            if memory.related_platform == platform:
                score += 0.3
            
            # Tag relevance
            for tag in memory.tags:
                if tag.lower() in query_lower:
                    score += 0.2
            
            # Importance boost
            score *= (0.5 + memory.importance * 0.5)
            
            if score > 0.1:  # Threshold for relevance
                memory.last_accessed = datetime.utcnow()
                memory.access_count += 1
                relevant_memories.append((memory, score))
        
        # Sort by score and return top memories
        relevant_memories.sort(key=lambda x: x[1], reverse=True)
        return [memory for memory, score in relevant_memories[:3]]
    
    async def _build_contextual_prompt(
        self,
        user_message: str,
        context: ConversationContext,
        memories: List[DialogueMemoryEntry],
        personality: PersonalityProfile,
        task_context: Optional[Dict[str, Any]]
    ) -> ContextualPrompt:
        """Build enhanced prompt with context and personalization"""
        
        # Base system prompt with personality
        base_prompt = f"""You are {personality.name}, a {personality.style} AI assistant specializing in productivity and digital workflow optimization.

Communication Style:
- Formality level: {personality.formality_level} (0=casual, 1=formal)
- Enthusiasm: {personality.enthusiasm_level} (0=neutral, 1=enthusiastic)
- Verbosity: {personality.verbosity}
- Use emojis: {personality.use_emojis}
- Explanation style: {personality.explanation_style}

Your expertise areas: {', '.join(personality.expertise_areas)}

Always be helpful, accurate, and maintain conversation continuity."""
        
        # Context summary from recent turns
        context_summary = ""
        if context.turns:
            recent_topics = []
            for turn in context.turns[-3:]:
                # Extract key topics (simplified)
                if any(word in turn.user_message.lower() for word in ['email', 'gmail', 'message']):
                    recent_topics.append("email management")
                if any(word in turn.user_message.lower() for word in ['calendar', 'meeting', 'schedule']):
                    recent_topics.append("calendar scheduling")
                if any(word in turn.user_message.lower() for word in ['document', 'docs', 'write']):
                    recent_topics.append("document editing")
                if any(word in turn.user_message.lower() for word in ['task', 'todo', 'reminder']):
                    recent_topics.append("task management")
            
            if recent_topics:
                context_summary = f"Recent conversation topics: {', '.join(set(recent_topics))}"
        
        # User profile context from memories
        user_profile_context = ""
        if memories:
            preferences = [m.content for m in memories if m.category == "preference"]
            facts = [m.content for m in memories if m.category == "fact"]
            goals = [m.content for m in memories if m.category == "goal"]
            
            if preferences:
                user_profile_context += f"User preferences: {'; '.join(preferences[:2])}\n"
            if facts:
                user_profile_context += f"User context: {'; '.join(facts[:2])}\n"
            if goals:
                user_profile_context += f"User goals: {'; '.join(goals[:2])}\n"
        
        # Platform-specific context
        platform_context = f"Current platform: {context.platform}"
        if task_context:
            platform_context += f"\nCurrent task context: {json.dumps(task_context, indent=2)}"
        
        # Relevant conversation history
        relevant_history = []
        for turn in context.turns[-3:]:
            relevant_history.append(f"User: {turn.user_message}")
            relevant_history.append(f"Assistant: {turn.ai_response}")
        
        # Key facts from memories
        key_facts = [memory.content for memory in memories if memory.importance > 0.7]
        
        # Current task from context
        current_task = None
        if task_context and "current_task" in task_context:
            current_task = task_context["current_task"]
        
        return ContextualPrompt(
            base_prompt=base_prompt,
            context_summary=context_summary,
            user_profile_context=user_profile_context,
            platform_context=platform_context,
            relevant_history=relevant_history,
            key_facts=key_facts,
            current_task=current_task,
            workflow_state=task_context
        )
    
    async def _generate_intelligent_response(
        self,
        prompt: ContextualPrompt,
        request: EnhanceDialogueRequest,
        personality: PersonalityProfile
    ) -> IntelligentResponse:
        """Generate intelligent response using contextual prompt"""
        
        # Build full prompt for LLM
        full_prompt = f"""{prompt.base_prompt}

{prompt.user_profile_context}

{prompt.platform_context}

{prompt.context_summary}

Recent conversation:
{chr(10).join(prompt.relevant_history[-6:]) if prompt.relevant_history else "No recent history"}

Key facts about user:
{chr(10).join(f"- {fact}" for fact in prompt.key_facts) if prompt.key_facts else "No key facts available"}

Current user message: {request.user_message}

Respond in a {personality.style} manner with {personality.verbosity} explanations. Address the user's intent directly and provide helpful follow-up suggestions if appropriate."""
        
        try:
            # Use the enhanced LLM service
            llm_response = await self.llm_service.generate_response(
                full_prompt,
                temperature=0.7,
                max_tokens=500
            )
            
            response_text = llm_response.get("response", "I'm here to help! Could you please clarify your request?")
            
            # Analyze intent (simplified)
            intent = self._detect_intent(request.user_message)
            
            # Determine response type
            response_type = "answer"
            if "?" in response_text:
                response_type = "question"
            elif any(word in response_text.lower() for word in ["let me", "i'll", "i can"]):
                response_type = "action"
            elif any(word in response_text.lower() for word in ["clarify", "could you", "what do you mean"]):
                response_type = "clarification"
            
            # Generate suggestions if requested
            suggested_actions = []
            clarifying_questions = []
            
            if request.include_suggestions:
                suggested_actions = self._generate_follow_up_suggestions(request.user_message, intent, request.platform)
                if response_type == "clarification":
                    clarifying_questions = self._generate_clarifying_questions(request.user_message, intent)
            
            return IntelligentResponse(
                response_text=response_text,
                confidence=0.85,  # Mock confidence
                intent_addressed=intent,
                response_type=response_type,
                suggested_actions=suggested_actions,
                clarifying_questions=clarifying_questions,
                context_updates={},
                learned_facts=[],
                tokens_used=len(full_prompt.split()) + len(response_text.split()),
                model_temperature=0.7
            )
            
        except Exception as e:
            # Fallback response
            return IntelligentResponse(
                response_text=f"I'm here to help! I understand you want to {request.user_message.lower()}. Let me assist you with that.",
                confidence=0.5,
                intent_addressed="general_assistance",
                response_type="answer",
                suggested_actions=[],
                clarifying_questions=[],
                context_updates={},
                learned_facts=[],
                tokens_used=100,
                model_temperature=0.7
            )
    
    def _detect_intent(self, message: str) -> str:
        """Simple intent detection based on keywords"""
        message_lower = message.lower()
        
        # Email intents
        if any(word in message_lower for word in ['email', 'send', 'compose', 'reply', 'forward']):
            return "email_management"
        
        # Calendar intents  
        if any(word in message_lower for word in ['schedule', 'meeting', 'calendar', 'appointment']):
            return "calendar_management"
        
        # Document intents
        if any(word in message_lower for word in ['document', 'write', 'edit', 'docs', 'create']):
            return "document_management"
        
        # Task intents
        if any(word in message_lower for word in ['task', 'todo', 'reminder', 'deadline']):
            return "task_management"
        
        # Information seeking
        if any(word in message_lower for word in ['what', 'how', 'when', 'where', 'why', '?']):
            return "information_seeking"
        
        return "general_assistance"
    
    def _generate_follow_up_suggestions(self, message: str, intent: str, platform: str) -> List[str]:
        """Generate relevant follow-up action suggestions"""
        suggestions = []
        
        if intent == "email_management":
            suggestions = [
                "Check for important emails",
                "Set up email filters",
                "Schedule email send later",
                "Create email template"
            ]
        elif intent == "calendar_management":
            suggestions = [
                "Check today's schedule",
                "Find available meeting times",
                "Set reminder for upcoming events",
                "Create recurring meeting"
            ]
        elif intent == "document_management":
            suggestions = [
                "Create new document",
                "Share document with team",
                "Set up document template",
                "Review recent documents"
            ]
        elif intent == "task_management":
            suggestions = [
                "Add new task",
                "Review upcoming deadlines",
                "Create project checklist",
                "Set priority levels"
            ]
        else:
            suggestions = [
                "Show dashboard overview",
                "Check system status",
                "Review recent activity",
                "Get productivity insights"
            ]
        
        return suggestions[:3]  # Return top 3 suggestions
    
    def _generate_clarifying_questions(self, message: str, intent: str) -> List[str]:
        """Generate clarifying questions when intent is unclear"""
        if intent == "email_management":
            return [
                "Which email would you like me to help with?",
                "Are you looking to send or receive emails?",
                "Do you need help with a specific email account?"
            ]
        elif intent == "calendar_management":
            return [
                "What type of event would you like to schedule?",
                "When would you like this meeting to occur?",
                "Who should be invited to this event?"
            ]
        elif intent == "document_management":
            return [
                "What type of document do you want to create?",
                "Which document would you like me to help with?",
                "Do you want to edit or create a new document?"
            ]
        else:
            return [
                "Could you be more specific about what you'd like me to help with?",
                "What would you like to accomplish today?",
                "Which platform or feature are you interested in?"
            ]
    
    async def _learn_from_interaction(
        self,
        user_id: str,
        user_message: str,
        response: IntelligentResponse,
        session_id: str,
        platform: str
    ):
        """Learn new facts and preferences from the interaction"""
        
        # Extract potential new memories (simplified approach)
        message_lower = user_message.lower()
        
        # Detect preferences
        if any(phrase in message_lower for phrase in ["i prefer", "i like", "i don't like", "i hate"]):
            memory_content = f"User expressed preference: {user_message}"
            await self.create_memory(CreateMemoryRequest(
                user_id=user_id,
                content=memory_content,
                category="preference",
                importance=0.6,
                platform=platform,
                session_id=session_id,
                tags=["preference", "communication"]
            ))
        
        # Detect goals
        if any(phrase in message_lower for phrase in ["i want to", "i need to", "my goal", "i'm trying to"]):
            memory_content = f"User goal identified: {user_message}"
            await self.create_memory(CreateMemoryRequest(
                user_id=user_id,
                content=memory_content,
                category="goal",
                importance=0.8,
                platform=platform,
                session_id=session_id,
                tags=["goal", "objective"]
            ))
        
        # Detect important facts about work/schedule
        if any(phrase in message_lower for phrase in ["every day", "every week", "always", "never", "usually"]):
            memory_content = f"User pattern/habit: {user_message}"
            await self.create_memory(CreateMemoryRequest(
                user_id=user_id,
                content=memory_content,
                category="fact",
                importance=0.7,
                platform=platform,
                session_id=session_id,
                tags=["pattern", "habit", "schedule"]
            ))
    
    async def _generate_system_suggestions(self, context: ConversationContext, platform: str) -> List[str]:
        """Generate system-level suggestions for user workflow optimization"""
        suggestions = []
        
        # Analyze conversation patterns
        if len(context.turns) >= 3:
            recent_intents = []
            for turn in context.turns[-3:]:
                intent = self._detect_intent(turn.user_message)
                recent_intents.append(intent)
            
            # If user is frequently asking about the same thing, suggest automation
            if len(set(recent_intents)) == 1 and recent_intents[0] != "general_assistance":
                suggestions.append(f"Consider setting up automation for {recent_intents[0].replace('_', ' ')}")
        
        # Platform-specific suggestions
        if platform == "gmail":
            suggestions.append("Set up smart email filters to organize your inbox")
        elif platform == "calendar":
            suggestions.append("Enable calendar notifications for better schedule management")
        elif platform == "docs":
            suggestions.append("Create document templates for frequently used formats")
        
        return suggestions[:2]  # Return top 2 suggestions
    
    def _identify_integration_opportunities(self, context: ConversationContext) -> List[str]:
        """Identify opportunities for cross-platform integration"""
        opportunities = []
        
        # Analyze conversation for cross-platform needs
        platforms_mentioned = set()
        for turn in context.turns:
            if any(word in turn.user_message.lower() for word in ['email', 'gmail']):
                platforms_mentioned.add('gmail')
            if any(word in turn.user_message.lower() for word in ['calendar', 'meeting']):
                platforms_mentioned.add('calendar')
            if any(word in turn.user_message.lower() for word in ['document', 'docs']):
                platforms_mentioned.add('docs')
            if any(word in turn.user_message.lower() for word in ['task', 'todo']):
                platforms_mentioned.add('tasks')
        
        if len(platforms_mentioned) > 1:
            platforms_list = list(platforms_mentioned)
            opportunities.append(f"Connect {platforms_list[0]} with {platforms_list[1]} for seamless workflow")
        
        return opportunities
    
    def _get_user_personality(self, user_id: str) -> PersonalityProfile:
        """Get user's personality profile or return default"""
        return self.user_personalities.get(user_id, self.user_personalities["default"])
    
    async def search_memory(self, request: MemorySearchRequest) -> MemorySearchResponse:
        """Search user's dialogue memory"""
        start_time = datetime.utcnow()
        
        user_memories = self.dialogue_memories.get(request.user_id, [])
        matching_memories = []
        
        query_lower = request.query.lower()
        
        for memory in user_memories:
            # Check importance threshold
            if memory.importance < request.min_importance:
                continue
            
            # Check category filter
            if request.category_filter and memory.category not in request.category_filter:
                continue
            
            # Check platform filter
            if request.platform_filter and memory.related_platform != request.platform_filter:
                continue
            
            # Check content relevance
            if query_lower in memory.content.lower() or any(tag in query_lower for tag in memory.tags):
                matching_memories.append(memory)
        
        # Sort by importance and access frequency
        matching_memories.sort(key=lambda m: (m.importance, m.access_count), reverse=True)
        
        # Limit results
        matching_memories = matching_memories[:request.max_results]
        
        search_time = int((datetime.utcnow() - start_time).total_seconds() * 1000)
        
        return MemorySearchResponse(
            memories=matching_memories,
            total_found=len(matching_memories),
            search_time_ms=search_time
        )
    
    async def create_memory(self, request: CreateMemoryRequest) -> DialogueMemoryEntry:
        """Create a new dialogue memory entry"""
        memory_id = str(uuid.uuid4())
        
        memory = DialogueMemoryEntry(
            memory_id=memory_id,
            user_id=request.user_id,
            content=request.content,
            category=request.category,
            importance=request.importance,
            related_platform=request.platform,
            tags=request.tags,
            source_session=request.session_id
        )
        
        # Store memory
        if request.user_id not in self.dialogue_memories:
            self.dialogue_memories[request.user_id] = []
        
        self.dialogue_memories[request.user_id].append(memory)
        
        return memory
    
    async def get_dialogue_analytics(self, user_id: str, time_period: str = "24h") -> DialogueAnalytics:
        """Get dialogue analytics for a user"""
        # Calculate time cutoff
        cutoff_time = datetime.utcnow()
        if time_period == "24h":
            cutoff_time -= timedelta(hours=24)
        elif time_period == "7d":
            cutoff_time -= timedelta(days=7)
        elif time_period == "30d":
            cutoff_time -= timedelta(days=30)
        
        # Get user's conversations
        user_contexts = [
            ctx for ctx in self.conversation_contexts.values()
            if ctx.user_id == user_id and ctx.start_time >= cutoff_time
        ]
        
        # Calculate metrics
        total_conversations = len(user_contexts)
        total_turns = sum(len(ctx.turns) for ctx in user_contexts)
        avg_turns = total_turns / total_conversations if total_conversations > 0 else 0
        
        # Get memories
        user_memories = self.dialogue_memories.get(user_id, [])
        recent_memories = [m for m in user_memories if m.created_at >= cutoff_time]
        
        # Platform usage
        platform_usage = {}
        intent_distribution = {}
        
        for ctx in user_contexts:
            platform_usage[ctx.platform] = platform_usage.get(ctx.platform, 0) + 1
            
            for turn in ctx.turns:
                intent = self._detect_intent(turn.user_message)
                intent_distribution[intent] = intent_distribution.get(intent, 0) + 1
        
        return DialogueAnalytics(
            user_id=user_id,
            time_period=time_period,
            total_conversations=total_conversations,
            total_turns=total_turns,
            average_turns_per_conversation=avg_turns,
            average_response_time_ms=250.0,  # Mock data
            memory_entries_created=len(recent_memories),
            memory_entries_used=sum(m.access_count for m in recent_memories),
            context_retention_score=0.85,  # Mock data
            successful_task_completions=total_turns // 3,  # Mock estimate
            clarification_requests=total_turns // 10,  # Mock estimate
            user_corrections=total_turns // 20,  # Mock estimate
            platform_usage=platform_usage,
            intent_distribution=intent_distribution,
            improvement_suggestions=[
                "Consider using voice commands for faster interaction",
                "Set up automation for frequently repeated tasks",
                "Enable cross-platform integrations for seamless workflow"
            ],
            knowledge_gaps=[
                "Advanced calendar scheduling features",
                "Email automation and filtering options",
                "Document collaboration best practices"
            ]
        ) 