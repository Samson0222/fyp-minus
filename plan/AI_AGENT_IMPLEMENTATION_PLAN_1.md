# Minus AI Agent: Implementation Plan

This document outlines the phased implementation plan for integrating a sophisticated, agentic AI into the Minus application, leveraging Google's Gemini model. The plan covers backend architecture, frontend UI/UX refactoring, and the incremental rollout of new capabilities.

---

## Guiding Principles

- **Agentic & Tool-Based:** The AI will operate as an agent, using a defined set of "tools" (backend functions) to interact with various services (Google Calendar, Google Docs, Telegram).
- **Context-Aware:** The frontend will provide the backend with crucial UI context (e.g., current page, open document ID) to enable more intelligent and relevant responses.
- **User-in-the-Loop:** For sensitive or irreversible actions, the AI will follow a "Draft, Review, Approve" pattern, presenting its plan to the user for confirmation before execution.
- **Scalable & Modular:** The architecture will be built around a "Dumb Component + Smart Wrapper" pattern to ensure components are reusable and logic is properly encapsulated.

---

## Phase 1: Foundational AI Infrastructure & UI Refactoring

**Goal:** Establish the core backend service and refactor the frontend chat interface to support agentic, context-aware interactions. This phase lays the groundwork for all future AI features.

### Backend Tasks:

1.  **Centralized AI Endpoint:**
    - Create a single, robust API endpoint: `POST /api/v1/assistant/chat`.
    - This endpoint will handle all user prompts, conversation history, and contextual data from the frontend.

2.  **AI Orchestrator Service:**
    - Develop a new backend service that acts as the central hub for the AI agent, using **LangChain** as the core framework.
    - Responsibilities:
        - Receiving requests from the `/api/v1/assistant/chat` endpoint.
        - Using LangChain to manage the agent, conversation flow, and tool execution with the Gemini model.
        - Formatting the final response to be sent back to the frontend.

3.  **Gemini Integration:**
    - Integrate the Google Gemini Pro model using the official **`google-generativeai` SDK**.
    - Configure the model and its function-calling capabilities within the LangChain framework.

4.  **Tool Definition (Stubs):**
    - Define the Python function signatures for the initial set of tools.
    - For this phase, these will be stubs that return mock data (e.g., `get_calendar_events`, `create_calendar_event_draft`).

### Frontend Tasks:

1.  **UI Refactoring ("Dumb Component + Smart Wrapper"):**
    - **`ChatSidebar.tsx` -> `ChatSidebarUI.tsx`:** Refactor the existing chat sidebar into a purely presentational ("dumb") component.
    - **`ChatSidebarUIProps`:** Define a clear props interface for `ChatSidebarUI.tsx`, including `messages`, `onSendMessage`, `isLoading`, etc.
    - **`GeneralPurposeChatWrapper.tsx`:** Create a new "smart" wrapper component. This wrapper will be used on the main dashboard and will contain all the logic for state management, API calls, and passing props to `ChatSidebarUI.tsx`.

2.  **State Management & API Calls:**
    - The `GeneralPurposeChatWrapper` will be responsible for:
        - Maintaining the conversation history.
        - Calling the `/api/v1/assistant/chat` endpoint.
        - Handling the loading state while waiting for a response.

3.  **"Draft, Review, Approve" UI:**
    - Implement UI elements within the chat to handle structured JSON responses from the AI.
    - For example, when the AI drafts a calendar event, the UI should display it in a structured format with "Approve" and "Reject" buttons, rather than as plain text.

4.  **Formal Error Handling:**
    - **Enhance `ChatSidebarUIProps`:** Add an optional `error: string | null` property.
    - **Update `ChatSidebarUI.tsx`:** The component will display a user-friendly error message (e.g., "Sorry, I couldn't connect to the assistant right now.") if the `error` prop is set.
    - **Update Wrapper Logic:** The `GeneralPurposeChatWrapper` will `try...catch` API call failures, update its state with the error message, and pass it down to the UI component. This ensures that network or server failures are communicated gracefully to the user.

### Project Cleanup:

1.  **Full Removal of Legacy Task Module:**
    - **Frontend:** Delete all components and pages related to the old custom task system (`Tasks*.tsx`, `add-task-modal.tsx`, `task-list-view.tsx`, etc.).
    - **Backend:** Remove the corresponding routers, models, and services.
    - **Database:** Create and apply a migration to drop the legacy `tasks` table. The Google Calendar integration will be the sole source of truth for tasks and events going forward.

2.  **Delete Unused Components:**
    - Remove `InteractionArea.tsx` and `InteractionBar.tsx` as their functionality will be absorbed into the new chat wrapper.

---

## Phase 2: Calendar Agent

**Goal:** Implement the full functionality for the Google Calendar agent.

- **Backend:** Implement the logic for `get_calendar_events`, `create_calendar_event`, `update_calendar_event`, etc.
- **Frontend:** Create a `CalendarChatWrapper.tsx` that provides calendar-specific context (e.g., current view date) to the backend.

---

## Phase 3: Google Docs Agent

**Goal:** Enable the "Collaborator Model" for interacting with Google Docs.

- **Backend:**
    - Implement Google Docs API tools (`get_document_content`, `create_suggestion`, etc.).
    - Securely handle user authentication and authorization for Google Docs.
- **Frontend:**
    - Create a `DocsChatWrapper.tsx` to be used when a user is viewing a document.
    - This wrapper will provide the `document_id` and other relevant context to the backend agent.

---

## Phase 4: Telegram Agent

**Goal:** Implement the "Conversational Messenger" model for Telegram.

- **Backend:**
    - Implement Telegram tools (`get_monitored_chats`, `send_reply`).
    - Build the database schema and logic for storing approved chat messages ("Stateful Model").
- **Frontend:**
    - Implement the "Telegram Focus Mode" UI, including the notification icon and the "Hub" overlay.
    - Develop the settings page for users to manage their "Monitored Chats."

---

## Phase 5: Voice Integration

**Goal:** Enable voice-to-text and text-to-speech capabilities.

- **Frontend:** Implement the UI for playing back the AI's spoken responses.
- **Backend:** Integrate Google's Text-to-Speech (TTS) service to generate audio responses.
- **Frontend:** Integrate Google's Speech-to-Text (STT) service via a voice recognition library to capture user speech.
