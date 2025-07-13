# Minus AI Agent: Phase 3 Implementation Plan - Email Command Center (Refined)

## 1. Vision & Goal

The goal of this phase is to transform the user's email management from a manual chore into a streamlined, AI-assisted workflow. We will build an "Email Command Center" where the user can read, search, summarize, reply to, and compose emails using natural language commands. All actions that modify user data (replying, sending) will adhere strictly to the **"Draft, Review, Approve"** model to ensure user control and trust.

## 2. Analysis of Test Cases

The implementation will be guided by the following user stories and AI actions:

1.  **"What's new in my email mailbox?"**
    *   **Intent:** Reading/Listing. The user wants a summary of recent, unread, or important emails.
    *   **AI Action:** Fetch a list of recent messages, listing the sender and a summarized version of the content.

2.  **"Can you help me to read the summary of the latest email of xxx?"**
    *   **Intent:** Searching & Summarizing. The user wants to find a specific email from a sender and understand its content without reading the entire message.
    *   **AI Action:** Search for the specified email, retrieve its full content, and generate a concise summary.

3.  **"Help me to reply to xxx. Tell him that xxx."**
    *   **Intent:** Replying. The user wants to continue an existing email conversation.
    *   **AI Action:** This is a multi-step process. The AI must find the conversation, use the user's instructions to create a draft reply, present the draft to the user for review, and only send it after receiving explicit confirmation.

4.  **"Help me to write an email to xxx. Tell him that xxx."**
    *   **Intent:** Composing. The user wants to start a new email conversation.
    *   **AI Action:** This also follows the "Draft, Review, Approve" model. The AI will create a brand new draft email based on the user's prompt, present it for review, and send it only upon approval.

## 3. Refined Backend Implementation

We will integrate email capabilities into our existing high-reliability architecture.

### 3.1. Prerequisites: Authentication

-   The Google Cloud project credentials must be updated to include the following OAuth scopes:
    -   `https://www.googleapis.com/auth/gmail.readonly`
    -   `https://www.googleapis.com/auth/gmail.compose`
-   The `user_context` object will continue to provide valid Google credentials to all tools.

### 3.2. Foundational Services and Tools

1.  **`GmailService` (`backend/app/services/gmail_service.py`):** A new service will be created to encapsulate all direct interactions with the Gmail API (authentication, message fetching, draft creation, sending).
2.  **Gmail Tools (`backend/app/tools/gmail_tools.py`):** The following functions will be implemented as LangChain `@tool`s, using the `GmailService`.
    *   `list_emails(query: str, max_results: int)`: Searches the user's inbox.
    *   `get_email_details(message_id: str, summarize: bool)`: Retrieves the full content or a summary of a specific email.
    *   `create_draft_email(to: str, subject: str, body: str, thread_id: str | None)`: Creates a new draft email. **Does not send.**
    *   `send_draft(draft_id: str)`: Sends a previously created draft.

### 3.3. Upgrading the AI Orchestrator

The agent's "brain" (`ai_orchestrator_service.py`) will be enhanced to manage email tasks.

1.  **New Intents (`intent.py`):** We will add new, specific intents following our established patterns:
    *   `list_emails`: For listing emails (e.g., "what's new?").
    *   `find_email`: For finding a specific email (e.g., "find the email from Bob").
    *   `compose_email`: For creating a new email draft.
    *   `reply_to_email`: For creating a reply draft.
    *   `send_email_draft`: A specific intent triggered by user approval on the frontend.

2.  **Router Enhancement:** The two-stage router will be taught to recognize and extract details for these new email intents, using specialized prompts for each.

3.  **Specialized Handlers:** We will create new handler functions for each intent:
    *   `_handle_compose_email_intent`: Generates a subject/body and calls `create_draft_email`. Returns a `draft_review` object.
    *   `_handle_reply_to_email_intent`: A multi-step handler that will first use the `get_email_details` tool to find the context of the conversation, then generate a reply and use `create_draft_email` to create the draft, returning a `draft_review` object.
    *   `_handle_send_email_draft_intent`: A simple handler that calls the `send_draft` tool with the provided `draft_id`.

## 4. Refined Frontend Implementation

We will enhance the existing chat components to create a seamless and scalable "Draft, Review, Approve" workflow.

1.  **API Response:** The backend will be modified to return a new response `type: "draft_review"`, which will include the `draft_id` and its content.
2.  **`GeneralPurposeChatWrapper.tsx`:** This existing smart component will be enhanced to handle the new `draft_review` response type. It will manage the state and pass the necessary props to the UI component.
3.  **`ChatSidebarUI.tsx`:** This UI component will be updated to render a new "Draft Review Card" when it receives draft data. This card will display the `To`, `Subject`, and `Body`, and must contain two buttons: **"Send Email"** and **"Cancel"**.
4.  **Approval Workflow:** When the user clicks "Send Email," the `GeneralPurposeChatWrapper` will send a structured message to the backend (e.g., `{"user_action": "send_draft", "draft_id": "xyz123"}`). This will trigger the `send_email_draft` intent in the orchestrator, completing the loop.

## 5. Conversational Workflow Example (Test Case #3)

1.  **User:** "Help me reply to Jane. Tell her I'll have the report ready by 5 PM."
2.  **Frontend -> Backend**: Sends the user's prompt.
3.  **Backend (AI Orchestrator)**:
    -   Classifies intent as `reply_to_email`.
    -   Extracts details.
    -   The `_handle_reply_to_email_intent` is called. It first uses `find_email` or `list_emails` to find the correct `thread_id` for the conversation with Jane.
    -   It then calls `create_draft_email` to generate the draft.
4.  **Backend -> Frontend**: Responds with a `type: "draft_review"` object containing the draft details.
5.  **Frontend (`GeneralPurposeChatWrapper`)**: Receives the response, updates its state, and passes props to `ChatSidebarUI` to render the "Draft Review Card".
6.  **User**: Reviews the card and clicks **"Send Email"**.
7.  **Frontend -> Backend**: Sends a new message with a structured input like `{"user_action": "send_draft", "draft_id": "dr_abc789"}`.
8.  **Backend (AI Orchestrator)**:
    -   Classifies the new intent as `send_email_draft`.
    -   The `_handle_send_email_draft_intent` calls the `send_draft` tool.
    -   The AI sends a final confirmation message.
9.  **Frontend**: Displays the final confirmation message, "Done. I've sent the email to Jane."

This refined plan provides a clear and robust path forward, leveraging our advanced architecture for a secure and intuitive user experience.
