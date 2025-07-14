# Minus AI Agent: Phase 4 Implementation Plan - Docs Conversational Partner (Final)

## 1. Vision & Goal

The goal is to build a "Conversational Document Partner," a hybrid system combining a visual document editor with a context-aware AI. This will allow users to list, create, summarize, draft, and edit their Google Docs through a seamless, state-driven workflow. All modifications will use Google's native suggestion feature, governed by a conversational "Draft, Review, Approve/Reject" paradigm.

## 2. Core Architecture: The State-Driven UI

The architecture is based on a clean, state-driven UI that swaps components based on the user's context, as finalized in our discussions. It is not a two-panel layout displayed simultaneously, but rather a replacement of components within a consistent layout.

-   **General Mode (Dashboard View):**
    -   **Trigger:** The user is on the main docs dashboard (e.g., `/docs`).
    -   **Layout:** The main content area displays the document list. The AI sidebar on the right renders the `GeneralPurposeChatWrapper`.
    -   **Function:** Used for high-level document management (listing, creating).

-   **Focused Mode (Document View):**
    -   **Trigger:** The user opens a specific document (e.g., navigating to `/docs/{documentId}`).
    -   **Layout:** The main content area displays the `DocView` component (containing the `<iframe>`). The AI sidebar on the right is **replaced** with the `DocsChat` component.
    -   **Function:** Used for all work related to the open document. The `DocsChat` component is context-aware and all its conversation pertains only to that document.

## 3. User Workflows & Test Case Coverage

This architecture cleanly implements all discussed test cases.

1.  **List Documents:** Handled in General Mode via the `GeneralPurposeChatWrapper`.
2.  **Create Document:** Handled in General Mode. The AI uses the `create_document` tool and can proactively offer to navigate the user to the new document's Focused Mode.
3.  **Open/Close Document:** This is managed by the application's routing. Navigating to a document's URL enters Focused Mode. Navigating back to the main dashboard returns to General Mode, swapping the chat components correctly.
4.  **Summarize & Edit Document:** All in-document actions are handled conversationally within Focused Mode via the dedicated `DocsChat` component.

## 4. Backend Implementation: The Google Docs AI Toolset

The backend toolset is finalized and remains as previously defined.

-   **Tool File:** `backend/app/tools/google_docs_tools.py`
-   **Final Toolset:**
    -   `list_documents(query: str)`
    -   `create_document(title: str)`
    -   `draft_initial_content(document_id: str, content: str)`
    -   `get_document_content(document_id: str, summarize: bool)`
    -   `create_document_suggestion(document_id: str, ...)`
    -   `apply_document_suggestion(suggestion_id: str)`
    -   `reject_document_suggestion(suggestion_id: str)`

## 5. Frontend Implementation: The Final Plan

The frontend implementation will leverage the existing `DocsChat.tsx` component and orchestrate the view swapping within `DocsDashboard.tsx`.

-   **Parent Orchestrator (`pages/DocsDashboard.tsx`):**
    -   This component will contain the logic to conditionally render the main content and the AI sidebar based on the URL route.
    -   If the route is `/docs`, it renders the document list and `GeneralPurposeChatWrapper`.
    -   If the route is `/docs/{documentId}`, it renders `DocView.tsx` and `DocsChat.tsx`.

-   **Focused Mode Chat (`components/docs/DocsChat.tsx`):**
    -   This component is nearly complete. The work is to make its "Approve" and "Reject" handlers fully functional.
    -   **`handleApproveTool` Modification:** This function must be updated to send a **new message** to the `POST /api/v1/assistant/chat` endpoint. The payload of this message must clearly signal user approval and provide the necessary data (the `tool_input` containing the `suggestion_id`) for the AI to execute the final action.
        -   *Example Message:* `"User approved the action. Please execute."`
        -   *Example Payload:* `{ "message": "...", "context": { "approved_tool_input": { "suggestion_id": "s-123" } } }`
    -   **`handleRejectTool` Modification:** This function will be updated similarly, sending a message that tells the AI the user has rejected the proposed action, allowing the AI to call the `reject_document_suggestion` tool.

## 6. Detailed Workflow Example: The Full Conversational Loop

1.  **User (in Focused Mode, via `DocsChat`):** "Suggest changing 'Q3' to 'Q4' in the title."
2.  **AI Backend:** Calls `create_document_suggestion(...)` and gets back `suggestion_id: "s-789"`. It stores this ID in the conversation's memory.
3.  **AI Frontend (`DocsChat`):** Receives a `tool_draft` response from the AI. It renders the assistant's message ("I've suggested that change...") and the "Approve" / "Reject" buttons.
4.  **User:** Clicks the **"Approve"** button.
5.  **AI Frontend (`handleApproveTool`):** Sends a new message to the backend: `"User confirmed."` The request payload includes the context that this approval is for the action related to `suggestion_id: "s-789"`.
6.  **AI Backend:** Receives the approval. It retrieves the `suggestion_id` from its memory and calls the **`apply_document_suggestion(suggestion_id="s-789")`** tool.
7.  **UI:** The change is applied and becomes visible in the `<iframe>`. The AI sends a final confirmation to the chat: "Done. The document has been updated."
