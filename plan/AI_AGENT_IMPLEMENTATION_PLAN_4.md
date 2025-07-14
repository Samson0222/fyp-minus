# Minus AI Agent: Phase 4 Implementation Plan - Docs Conversational Partner (Final)

## 1. Vision & Goal

The goal is to build a "Conversational Document Partner," a hybrid system combining a visual document editor with a context-aware AI. This will allow users to list, create, summarize, draft, and edit their Google Docs through a seamless, state-driven workflow. All modifications will use Google's native suggestion feature, governed by a conversational "Draft, Review, Approve/Reject" paradigm.

## 2. Core Architecture: The State-Driven UI

The architecture is based on a clean, state-driven UI that swaps components based on the user's context, as finalized in our discussions. It is not a two-panel layout displayed simultaneously, but rather a replacement of components within a consistent layout.

-   **General Mode (Dashboard View):**
    -   **Trigger:** The user is on the main docs dashboard (e.g., `/docs`).
    -   **Layout:** The main content area displays the document list. The AI sidebar on the right renders the `GeneralPurposeChatWrapper`.
    -   **Function:** Used for high-level document management (listing, creating, opening).

-   **Focused Mode (Document View):**
    -   **Trigger:** The user opens a specific document (e.g., navigating to `/docs/{documentId}`).
    -   **Layout:** The main content area displays the `DocView` component (containing the `<iframe>`). The AI sidebar on the right is **replaced** with the `DocsChat` component.
    -   **Function:** Used for all work related to the open document. The `DocsChat` component is context-aware and all its conversation pertains only to that document.

## 3. User Workflows & Test Case Coverage

This architecture cleanly implements all discussed test cases.

1.  **List Documents:** Handled in General Mode.
2.  **Create Document:** Handled in General Mode.
3.  **Open Document:** Handled in General Mode, which then triggers a navigation to Focused Mode.
4.  **Close Document:** Handled in Focused Mode, which triggers a navigation back to General Mode.
5.  **Summarize & Edit Document:** All in-document actions are handled conversationally within Focused Mode.

## 4. Backend Implementation: The Google Docs AI Toolset

The backend implementation requires a specific set of tools and a corresponding set of intents for the AI to use them.

### 4.1. The Final Toolset
-   **Tool File:** `backend/app/tools/google_docs_tools.py`
-   **Tools:**
    -   `list_documents(query: str)`: Searches Drive for documents.
    -   `get_document_details(query: str)`: Fetches metadata for a single, specific document by name. Used to find the `document_id` before opening.
    -   `create_document(title: str)`: Creates a new, blank document.
    -   `draft_initial_content(document_id: str, content: str)`: Populates an empty document with a first draft.
    -   `get_document_content(document_id: str, summarize: bool)`: Retrieves or summarizes the text of a doc.
    -   `create_document_suggestion(document_id: str, ...)`: Creates a suggestion for an edit.
    -   `apply_document_suggestion(suggestion_id: str)`: Applies a suggestion.
    -   `reject_document_suggestion(suggestion_id: str)`: Rejects a suggestion.

### 4.2. AI Intents
The AI Orchestrator will be trained to recognize the following intents:
-   `list_documents`
-   `create_document`
-   `open_document`
-   `close_document` (Navigational command)
-   `summarize_document`
-   `draft_in_document`
-   `edit_document`
-   `apply_suggestion`
-   `reject_suggestion`

## 5. Frontend Implementation: The Final Plan

The frontend implementation remains as previously defined, swapping components based on the URL route, managed by a parent orchestrator component like `DocsDashboard.tsx`. The key work is to ensure `DocsChat.tsx` and the main AI wrapper can handle their respective intents and tool-related UI (like "Approve/Reject" buttons or navigation commands).

## 6. Detailed Workflow Example: The Full Conversational Lifecycle

This scenario demonstrates the seamless flow from discovery to editing to closing a document.

**Scene 1: General Mode (Dashboard)**
1.  **User:** "Show me my recent documents."
2.  **AI Backend:**
    -   **Intent:** `list_documents`
    -   **Tool Call:** `list_documents(query="*")`
    -   **Response:** "I found 'Q1 Marketing Strategy', 'Project Phoenix Notes', and 'Team Meeting Agenda'. Which one would you like to open?"
3.  **User:** "The marketing strategy one."
4.  **AI Backend:**
    -   **Intent:** `open_document`
    -   **Tool Call:** `get_document_details(query="Q1 Marketing Strategy")` -> returns `{ document_id: "doc-abc-123" }`.
    -   **State Update:** The AI saves `"doc-abc-123"` to `ConversationState`.
    -   **Response:** Sends a special `navigation` command to the frontend: `{ "type": "navigation", "details": { "target_url": "/docs/doc-abc-123" } }`.
5.  **UI Frontend:** Receives the navigation command and routes the user to `/docs/doc-abc-123`. This automatically triggers the switch to **Focused Mode**.

**Scene 2: Focused Mode (Document View)**
6.  **UI:** The `DocView` component renders the marketing document in an `<iframe>`. The `DocsChat` component is now active in the sidebar.
7.  **User (via `DocsChat`):** "Suggest changing 'an effective strategy' to 'a proven and effective strategy'."
8.  **AI Backend:**
    -   **Intent:** `edit_document`. The `document_id` is automatically included from the `DocsChat` context.
    -   **Tool Call:** `create_document_suggestion(...)`. The Google API returns `suggestion_id: "s-789"`.
    -   **Response:** The AI sends a `tool_draft` response back to the `DocsChat` UI, asking for approval.
9.  **User:** Clicks the "Approve" button in the `DocsChat` UI.
10. **AI Backend:** Receives the approval command, retrieves the `suggestion_id` from memory, and calls `apply_document_suggestion(suggestion_id="s-789")`.
11. **UI:** The suggestion is applied in the `<iframe>`. The AI confirms in chat: "Done. The document has been updated."

**Scene 3: Exiting Focused Mode**
12. **User (via `DocsChat`):** "Okay, I'm done. Go back to the dashboard."
13. **AI Backend:**
    -   **Intent:** `close_document`.
    -   **State Update:** The AI clears the `document_id` from its memory.
    -   **Response:** Sends another `navigation` command: `{ "type": "navigation", "details": { "target_url": "/docs" } }`.
14. **UI Frontend:** Receives the command and navigates back to `/docs`, which automatically switches the UI back to **General Mode**.
