# Data Models

This document outlines the database schema for the Minus project. This schema is generated directly from the live database structure.

## Core Tables

### `user_profiles`

Stores user account information and preferences. Linked to Supabase's `auth.users` table.

-   `id` (UUID, Primary Key): Foreign key to `auth.users.id`.
-   `email` (TEXT, Unique, Not Null): User's email address.
-   `full_name` (TEXT): User's full name.
-   `avatar_url` (TEXT): URL for the user's avatar image.
-   `accessibility_preferences` (JSONB): Stores user-specific accessibility settings (e.g., `{"high_contrast": true}`).
-   `voice_settings` (JSONB): Stores user-specific voice settings.
-   `created_at` (TIMESTAMPTZ): Timestamp of profile creation.
-   `updated_at` (TIMESTAMPTZ): Timestamp of the last profile update.

### `voice_interactions`

Logs each voice command processed by the system.

-   `id` (UUID, Primary Key): Unique identifier for the interaction.
-   `user_id` (UUID, Foreign Key): Links to `user_profiles.id`.
-   `transcribed_text` (TEXT, Not Null): The text transcribed from user's voice.
-   `confidence` (REAL): The confidence score of the transcription.
-   `command_intent` (TEXT): The classified intent of the command.
-   `response_text` (TEXT): The text response generated by the assistant.
-   `processing_time_ms` (INTEGER): Time taken to process the command in milliseconds.
-   `audio_duration_ms` (INTEGER): Duration of the input audio in milliseconds.
-   `platform_context` (JSONB): Contextual information (e.g., active application).
-   `created_at` (TIMESTAMPTZ): Timestamp of the interaction.

### `conversations`

Stores the history of interactions within a session for conversational context.

-   `id` (UUID, Primary Key): Unique identifier for the message.
-   `user_id` (UUID, Foreign Key): Links to `user_profiles.id`.
-   `session_id` (TEXT, Not Null): Identifier for a continuous conversation session.
-   `message_type` (TEXT): Type of message (`user_text`, `user_voice`, `assistant`, `system`).
-   `content` (TEXT, Not Null): The content of the message.
-   `metadata` (JSONB): Any additional metadata for the message.
-   `created_at` (TIMESTAMPTZ): Timestamp of the message.

## Platform Integration Tables

### `platform_integrations`

Manages authentication tokens and settings for integrated platforms.

-   `id` (UUID, Primary Key): Unique identifier for the integration record.
-   `user_id` (UUID, Foreign Key): Links to `user_profiles.id`.
-   `platform_name` (TEXT, Not Null): Name of the platform (`gmail`, `google_calendar`, `google_docs`, `telegram`).
-   `access_token` (TEXT): OAuth access token.
-   `refresh_token` (TEXT): OAuth refresh token.
-   `token_expires_at` (TIMESTAMPTZ): Expiry date for the access token.
-   `integration_settings` (JSONB): Platform-specific settings.
-   `is_active` (BOOLEAN): Whether the integration is currently active.
-   `created_at` (TIMESTAMPTZ): Timestamp of creation.
-   `updated_at` (TIMESTAMPTZ): Timestamp of the last update.

### `google_calendar_channels`

Stores information about active Google Calendar push notification channels (webhooks).

-   `id` (UUID, Primary Key): Unique identifier for the channel record.
-   `user_id` (UUID, Foreign Key): Links to `user_profiles.id`.
-   `channel_id` (VARCHAR, Not Null): The unique ID for the notification channel provided by Google.
-   `resource_id` (VARCHAR, Not Null): The ID of the resource being watched (e.g., a calendar ID).
-   `expires_at` (TIMESTAMPTZ, Not Null): When the notification channel expires.
-   `created_at` (TIMESTAMPTZ): Timestamp of creation.
-   `updated_at` (TIMESTAMPTZ): Timestamp of the last update.

### `monitored_chats`

Stores user consent and information about which Telegram chats to monitor.

-   `id` (UUID, Primary Key): Unique identifier for the monitored chat record.
-   `user_id` (UUID, Foreign Key): Links to `user_profiles.id`.
-   `chat_id` (BIGINT, Not Null): The Telegram chat ID.
-   `chat_name` (TEXT, Not Null): The name of the Telegram chat.
-   `chat_type` (TEXT): Type of chat (`private`, `group`, `supergroup`, `channel`).
-   `is_active` (BOOLEAN, Default: false): Whether the chat is actively being monitored.
-   `user_consent` (BOOLEAN, Default: false): Explicit flag indicating user has given consent to monitor this chat.
-   `created_at` (TIMESTAMPTZ): Timestamp of creation.
-   `updated_at` (TIMESTAMPTZ): Timestamp of the last update.

### `telegram_messages`

Stores messages retrieved from monitored Telegram chats.

-   `id` (UUID, Primary Key): Unique identifier for the message.
-   `monitored_chat_id` (UUID, Foreign Key): Links to `monitored_chats.id`.
-   `message_id` (BIGINT, Not Null): The message's unique ID from Telegram.
-   `sender_name` (TEXT, Not Null): The name of the message sender.
-   `telegram_sender_id` (BIGINT, Not Null): The sender's permanent Telegram user ID.
-   `content` (TEXT, Not Null): The content of the message.
-   `message_type` (TEXT): Type of message (`text`, `photo`, etc.).
-   `is_read` (BOOLEAN, Default: false): Whether the user has marked the message as read.
-   `timestamp` (TIMESTAMPTZ, Not Null): When the message was sent.
-   `created_at` (TIMESTAMPTZ): When the message was stored in our DB.

## Caching and Metrics Tables

### `cached_items`

Caches data from external platforms to improve performance and reduce API calls.

-   `id` (UUID, Primary Key): Unique identifier for the cached item.
-   `user_id` (UUID, Foreign Key): Links to `user_profiles.id`.
-   `platform` (TEXT, Not Null): The source platform (e.g., 'gmail').
-   `item_type` (TEXT, Not Null): Type of item (`email`, `calendar_event`, `document`).
-   `external_id` (TEXT, Not Null): The item's unique ID on the external platform.
-   `title` (TEXT): Title of the item.
-   `content` (TEXT): Content or body of the item.
-   `metadata` (JSONB): Additional metadata.
-   `created_at` (TIMESTAMPTZ): Timestamp of creation.
-   `updated_at` (TIMESTAMPTZ): Timestamp of the last update.

### `system_metrics`

Records system performance metrics for monitoring and analysis.

-   `id` (UUID, Primary Key): Unique identifier for the metric.
-   `metric_type` (TEXT, Not Null): The type of metric being recorded (e.g., 'api_response_time').
-   `metric_value` (REAL, Not Null): The value of the metric.
-   `metadata` (JSONB): Any additional metadata (e.g., `{"endpoint": "/api/v1/gmail"}`).
-   `recorded_at` (TIMESTAMPTZ): Timestamp of when the metric was recorded.
