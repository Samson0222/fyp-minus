# Telegram Integration & Implementation Plan

This document outlines the complete plan for integrating Telegram into the Minus system, based on the "Telegram Focus Mode" concept.

## 0. Prerequisites & Setup: Creating the Telegram Bot

This phase happens entirely on the Telegram platform and is a prerequisite for any code development.

1.  **Find BotFather:** Open your Telegram app and search for the official verified "BotFather" bot (it will have a blue checkmark).
2.  **Create a New Bot:** Start a chat with BotFather and type the command `/newbot`.
3.  **Follow Instructions:** BotFather will ask you for a display name and a unique username for your bot (the username must end in "bot", e.g., `MinusAssistantBot`).
4.  **Receive the API Token:** Upon successful creation, BotFather will provide you with a unique HTTP API token. It will look something like `1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11`.
5.  **Secure the Token:** This token is your bot's password. It grants full control.
    - **Action:** Copy this token.
    - **Action:** In the `backend` directory, create or open a `.env` file.
    - **Action:** Add the token to the `.env` file like this: `TELEGRAM_BOT_TOKEN="YOUR_TOKEN_HERE"`.
    - **CRITICAL:** The token must **never** be hardcoded directly into any Python files (`.py`). Reading it from an environment variable keeps it secure and separate from the source code.

## 1. High-Level Vision: "Telegram Focus Mode"

### 1.1. Core Concept

Instead of a simple sidebar integration, we will create an immersive "Focus Mode." This mode is designed to let the user deal with their Telegram messages efficiently without losing their current work context.

- **Trigger:** A notification icon (bell) in the main top navigation bar will indicate new messages. Clicking this icon or using a voice command ("Enter Telegram Mode") will activate the mode.
- **Visual State:** When activated, a translucent dark overlay will cover the main application content, visually pushing it to the background. A dedicated "Telegram Hub" UI component will appear, becoming the primary point of interaction.

### 1.2. User Experience Flow

1.  **Notification:** A badge appears on the top-right notification icon.
2.  **Activation:** The user clicks the icon, entering "Focus Mode."
3.  **Triage:** The user sees a summarized list of unread conversations in the "Telegram Hub."
4.  **Selection:** The user clicks on a conversation to view its history.
5.  **Interaction:** The message history for that chat appears in the lower part of the Hub.
6.  **Action:** The user can read the messages and manually type a reply in the dedicated text area.
7.  **Exit:** The user clicks outside the Hub or an exit button to dismiss the overlay and return to their previous task.

## 2. UI/UX Design Breakdown: The "Telegram Hub"

This design is based on the user-provided sketch. It's a two-pane "master-detail" layout within a modal-like component.

### 2.1. Component: Summarized Unread Chat List (Top Pane)

This is the "master" list of conversations with unread messages.

- **Layout:** Each item in the list will be a distinct, selectable component.
- **Data per Item:**
  - **Line 1:** `[Sender Name]` `[n unread message(s)]` `[Time of last message]`
  - **Line 2:** `Last Message: [Snippet of the last message content...]`
- **Functionality:**
  - It will be vertically scrollable if the list exceeds the viewport.
  - Clicking an item will select it (indicated by a hover effect and a persistent highlight, e.g., a purple border).
  - The selected item's full conversation will populate the "Telegram Chat Area" below.

### 2.2. Component: Telegram Chat Area (Bottom Pane)

This is the "detail" view for the selected conversation.

- **Content:** Displays the full message history for the selected chat, rendered as chat bubbles.
- **Reply Input:** A dedicated text area at the bottom for composing a reply.
- **Send Button:** A button to send the message typed in the text area.
- **Footer:** A final "Open in Telegram" button at the very bottom of the Hub to provide a quick link to the native application.

### 2.3. Interaction Model: System Chat vs. Telegram Chat

As per our discussion, we will maintain a separation of concerns between the main AI assistant chat and the Telegram reply area.

- **System Chat Sidebar:** The global AI chat sidebar remains active. The user can give commands to the assistant here (e.g., "Summarize this conversation for me").
- **Telegram Text Area:** The text area *inside the Telegram Hub* is specifically for the content of a reply. When a user asks the main AI to draft a message, the AI's output will appear in this text area, not in the main chat log. This allows for direct editing and review.

