# Minus AI Agent: Implementation Master Plan

## 1. Vision & Goal

The primary objective is to evolve Minus from a standard application into a proactive, context-aware AI assistant. We are building a **collaborative partner** that understands the user's context, anticipates needs, and streamlines complex workflows across integrated services like Google Docs and Telegram. The goal is to move beyond simple command-response interactions to create a truly intelligent and helpful user experience.

## 2. Core Architecture

We have adopted a robust and scalable architecture that decouples the user interface from the complex AI logic.

### 2.1. Frontend: "Dumb Component + Smart Wrapper" Pattern

This pattern is fundamental to our frontend strategy.

-   **The Problem:** Initial components (e.g., `ChatSidebar.tsx`) were tightly coupled with specific backend logic (e.g., hardcoded API calls for Gmail). This made them difficult to reuse and maintain.
-   **The Solution:** We separate presentational components from the logic that powers them.
    -   **"Dumb" UI Components (e.g., `ChatSidebarUI.tsx`):** These are purely presentational. They are responsible only for rendering the UI based on the props they receive and emitting user events (like sending a message). They are context-agnostic and highly reusable.
    -   **"Smart" Wrapper Components (e.g., `DocsChatWrapper.tsx`, `GeneralPurposeChatWrapper.tsx`):** These components contain the application logic. They manage state, fetch data, and, most importantly, provide the **UI Context** to the backend. For example, the `DocsChatWrapper` will extract the `document_id` from the page URL and send it with every request, telling the AI *what* the user is looking at.

### 2.2. Backend: Agentic AI Workflow

We are moving beyond a simple LLM call to a true agentic workflow where the AI can use tools to accomplish tasks.

-   **"Context is King":** Every request to the backend AI endpoint (`/api/v1/assistant/chat`) will include two key pieces of information:
    1.  **UI Context:** What the user is currently viewing (e.g., a specific document ID, a Telegram chat ID, or a general dashboard).
    2.  **Conversational Memory:** The recent history of the chat to maintain a natural, ongoing dialogue.

-   **Tool Calling:** The backend is designed as an **Orchestrator**. It uses an LLM to understand the user's intent and then selects the appropriate "tool" to execute. A "tool" is a specific Python function that interacts with an external service (e.g., `google_docs.create_suggestion` or `telegram.send_reply`).

-   **"Draft, Review, Approve" Workflow:** To ensure user control and build trust, the AI will not perform critical actions directly. For tasks like replying to a message or making significant document changes, the agent will:
    1.  **Draft** the content.
    2.  Return the draft to the UI for user **Review**.
    3.  Wait for explicit user **Approval** before executing the final action.

## 3. Technology Stack

-   **Core AI Framework:** **LangChain (Python)** will be used to build the agent, manage the tool-calling logic, and construct the prompts.
-   **Language Model (LLM):** **Google Gemini 2.5 Pro** is the core intelligence, accessed via the official `google-generativeai` SDK.
-   **Backend API:** **FastAPI (Python)** provides the robust and fast framework for our centralized AI endpoint.
-   **Frontend Framework:** **React (TypeScript)** is used to build the user interface, including the "Dumb" components and "Smart" wrappers.
-   **Voice Integration (Future):** **Google Cloud Speech-to-Text (STT)** and **Text-to-Speech (TTS)** services will be used to enable voice interactions.

## 4. Phased Implementation Plan

### Phase 1: Foundational Infrastructure (Completed)

-   **Project Cleanup:** Decommissioned the entire legacy task module (frontend components, backend API, database tables).
-   **Centralized Endpoint:** Created the `POST /api/v1/assistant/chat` endpoint to handle all AI interactions.
-   **Basic Orchestrator:** Set up the initial AI orchestrator service using LangChain and the Gemini SDK.
-   **UI Refactor:** Refactored the chat UI into `ChatSidebarUI.tsx` and created the `GeneralPurposeChatWrapper.tsx` for non-contextual interactions.

### Phase 2: Google Docs "Mission Control" (Current)

-   **Goal:** Enable the AI to act as a collaborative writing assistant within Google Docs.
-   **Backend:** Implement Python tools that use the Google Docs API to `list_documents`, `get_document_content`, and `create_suggestion`.
-   **Frontend:**
    -   Build a document dashboard to list and select Google Docs.
    -   Create a focused document view that embeds a Google Doc in an `iframe` alongside the AI chat sidebar.
    -   Develop the `DocsChatWrapper.tsx` to provide the `document_id` context to the backend agent.

