# Minus AI Agent: Phase 4 Implementation Plan - Docs Collaborative Writing Partner

## 1. Vision & Goal

The goal of this phase is to evolve beyond a simple document editor into a "Conversational Document Partner." This hybrid system will combine a visual document editor with a context-aware AI, allowing users to list, create, summarize, draft, and edit their Google Docs through a seamless workflow. All modifications will respect the "Draft, Review, Approve" paradigm, using Google's native suggestion feature as the core mechanism for safe and transparent editing.

## 2. Core Architecture: The Two-Mode System

To ensure a clean and robust user experience, we will implement a dual-mode system that separates high-level document management from focused, in-document work. This approach, particularly the use of a dedicated chat wrapper, prevents "context contamination," where the history from one document could interfere with the AI's understanding when working on another.

-   **1. General Mode (The Dashboard):**
    -   **UI:** The user interacts with the standard `GeneralPurposeChatWrapper`.
    -   **Capabilities:** From the main dashboard, the user can perform actions that are not tied to a specific open document, such as listing all their existing documents or initiating the creation of a new one.

-   **2. Focused Mode (The Writing Environment):**
    -   **UI:** When a document is opened, the application transitions. The main view will render the Google Doc in an `<iframe>`, and the chat sidebar will be replaced by a dedicated `DocsChatWrapper`.
    -   **Context-Awareness:** This wrapper is the key to our architecture. It receives the `document_id` as a prop and maintains its own isolated chat history. Every command given through this wrapper will automatically include the document's context, ensuring the AI is always aware of which document the user is working on. When the user closes the document, this component and its history are unmounted, guaranteeing a clean slate.

## 3. User Workflows & Test Case Coverage

This plan implements the full range of workflows discussed, including the more proactive creation flow.

1.  **List Documents:** In General Mode, the user asks, "What documents do I have?" The AI uses the `list_documents` tool and presents the results.
2.  **Open Document:** The user asks to open a document by name. The UI transitions to Focused Mode, loading the document and the `DocsChatWrapper`. The AI now holds the `document_id` in its `ConversationState`.
3.  **Create Document (Proactive Workflow):**
    -   **User (General Mode):** "Create a document for my project proposal."
    -   **AI:** "I can do that. What would you like to title it?"
    -   **User:** "Q1 Marketing Strategy."
    -   **AI (Action):** Immediately calls `create_document(title="Q1 Marketing Strategy")`. A blank document is created.
    -   **AI (Response & Proactive Offer):** "Okay, I've created the blank document 'Q1 Marketing Strategy' for you. **Would you like me to draft an outline for a standard marketing plan to get you started?**"
    -   **User's Choice:** If the user agrees, the AI generates the content and uses the `draft_initial_content` tool to populate the document. If they decline, the workflow ends.
4.  **Summarize Document:** In Focused Mode, the user asks, "Summarize this for me." The AI, already aware of the `document_id`, uses the `get_document_content` tool.
5.  **Edit Document (Suggestion Workflow):** For any change to existing content in Focused Mode (e.g., "In the second paragraph, change 'is good' to 'is excellent'"), the AI will use the `create_document_suggestion` tool, wait for the user's verbal "yes" or "go ahead" confirmation, and then use the `apply_document_suggestion` tool.

## 4. Backend Implementation: The Google Docs AI Toolset

The AI Orchestrator will be equipped with a refined suite of tools for Google Docs.

-   **Tool File:** `backend/app/tools/google_docs_tools.py`

### 4.1. The Refined Toolset

-   **`list_documents(query: str)`**
    -   **Description:** "Searches the user's Google Drive for documents matching a query string."

-   **`create_document(title: str)`**
    -   **Description:** "Creates a new, **blank** Google Doc with the specified title in the user's Google Drive."
    -   **Returns:** The `document_id` of the newly created document.

-   **`draft_initial_content(document_id: str, content: str)`**
    -   **Description:** "For a **new or empty document**, appends the initial draft content directly to the document body. This tool should only be used to populate a document for the first time before any other edits have been made."
    -   **Returns:** A success confirmation.

-   **`get_document_content(document_id: str, summarize: bool = False)`**
    -   **Description:** "Retrieves the full text content of a specified Google Doc. Can optionally summarize the content."

-   **`create_document_suggestion(document_id: str, target_text: str, replacement_text: str)`**
    -   **Description:** "Finds a specific piece of text in a document and creates an official Google Docs suggestion to replace it. **This is the primary tool for all edits and additions after the initial draft.** It does NOT apply the change."
    -   **Returns:** The unique `suggestion_id`.

-   **`apply_document_suggestion(suggestion_id: str)`**
    -   **Description:** "Accepts and applies a specific pending suggestion in a document. This is the 'approve' step."

-   **`reject_document_suggestion(suggestion_id: str)`**
    -   **Description:** "Rejects and deletes a specific pending suggestion from a document."

## 5. Frontend Implementation: The Collaborative Environment UI

-   **Parent Component (`pages/DocsDashboard.tsx` or similar):** Will manage the state between the two modes, conditionally rendering either the `GeneralPurposeChatWrapper` or the Focused Mode view.

-   **Focused Mode View (`pages/DocView.tsx`):** This page will render the two-panel layout:
    -   **Left Panel:** An `<iframe>` that renders the Google Doc (`https://docs.google.com/document/d/{document_id}/edit?embedded=true`).
    -   **Right Panel:** The new `DocsChatWrapper` component.

-   **`DocsChatWrapper.tsx` (New Smart Wrapper):**
    -   Receives the `document_id` as a prop.
    -   Manages its own isolated chat history.
    -   Automatically includes the `document_id` in the `ui_context` for every call to the AI backend, ensuring all conversation is about the active document.
