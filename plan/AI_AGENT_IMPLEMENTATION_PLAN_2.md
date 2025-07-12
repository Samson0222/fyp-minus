# Implementation Plan: The AI Scheduling Assistant

## 1. Vision & Objective

To build an intelligent, conversational AI assistant capable of managing a user's schedule. The assistant will understand natural language commands, interact securely with the Google Calendar API, and handle complex, multi-step workflows for creating, reading, and modifying calendar events. This document outlines the technical plan for its implementation.

## 2. Core Technology Stack

-   **Backend Framework:** FastAPI
-   **AI Orchestration:** LangChain (leveraging the LangChain Expression Language - LCEL)
-   **Large Language Model (LLM):** Gemini 2.5 Flash/Gemini 2.5 Flash-Lite Preview (via the `google-generativeai` Python SDK)
-   **Tool Interface:** Google Calendar API v3

## 3. High-Level Architecture: The AI Orchestrator Model

The system is built around a central **AI Orchestrator** on our FastAPI backend. This orchestrator receives all user commands, uses the Gemini LLM to understand intent and extract details, and then executes the appropriate actions by calling from a predefined set of "tools."

### 3.1. System Flow Diagram

```mermaid
graph TD
    subgraph Frontend
        A[User: "Book a meeting with Anya tomorrow at 10am"] --> B(GeneralPurposeChatWrapper);
        B --> C{POST /api/v1/assistant/chat};
    end

    subgraph Backend
        C --> D[AI Orchestrator];
        D --> E{LLM: Intent is 'create_event'};
        E -- summary: "Meeting with Anya"<br/>start_time: "2025-07-12T10:00:00" --> F(Tool: create_calendar_event);
        F --> G[Google Calendar API];
        G -- Success --> F;
        F --> D;
        D --> H{LLM: Formulate friendly response};
        H -- "OK, I've scheduled 'Meeting with Anya'..." --> C;
    end

    subgraph Frontend
        C --> I(ChatSidebarUI);
        I --> J[Displays confirmation to user];
    end
```

## 4. Detailed Conversational Workflows

Our assistant's primary strength is its ability to handle conversational workflows.

### Workflow 1: Direct Event Creation

-   **User:** "Schedule 'Team Lunch' for this Friday at 1 PM."
-   **System:** The LLM has all the required information (`summary`, `start_time`). It directly selects and executes the `create_calendar_event` tool.

### Workflow 2: The "Find & Book" Scenario (Clarification)

-   **User:** "Find time to meet with dave@example.com next week for a 45-minute code review."
-   **System Steps:**
    1.  **Intent:** LLM recognizes the need to check schedules first.
    2.  **Tool 1:** Selects and runs `find_available_time_slots` with the attendees and duration.
    3.  **Clarification:** Presents the returned time slots to the user and asks for their choice.
    4.  **User Confirms:** "Let's do Wednesday at 11 AM."
    5.  **Tool 2:** LLM now has all info. It runs `create_calendar_event` using details from the entire conversation.
    6.  **Confirmation:** The assistant confirms the booking with the user.

### Workflow 3: Event Modification (Disambiguation)

-   **User:** "Reschedule my sync meeting to 4 PM."
-   **System Steps:**
    1.  **Intent:** LLM recognizes the intent to modify an event but lacks the specific `event_id`.
    2.  **Tool 1:** It runs `list_calendar_events` with the search query "sync meeting".
    3.  **Disambiguation:** The tool finds two "Project Sync" meetings. The LLM asks the user for clarification: "I found two 'Project Sync' meetings this week. The one on Tuesday or the one on Wednesday?"
    4.  **User Confirms:** "The one on Wednesday."
    5.  **Tool 2:** The LLM now knows the correct `event_id` and runs `modify_calendar_event`.

## 5. Tool & Function Specification

The agent's capabilities are defined by these tools. The `description` is critical for the LLM's decision-making process.

---

