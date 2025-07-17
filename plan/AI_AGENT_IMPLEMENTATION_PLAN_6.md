# Final Implementation Plan: Voice Integration (MVP) - (Revised)

## 0. Prerequisites: Enabling Google Cloud Services

Before implementing the voice features, you must enable the necessary APIs in your Google Cloud Project.

1.  **Navigate to the Google Cloud Console:** Go to [https://console.cloud.google.com/](https://console.cloud.google.com/).
2.  **Select Your Project:** Ensure you have selected the project linked to your application's credentials.
3.  **Enable the Speech-to-Text API:**
    *   In the navigation menu, go to `APIs & Services > Library`.
    *   Search for "Cloud Speech-to-Text API".
    *   Click on it and then click the **Enable** button.
4.  **Enable the Text-to-Speech API:**
    *   In the API Library, search for "Cloud Text-to-Speech API".
    *   Click on it and then click the **Enable** button.
5.  **Billing:** Ensure that billing is enabled for your project, as these are paid services.

## 1. Objective

To integrate real-time Speech-to-Text (STT) and Text-to-Speech (TTS) into the existing chat interface, enabling a core voice-first conversational experience. This plan prioritizes stability and rapid implementation.

## 2. Technology Stack

-   **Speech-to-Text (STT):** Google Cloud Speech-to-Text API
-   **Text-to-Speech (TTS):** Google Cloud Text-to-Speech API
-   **Backend:** FastAPI (for secure proxying of API calls)

## 3. Core Concept: "Transcribe Behind the Scenes"

To ensure a stable and achievable implementation, we will adopt a "transcribe behind the scenes" model for STT.

-   **User Experience:** The user will press the microphone button, speak, and the UI will indicate that it is listening. The live transcription will **not** be displayed. Once the user finishes speaking, the final transcript will appear as a new chat bubble and be sent to the backend agent.
-   **Rationale:** This approach simplifies frontend state management and avoids the complexities of rendering a live text stream, making it faster to build and test.

## 4. UI State and Interaction Model

The interaction area at the bottom of the chat sidebar will have three primary states, managed by `isListening: boolean` and `isSpeaking: boolean` in the wrapper component.

-   **State 1: Idle (Default)**
    -   **UI:** The text input is active, a microphone icon (🎤) is visible, and the secondary action button is hidden.
    -   **Function:** The user can either type or click the microphone to start voice input.

-   **State 2: Listening (STT is active)**
    -   **Trigger:** User clicks the microphone icon.
    -   **UI:** Text input is disabled. The microphone icon shows a "listening" state (e.g., pulsing). A secondary action button (❌) appears.
    -   **Button Function:** The ❌ button's function is **"Cancel"**.

-   **State 3: Speaking (TTS is active)**
    -   **Trigger:** The assistant has generated a text response and is playing the audio.
    -   **UI:** Text input and microphone are disabled. The secondary action button (❌) appears.
    -   **Button Function:** The ❌ button's function is **"Stop Speaking"**.

## 5. Backend API Architecture: Securing API Calls

To avoid exposing Google API keys in the frontend, all calls to Google services will be proxied through our own secure backend. This is a critical security requirement.

-   **STT Endpoint: `POST /api/v1/stt/transcribe`**
    -   **Request:** The frontend sends the raw audio data (e.g., as a Blob).
    -   **Action:** The FastAPI backend receives the audio, securely forwards it to the Google STT API using the server-side API key.
    -   **Response:** The backend receives the transcript from Google and sends it back to the frontend as a JSON response.

-   **TTS Endpoint: `POST /api/v1/tts/synthesize`**
    -   **Request:** The frontend sends the AI's text response as a JSON payload.
    -   **Action:** The backend calls the Google TTS API.
    -   **Response:** The backend streams the resulting audio data directly back to the frontend, which can be played immediately using the browser's audio APIs.

## 6. Detailed Workflows & Implementation

### Workflow A: Speech-to-Text (STT) - Capturing User Commands

1.  **User Initiates Voice Command**
    -   **User Action:** Clicks the microphone icon.
    -   **Frontend Action:** Set `isListening` state to `true`.

2.  **System Captures Audio & Sends to Backend**
    -   **Frontend:** The browser's `MediaRecorder` API captures audio.
    -   **Frontend:** The audio data is sent to our backend endpoint: `POST /api/v1/stt/transcribe`.

3.  **User Completes or Cancels Command**
    -   **Scenario 1: User Finishes Speaking**
        -   The system detects the end of speech (e.g., via a 1-2 second timeout of silence).
        -   The frontend receives the final transcript from the backend.
        -   The `isListening` state is set to `false`.
        -   The transcript is added to the chat history as a new user message bubble.
        -   The transcript is sent to the main assistant endpoint via the existing `handleSendMessage` function.
    -   **Scenario 2: User Clicks "Cancel"**
        -   The `handleCancel` function stops the audio capture and aborts the request to the backend.
        -   It sets `isListening` state to `false`.
        -   **Result:** The UI returns to the "Idle" state.

### Workflow B: Text-to-Speech (TTS) - Playing Assistant Responses

1.  **Assistant Responds**
    -   The ChatWrapper receives a final text response from the backend AI agent.

2.  **System Prepares to Speak**
    -   **Frontend Action:** Set `isSpeaking` state to `true`.

3.  **Audio is Generated and Played**
    -   **Frontend:** Sends the text response to our backend endpoint: `POST /api/v1/tts/synthesize`.
    -   **Backend:** Calls the Google TTS API and streams the audio response back.
    -   **Frontend:** The browser receives the audio stream and plays it immediately.

4.  **Playback Completes or is Stopped**
    -   **Scenario 1: Playback Finishes Naturally**
        -   The audio stream ends. The `isSpeaking` state is set to `false`.
    -   **Scenario 2: User Clicks "Stop Speaking"**
        -   The `handleStopSpeaking` function halts audio playback and sets `isSpeaking` to `false`.
    -   **Result:** The UI returns to the "Idle" state.

## 7. Implementation Considerations

-   **End-of-Speech Detection:** The end of a user's speech will be detected using a **timeout**. If the microphone receives no significant audio input for a short duration (e.g., 1.5 seconds), the recording will be considered complete.
-   **Error Handling:** If a Google API call fails, the backend proxy endpoint should catch the error and return a clear error status to the frontend. The UI will then display a user-friendly message (e.g., "Sorry, I couldn't hear that. Please try again.").