### Phase 3: Email "Command Center"

-   **Goal:** Transform the user's inbox management from a chore into a streamlined, AI-assisted workflow.
-   **Architecture:** The "Draft, Review, Approve" model is critical here. The AI will draft replies or new emails, which the user must approve before sending.
-   **Backend:** Implement tools for a chosen email API (e.g., Gmail API) for `read_emails`, `draft_reply`, and `send_email`.
-   **Frontend:** Create an `EmailChatWrapper.tsx` that can provide context like `thread_id` or `message_id` to the agent.

### Phase 4: Calendar & Scheduling Assistant

-   **Goal:** Enable the AI to manage the user's schedule, book meetings, and create tasks as calendar events, officially replacing our legacy `tasks` module.
-   **Architecture:** This module will heavily rely on the AI's ability to understand natural language requests about time and availability.
-   **Backend:** Implement tools for the Google Calendar API: `create_event`, `list_events`, `find_free_slots`, and `update_event`.
-   **Frontend:** The `GeneralPurposeChatWrapper` will likely be sufficient for many scheduling commands, as they often aren't tied to a specific UI view.

### Phase 5: Telegram "Conversational Messenger"

-   **Goal:** Allow the user to manage and respond to Telegram messages from within the Minus web app.
-   **Architecture:** We will use a stateful approach, storing message content from user-approved chats in our own database for a fast UI and to provide context to the AI. A user-consent workflow will be implemented.
-   **Backend:** Implement tools for the Telegram API (`read_messages`, `send_reply`, `send_announcement`).
-   **Frontend:** Create a "Telegram Hub" overlay as a focused mode for managing conversations, powered by a `TelegramChatWrapper.tsx`.

### Phase 6: Voice-First Interaction

-   **Goal:** Enable hands-free interaction with the AI assistant.
-   **Implementation:** Integrate Google's STT and TTS services. Implement a "wake word" or push-to-talk mechanism to activate voice commands and receive spoken responses from the AI.

## 7. Development Precautions & Authentication Lessons

### 7.1. User Authentication and Context Handling

- **Always Trust the Backend for User Context:**
  - Never trust user context (user_id, credentials, etc.) sent from the frontend. Always inject or validate it on the backend using a dependency (e.g., FastAPI's `Depends(get_current_user)`).
  - This prevents spoofing and ensures the backend always has the correct, up-to-date credentials.

- **DEV_AUTH_BYPASS Mode:**
  - In development, set `DEV_AUTH_BYPASS=true` in the backend `.env` file. This allows the backend to skip JWT validation and use a hardcoded test user (e.g., `test_user_001`).
  - The backend should load Google OAuth tokens for this user directly from the local `tokens/` directory (e.g., `tokens/token_google_test_user_001.json`).
  - The frontend may have its own dev bypass flag (e.g., `VITE_DEV_AUTH_BYPASS`), but the backend's flag is authoritative for all authentication logic.

- **UserContext Model Consistency:**
  - The `UserContext` Pydantic model should have a single source of truth for field names (e.g., `user_id`, not `id`).
  - All code (tools, routers, services) must use the same attribute names to avoid runtime errors.

- **Tool Argument Passing (LangChain):**
  - When using LangChain's `@tool` decorator, extra arguments (like `user_context`) are dropped unless explicitly included in the tool's schema.
  - To pass runtime-only arguments (like credentials), call the tool's underlying async function directly (using `.coroutine`), not via the LangChain wrapper.

- **Error Handling:**
  - Always log and surface errors related to missing or invalid credentials clearly. This helps quickly diagnose issues with token loading or user context propagation.

### 7.2. Common Pitfalls

- **Mismatched Field Names:**
  - Changing `id` to `user_id` (or vice versa) in the user context model requires updating all references throughout the codebase, including tools and services.

- **Frontend/Backend Bypass Mismatch:**
  - If the frontend is in dev bypass mode but the backend is not (or vice versa), authentication will fail. Always keep `.env` files in sync for both.

- **Token File Location:**
  - The backend must have read access to the correct token file for the test user in dev mode. If the file is missing or malformed, Google API calls will fail.

- **LangChain Tool Wrappers:**
  - The LangChain tool wrapper is strict about argument schemas. For advanced use cases, bypass the wrapper and call the original function directly.

---