**Tool 1: `create_calendar_event`**
-   **Description:** "Use this tool to create a new event on the user's calendar. Before using, you must have a summary (title), a precise start time, and an end time. If you lack any of this, ask the user for it. Do not guess details. The `start_time` and `end_time` must be full ISO 8601 datetime strings."
-   **Parameters:** `summary: string`, `start_time: string`, `end_time: string`, `attendees: list[string] (optional)`, `location: string (optional)`
-   **Returns:** `{"status": "success", "event_link": "http://cal.google.com/..."}`

---

**Tool 2: `list_calendar_events`**
-   **Description:** "Use this tool to list existing events on the user's calendar. It can search by a time range, a text query, or both. This is for answering questions like 'What's on my schedule today?' or 'Find my meeting about the Q4 budget'. Do not use this to find open slots for a new meeting; use `find_available_time_slots` for that."
-   **Parameters:** `start_time: string`, `end_time: string`, `query: string (optional)`
-   **Returns:** `{"events": [{"summary": "...", "start": "...", "end": "...", "id": "..."}]}`

---

**Tool 3: `modify_calendar_event`**
-   **Description:** "Use to modify an existing event (e.g., change its time or title). You must know the `event_id`. If you don't, first use `list_calendar_events` to find the event and confirm with the user which one they mean."
-   **Parameters:** `event_id: string`, `new_summary: string (optional)`, `new_start_time: string (optional)`, `new_end_time: string (optional)`, `add_attendees: list[string] (optional)`
-   **Returns:** `{"status": "success", "updated_event_link": "..."}`

---

**Tool 4 (Advanced): `find_available_time_slots`**
-   **Description:** "Use to find open time slots for a new meeting by checking the calendars of all specified attendees. This tool only finds options; it does not book the meeting."
-   **Parameters:** `attendees: list[string]`, `duration_minutes: int`, `time_range_start: string`, `time_range_end: string`
-   **Returns:** `{"slots": [{"start": "...", "end": "..."}, ...]}`

## 6. Sample Implementation Code (Python with LangChain & Gemini)

This section provides illustrative code for the backend implementation.

### 6.1. Defining a Tool with Pydantic and LangChain

We define the tool's arguments using Pydantic for automatic validation and to provide a clear schema to the LLM.

```python
# In a file like backend/app/services/ai_tools/calendar.py
from langchain_core.tools import tool
from langchain_core.pydantic_v1 import BaseModel, Field
from typing import List, Optional

# This would be a class that encapsulates user-specific context
class UserContext(BaseModel):
    user_id: str
    google_credentials: str # This would be the user's OAuth token data

# Define the input schema for our tool
class CreateEventInput(BaseModel):
    summary: str = Field(description="The title or summary of the event.")
    start_time: str = Field(description="The start time of the event in ISO 8601 format.")
    end_time: str = Field(description="The end time of the event in ISO 8601 format.")
    attendees: Optional[List[str]] = Field(description="A list of attendee email addresses.", default=[])

# Define the tool using the @tool decorator
@tool("create_calendar_event", args_schema=CreateEventInput)
def create_calendar_event(summary: str, start_time: str, end_time: str, attendees: Optional[List[str]] = None, user_context: UserContext = None) -> dict:
    """Use this tool to create a new event on the user's calendar."""
    
    if not user_context:
        return {"error": "User context is required to access the calendar."}

    print(f"Executing create_calendar_event for user {user_context.user_id} with args: {summary}, {start_time}, {end_time}, {attendees}")
    
    # 1. Instantiate Google Calendar service using user_context.google_credentials
    # calendar_service = get_calendar_service(user_context.google_credentials)
    
    # 2. Robustly parse date/time strings and fetch user's timezone from their calendar settings
    # user_timezone = calendar_service.settings().get(setting='timezone').execute().get('value')
    # event_body = { ... }

    # 3. Call the Google Calendar API
    # ...
    
    # For demonstration purposes:
    return {"status": "success", "event_link": "https://calendar.google.com/event-link-placeholder"}

```

