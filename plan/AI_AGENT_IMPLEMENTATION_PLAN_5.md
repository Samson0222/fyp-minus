# Minus AI Agent: Phase 5 Implementation Plan - Telegram Conversational Assistant

## 1. Vision & Goal (Fully Conversational)

The goal is to extend the AI assistant to understand and interact with the user's Telegram chats through a **purely conversational interface**. This approach mirrors the successful design of the Gmail assistant, providing a seamless and intuitive user experience.

-   **Strategy:** Users will issue natural language commands (e.g., "summarize my chat with...") within the existing general-purpose AI chat interface. The AI will use a dedicated toolset on the backend to understand the context, find the correct chat, and perform the requested actions.
-   **Core Workflow:** The "Draft, Review, Approve" paradigm remains the cornerstone for all actions that send messages on the user's behalf, ensuring user control and preventing errors.
-   **UI Impact:** The existing `TelegramFocusMode` will serve as a simple client for viewing conversations and sending messages directly but will **not** be integrated into the AI workflow. All AI interactions happen in the general-purpose chat.

## 2. Foundation: Leveraging Existing Integration

This plan is built upon the comprehensive, stateful Telegram integration that is already in place. The backend database schema (`monitored_chats`, `telegram_messages`) and core service logic (`telegram_service.py`) are perfectly suited for this refined plan and will be leveraged as is.

## 3. AI Agent Implementation Strategy (Conversational Model)

The core strategy is to make the AI assistant fully responsible for understanding and managing the context of the conversation, with no reliance on the UI state.

1.  **Centralized AI Interaction:** All AI-related Telegram commands will be handled by the `GeneralPurposeChatWrapper` component and its corresponding backend endpoint (`POST /api/v1/assistant/chat`).

2.  **Backend-Driven Context Discovery:** Instead of the UI telling the backend which chat is active, the AI will determine the context itself using a new tool.
    -   A `find_telegram_chat` tool will be the primary entry point for any Telegram-related query. It will take a user's text description (e.g., "the Project Phoenix group" or "John Doe") and resolve it to a specific `chat_id` by searching the database.

3.  **Stateful Conversations:** Once a chat is successfully identified, its `chat_id` will be stored in the backend `ConversationState`. This allows for natural, multi-turn follow-up commands ("draft a reply to that chat," "summarize it," "send it") without the user needing to specify the chat again.

## 4. Backend Implementation: The Telegram AI Toolset

A new suite of tools will be created to empower the AI assistant to interact with the Telegram service.

-   **Tool File:** `backend/app/tools/telegram_tools.py`
-   **Core Tools:**
    1.  `find_telegram_chat(contact_or_group_name: str)`: Searches the `monitored_chats` table for a chat matching the given name. It will handle cases with no matches, one match, or multiple matches (requiring disambiguation from the user).
    2.  `get_chat_summary(chat_id: int)`: Summarizes the latest unread messages for a given `chat_id`.
    3.  `create_telegram_draft(chat_id: int, content: str)`: Creates a message draft in the system but does not send it. Returns a `draft_id`.
    4.  `send_telegram_draft(draft_id: str)`: Sends a previously created draft message to the specified chat.
    5.  `cancel_telegram_draft(draft_id: str)`: Deletes a message draft.
-   **Intent Handling:** The `AIOrchestratorService` will be updated with new intents (`summarize_telegram_chat`, `draft_telegram_reply`, `send_telegram_draft`, etc.) to map user requests to the appropriate tool chain.

## 5. Frontend Implementation: No Changes Required

The primary advantage of this conversational approach is its **minimal impact on the frontend**.

-   The `GeneralPurposeChatWrapper.tsx` is already built to handle the entire conversational lifecycle, including displaying text responses and rendering the generic "Draft Review Card."
-   No new components, pages, or complex state management hooks are needed on the client-side for this feature. The `TelegramFocusMode` component remains entirely untouched by this AI logic.

## 6. Conversational Workflow Example (New Flow)

1.  **User (in General Purpose Chat):** "Summarize what I missed in my 'Project Phoenix' team chat."
2.  **Backend (AI Orchestrator):**
    -   Identifies the `summarize_telegram_chat` intent.
    -   Sees it lacks a `chat_id`, so it calls the `find_telegram_chat` tool with the query `"Project Phoenix"`.
    -   The tool searches the database and returns the correct `chat_id: 12345`.
    -   The orchestrator saves this `chat_id` to the current `ConversationState`.
    -   It then proceeds to call the `get_chat_summary` tool using the retrieved `chat_id`.
    -   A text summary is generated and returned to the user.
3.  **Frontend (`GeneralPurposeChatWrapper`):** Renders the AI's summary in the chat window.
4.  **User (in General Purpose Chat):** "Okay, draft a reply saying 'Thanks for the update, I'm on it!'"
5.  **Backend (AI Orchestrator):**
    -   Recognizes the `draft_telegram_reply` intent.
    -   Retrieves the `chat_id: 12345` from the `ConversationState`.
    -   Calls the `create_telegram_draft` tool with the `chat_id` and message content.
    -   Returns a `draft_review` action, including the new `draft_id`.
6.  **Frontend (`GeneralPurposeChatWrapper`):** Renders the "Draft Review Card."
7.  **User:** Clicks the "Send" button on the card. The rest of the approval and sending flow is handled identically to the email module, culminating in the AI calling the `send_telegram_draft` tool.
