# Fix Plan: Aligning Frontend Wrapper with Backend AI Agent

## 1. Executive Summary & Objective

A thorough review of the codebase reveals that a sophisticated frontend for the AI Assistant already exists, comprising `GeneralPurposeChatWrapper.tsx` (the "Smart" wrapper) and `ChatSidebarUI.tsx` (the "Dumb" UI). This implementation supports an advanced **"Draft, Review, Approve"** workflow, which is the ideal user experience for an agent that can take actions.

The core issue is a mismatch between the API contract expected by this frontend wrapper and the API contract defined in the backend plan (`plan/AI_AGENT_IMPLEMENTATION_PLAN_2.md`).

**Objective:** To perform a targeted refactoring of the `GeneralPurposeChatWrapper.tsx` to align its API calls with the backend agent's contract, and to clarify the backend's responsibility in supporting this advanced UI.

## 2. The "Point of Truth": Upholding the "Draft, Review, Approve" UI

The existing UI is the gold standard for this feature. The `ToolDraftCard` component in `ChatSidebarUI.tsx` provides the exact UX we need. Therefore, we will treat the frontend's data requirements as the "point of truth".

This means the backend plan must be updated with one key change:
-   **Backend Responsibility:** The AI agent (`/api/v1/assistant/chat`) **must not** return a simple string when it decides to use a tool. Instead, it **must** return a structured JSON object that the frontend `ToolDraftCard` can render.

## 3. Frontend Refactoring Plan (`GeneralPurposeChatWrapper.tsx`)

The following changes are required in `frontend/src/components/layout/GeneralPurposeChatWrapper.tsx` to align it with the backend.

### Task 1: Align API Request Payload

The `body` of the `fetch` request inside the `handleSendMessage` function must be updated.

**Current Code:**
```javascript
// ...
body: JSON.stringify({
  message: inputValue,
  conversation_history: conversation_history,
  ui_context: { page: 'dashboard' } // Example context
}),
// ...
```

**Required Change:**
Update the keys to match the backend agent's `invoke` schema.

```javascript
// ...
body: JSON.stringify({
  input: inputValue, // 'message' -> 'input'
  chat_history: conversation_history, // 'conversation_history' -> 'chat_history'
  user_context: { user_id: 'placeholder_user_id', google_credentials: 'placeholder_token' } // 'ui_context' -> 'user_context' with real data
}),
// ...
```

### Task 2: Align Chat History Format

The `conversation_history` array sent to the backend needs to map its roles correctly. The AI model on the backend expects the role `'model'`, not `'ai'`.

**Current Code:**
```javascript
// ...
const conversation_history = messages.map(m => ({
    role: m.sender, // 'user' | 'ai' | 'system'
    content: m.content.type === 'text' ? m.content.text : JSON.stringify(m.content)
}));
// ...
```

**Required Change:**
Map `ai` to `model` and ensure system messages (UI-only confirmations) are not sent in the history. The content should also be simplified to just the text the LLM needs to understand the conversation flow.

```javascript
// ...
const conversation_history = messages
  .filter(m => m.sender !== 'system') // Exclude system messages from history
  .map(m => {
    const role = m.sender === 'ai' ? 'model' : 'user'; // 'ai' -> 'model'
    const content = m.content.type === 'text' 
      ? m.content.text 
      : m.content.assistant_message; // For tool drafts, use the assistant's plain text query
    return { role, content };
  });
// ...
```

### Task 3: Implement Real Tool Approval Flow

The `handleApproveTool` function is currently a placeholder. It must be implemented to call a new backend endpoint that executes the approved action.

**Required Implementation:**
This function will make a `POST` request to a new `/api/v1/assistant/execute_tool` endpoint.

```javascript
// In GeneralPurposeChatWrapper.tsx

const handleApproveTool = async (toolName: string, toolInput: any) => {
  console.log("Approving and executing tool:", toolName, toolInput);
  setIsLoading(true);
  setError(null);

  // Add a system message to inform the user that the action is running
  const executingMessage: Message = {
    id: `system-${Date.now()}`,
    sender: 'system',
    timestamp: new Date(),
    content: { type: 'text', text: `Executing: ${toolName}...` }
  };
  setMessages(prev => [...prev, executingMessage]);

  try {
    const response = await fetch('/api/v1/assistant/execute_tool', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tool_name: toolName,
        tool_input: toolInput,
        // The same user_context must be passed for the tool to use the correct credentials
        user_context: { user_id: 'placeholder_user_id', google_credentials: 'placeholder_token' }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Tool execution failed');
    }

    const result = await response.json();

    // Display the result of the tool execution as a final system message
    const resultMessage: Message = {
      id: `system-${Date.now()}-result`,
      sender: 'system',
      timestamp: new Date(),
      content: { type: 'text', text: `Execution Result: ${JSON.stringify(result)}` }
    };
    setMessages(prev => [...prev, resultMessage]);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Failed to execute the tool.';
    setError(errorMessage);
  } finally {
    setIsLoading(false);
  }
};
```

## 4. Backend API Adjustment Plan

To support the frontend, the backend API needs two adjustments.

### Task 1: Modify Chat Endpoint (`/api/v1/assistant/chat`)

This endpoint must return the structured JSON the frontend expects.

**Example (FastAPI):**
```python
# In your main chat endpoint
# agent_response = orchestrator.invoke(...)

if "tool_calls" in agent_response:
    # Logic to extract tool call draft
    tool_name = ...
    tool_input = ...
    assistant_message = "I need to use a tool to do that. Shall I proceed?"
    return {
        "type": "tool_draft",
        "tool_name": tool_name,
        "tool_input": tool_input,
        "assistant_message": assistant_message
    }
else:
    # It's a direct text response
    return {"type": "text", "response": agent_response.get("output")}
```

### Task 2: Create Tool Execution Endpoint (`/api/v1/assistant/execute_tool`)

A new, simple endpoint is required to run an approved tool without invoking the whole AI agent again.

**Example (FastAPI):**
```python
from pydantic import BaseModel, Field
# Assume `calendar_tools` is a list of your @tool decorated functions
# from app.services.ai_tools.calendar import calendar_tools 
# tool_registry = {t.name: t for t in calendar_tools}

class ExecuteToolRequest(BaseModel):
    tool_name: str
    tool_input: dict
    user_context: dict

@router.post("/assistant/execute_tool")
def execute_tool_endpoint(request: ExecuteToolRequest):
    tool_to_execute = tool_registry.get(request.tool_name)
    
    if not tool_to_execute:
        raise HTTPException(status_code=404, detail="Tool not found")

    # The tool function itself needs to be designed to accept user_context
    # (as defined in the original AI_AGENT_IMPLEMENTATION_PLAN_2.md)
    result = tool_to_execute.invoke(request.tool_input, user_context=request.user_context)
    
    return result

```
This comprehensive plan ensures the sophisticated frontend and the powerful backend agent can work together seamlessly, delivering the intended intelligent and interactive user experience.