### 6.2. Building the LangChain AI Orchestrator

This is the core "brain" that connects the LLM, the tools, and the user's input.

```python
# In a file like backend/app/services/ai_orchestrator.py
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain.agents import create_tool_calling_agent, AgentExecutor

# Assume calendar_tools is a list containing the functions decorated with @tool
# from .ai_tools.calendar import create_calendar_event, list_calendar_events
# calendar_tools = [create_calendar_event, list_calendar_events]

def get_ai_orchestrator(tools: list):
    """
    Creates and returns a LangChain AgentExecutor (our orchestrator).
    """
    # 1. Initialize the Gemini LLM
    llm = ChatGoogleGenerativeAI(
        model="gemini-2.5-flash-latest",
        google_api_key=os.environ.get("GOOGLE_API_KEY"),
        convert_system_message_to_human=True
    )

    # 2. Create the Prompt Template
    # This tells the agent how to behave and includes placeholders for input.
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a helpful assistant. You have access to a set of tools to help the user with their requests."),
        MessagesPlaceholder(variable_name="chat_history", optional=True),
        ("human", "{input}"),
        MessagesPlaceholder(variable_name="agent_scratchpad"),
    ])

    # 3. Create the Agent
    # This binds the LLM, the prompt, and the tools together.
    agent = create_tool_calling_agent(llm, tools, prompt)

    # 4. Create the Agent Executor
    # This is the runtime that invokes the agent, executes tools, and loops until an answer is found.
    agent_executor = AgentExecutor(
        agent=agent,
        tools=tools,
        verbose=True # Set to True for debugging to see the agent's thought process
    )
    
    return agent_executor

### 6.3. Handling Execution Context

This section clarifies how user-specific data and conversation history are managed during the execution of an AI task.

**Chat History Management:**
The `chat_history` is a critical component for maintaining conversational memory. This list of messages will be managed by the state of the frontend "Smart Wrapper" component (e.g., `GeneralPurposeChatWrapper`). On each new request, the frontend will pass the current `chat_history` in the request body to the backend, ensuring the AI has the full context of the ongoing dialogue.

**User Context and Authentication:**
The AI agent itself is stateless and serves multiple users. To ensure tools operate on the correct user's data (e.g., the right Google Calendar), we must pass user-specific context with every request.

The recommended pattern is to pass a `user_context` object within the main `invoke` call to the agent. This object should contain the user's ID and the necessary credentials for the tools to use. The tool functions must be designed to accept and utilize this context to initialize API services correctly.

```python
# Example of how to invoke the orchestrator in your FastAPI endpoint

# orchestrator = get_ai_orchestrator(calendar_tools) # Tools are now designed to accept context
# response = orchestrator.invoke({
#     "input": "Can you schedule a meeting with samson@example.com for tomorrow at 4pm called 'Review Session'?",
#     "chat_history": [], # This list is provided by the frontend wrapper
#     "user_context": {   # This context is passed to the tools
#         "user_id": current_user.id,
#         "google_credentials": current_user.google_token
#     }
# })
# print(response.get("output"))
```

## 7. Key Technical Considerations

-   **Authentication:** The service must correctly retrieve and use the user's stored Google OAuth 2.0 token for every API call. This token will be passed to the tools via the `user_context` object.
-   **Timezone Handling:** Tools must be designed to fetch the user's default timezone from their Google Calendar settings (using their authenticated credentials) and use it as the default for all date/time parsing.
-   **Disambiguation Logic:** Prompts must explicitly instruct the LLM on how to handle ambiguity (e.g., if multiple events match a search). The correct behavior is to ask the user for clarification, not to guess.
-   **Robust Date/Time Parsing:** Use a dedicated library like `dateparser` within the Python tool functions for converting natural language date strings into precise ISO 8601 timestamps. This is more reliable than asking the LLM to output a perfect format.

This plan provides a comprehensive roadmap for the development of the AI Scheduling Assistant.