## 3. Phase 1: Foundational Implementation (Manual Workflow)

### 3.1. Guiding Principle: No Agentic AI (Yet)

**This is the most critical point for Phase 1.** The initial implementation will deliberately **exclude** AI-powered message drafting. The goal is to build a robust, fully functional UI and the backend "plumbing" first. The workflow will be entirely manual:

1.  User sees unread messages.
2.  User selects a conversation.
3.  User **manually types a reply** into the text area.
4.  User clicks "Send."

This ensures the core infrastructure is solid before we introduce the complexity of the agentic workflow. The agentic features will be built on top of this foundation in Phase 2.

### 3.2. Backend Implementation (FastAPI)

- **3.2.1. Database Model:** Create a new SQLAlchemy model (e.g., `TelegramMessage`) to store incoming messages. It should include `chat_id`, `message_id`, `sender_name`, `content`, `timestamp`, and a boolean `is_read`.
- **3.2.2. Core Service (`telegram_service.py`):** A new service file containing a `send_message(chat_id, text)` function that makes a POST request to the Telegram Bot API using the token from the `.env` file.
- **3.2.3. Real-time Infrastructure:**
  - **Webhook Endpoint (`/webhook/telegram`):** Receives updates from Telegram, parses them, and saves them to the `TelegramMessage` table in the database.
  - **WebSocket Endpoint (`/ws/notifications`):** After the webhook saves a new message, it will use this WebSocket to push a notification event to all connected frontend clients (e.g., `{ "event": "new_telegram_message", "unread_count": 5 }`).
  - **Webhook Registration:** Once the backend is deployed, we must perform a one-time API call to register our webhook URL with Telegram: `https://api.telegram.org/bot<YOUR_TOKEN>/setWebhook?url=<YOUR_DEPLOYED_URL>/webhook/telegram`.
- **3.2.4. API Endpoints for UI:**
  - `GET /api/v1/telegram/unread_summary`: Fetches and formats the data for the "Summarized Unread Chat List."
  - `GET /api/v1/telegram/conversation/{chat_id}`: Fetches the full message history for a selected conversation.
  - `POST /api/v1/telegram/send`: Receives a `chat_id` and `message` from the frontend's "Send" button and uses `telegram_service` to dispatch the message.

### 3.3. Frontend Implementation (React)

- **3.3.1. Global State & Real-time Client:**
  - Implement a global WebSocket client that connects to the backend on app load.
  - Use a global state management solution (e.g., React Context) to hold `telegramUnreadCount` and `isTelegramModeActive`. The WebSocket client will update this state.
- **3.3.2. Top Navigation Bar (`TopNav.tsx`):** Add a notification icon component that displays the `telegramUnreadCount` from the global state and toggles `isTelegramModeActive` on click.
- **3.3.3. `TelegramFocusMode.tsx` Component:**
  - The main container for the Hub. Conditionally rendered as an overlay on the entire application when `isTelegramModeActive` is true.
  - It will be responsible for fetching data from the `/unread_summary` and `/conversation/{chat_id}` endpoints.
- **3.3.4. Sub-components:**
  - `UnreadChatItem.tsx`: Renders each item in the top list.
  - `ConversationView.tsx`: Renders the message history in the bottom pane.

## 4. Phase 2: Agentic Workflow Integration (Future Step)

### 4.1. Concept

Once the foundational UI and backend are stable, we will integrate the Gemini-powered agent to enhance the workflow. The agent will be able to perform actions like summarizing conversations and drafting replies based on user commands in the main system chat.

### 4.2. "Draft & Approve" Workflow

The manual text area in the Telegram Hub will be upgraded. When a user asks the AI to draft a reply:
- The AI-generated text will populate the text area.
- Additional buttons like `[Redraft]` and `[Cancel]` will appear next to the `[Send]` button.
- The user can then directly edit the text, ask the AI to redraft it, or approve it for sending. This provides a seamless blend of AI assistance and user control.
