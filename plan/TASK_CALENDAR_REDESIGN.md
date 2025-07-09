# Plan: Migrating from Custom Tasks to Google Calendar Events

This document outlines the plan to decommission the internal task management module and rely exclusively on the existing Google Calendar integration for all task-related functionalities. This simplifies the system, reduces maintenance, and provides a more integrated user experience.

## 1. Analysis of Redundant Components

The following files and database methods are tied to the legacy task module and have been identified for removal or modification.

### Frontend (To Be Deleted)

-   **Component Directory:** `frontend/src/components/tasks/`
    -   This entire directory, including all its sub-components (`CreateTaskModal.tsx`, `task-list-view.tsx`, `calendar-view.tsx`, etc.), will be deleted.
    -   The experimental rich text editor components (`QuillEditor.tsx`, `quill-editor.css`, etc.) will also be removed.
-   **Pages:** All pages related to the old task views.
    -   `frontend/src/pages/Tasks.tsx`
    -   `frontend/src/pages/TasksDebug.tsx`
    -   `frontend/src/pages/TasksSimple.tsx`
    -   `frontend/src/pages/TasksWorking.tsx`
    -   And all other `Tasks*.tsx` variants and backups.
-   **Type Definitions:** The data model for the old tasks.
    -   `frontend/src/types/task.ts`
-   **API Client:** The frontend API client for the old task endpoints.
    -   `frontend/src/lib/api/tasks.ts` (if it exists)

### Backend (To Be Deleted or Modified)

-   **API Router (Delete):**
    -   `backend/app/routers/tasks.py`
-   **Data Model (Delete):**
    -   `backend/app/models/task.py`
-   **Database Methods (Modify):** The following methods will be removed from `backend/app/core/database.py`:
    -   `create_task()`
    -   `get_tasks()`
    -   `get_task_by_id()`
    -   `update_task()`
    -   `delete_task()`
-   **Main Application (Modify):** The task router inclusion will be removed from `backend/app/main.py`.

## 2. The Migration & Development Prompt

Below is a comprehensive prompt that can be used in a new chat session to execute this migration. It includes the step-by-step instructions, the "why" behind the changes, and the expected outcome.

---

### **Prompt for New Chat Session**

**Your Goal:** Your primary mission is to refactor the application by completely removing the custom-built task management module and delegating all its functionality to the existing Google Calendar integration. Users will now manage their tasks as events directly on their Google Calendar through our system.

**Guiding Principles:**
1.  **Simplify:** The goal is to reduce complexity. We are removing an entire feature to replace it with a more robust, existing integration.
2.  **Consolidate:** All task-like actions should now be calendar-event actions.
3.  **Cleanup:** Ensure no orphaned files, routes, or database functions from the old task system remain.

**Step-by-Step Execution Plan:**

**Phase 1: Backend Decommissioning**

1.  **Delete the Task Router:**
    -   Delete the file: `backend/app/routers/tasks.py`.

2.  **Delete the Task Data Model:**
    -   Delete the file: `backend/app/models/task.py`.

3.  **Update the Main App:**
    -   Open `backend/app/main.py`.
    -   Find the line that imports and includes the `tasks_router` (e.g., `from app.routers import tasks` and `app.include_router(tasks.router)`).
    -   Remove both of these lines.

4.  **Clean the Database Logic:**
    -   Open `backend/app/core/database.py`.
    -   Carefully search for and delete the following methods from the `SupabaseManager` class:
        -   `create_task`
        -   `get_tasks`
        -   `get_task_by_id`
        -   `update_task`
        -   `delete_task`

**Phase 2: Frontend Decommissioning**

1.  **Remove Task Pages:**
    -   Delete all files in `frontend/src/pages` that start with `Tasks` (e.g., `Tasks.tsx`, `TasksWorking.tsx`, etc.).

2.  **Remove Task Components Directory:**
    -   Delete the entire directory: `frontend/src/components/tasks/`.

3.  **Remove Old Type Definition:**
    -   Delete the file: `frontend/src/types/task.ts`.

4.  **Clean Up App Routing:**
    -   Open `frontend/src/App.tsx`.
    -   Find and remove the `Route` component(s) that point to the now-deleted `Tasks` pages (e.g., `<Route path="/tasks" ... />`).
    -   Also remove the corresponding import statements for those pages.

**Phase 3: UI/UX Adaptation (The Creative Part)**

After the cleanup, the system will only have a Calendar view. Now, we must adapt the UI to make it the central place for managing "tasks" (which are now "events").

1.  **Rename "Calendar" to "Schedule" or "Planner":**
    -   In the main sidebar (`frontend/src/components/layout/Sidebar.tsx`), find the link to the calendar page.
    -   Rename its label from "Calendar" to something more encompassing like "Schedule" or "Planner" to reflect its new dual purpose.

2.  **Create a Clear "Add Event" Button:**
    -   The current calendar page needs a primary, obvious button to create a new event. Add a button, perhaps labeled "+ New Event" or "+ Add to Calendar", in a prominent location (e.g., top right corner of the calendar view).

3.  **Adapt the "Create Event" Modal:**
    -   Clicking the new button should open a modal.
    -   This modal should be a simplified version of the old "Create Task" modal but adapted for calendar events. It needs fields for:
        -   **Title:** (The event name)
        -   **Date & Time:** (Start and End times)
        -   **Description:** (For notes)
    -   The "Save" button in this modal will call the backend endpoint that creates a Google Calendar event (`POST /api/v1/calendar/events`).

4.  **Enhance the Voice Command for Task Creation:**
    -   The voice interaction logic should be updated. When a user says "Create a new task..." or "Remind me to...", the system should understand this as a request to create a *calendar event*.
    -   The AI should prompt the user for the necessary details (what, when) and then call the same "create event" endpoint. For example:
        -   User: "Hey Minus, create a task to call the doctor tomorrow."
        -   AI: "Okay, at what time tomorrow should I schedule the call to the doctor?"
        -   User: "2 PM."
        -   *System creates a calendar event titled "Call the doctor" for tomorrow at 2 PM.*

**Final Verification:**
-   After all steps are complete, run the application.
-   Ensure the old "Tasks" menu is gone.
-   Verify that you can create, view, and manage events on the calendar page.
-   Test the voice command to ensure it correctly creates a calendar event from a task-like instruction.

