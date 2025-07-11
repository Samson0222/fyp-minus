-- This function replaces the old 'get_telegram_unread_summary'
-- It provides a more comprehensive summary for the Telegram Focus Mode,
-- returning both 'unread' chats and 'recent' (read, within 24h) chats.

DROP FUNCTION IF EXISTS public.get_telegram_unread_summary(uuid);

CREATE OR REPLACE FUNCTION public.get_telegram_summary(p_user_id uuid)
RETURNS TABLE(
    chat_id bigint,
    chat_name text,
    chat_type text,
    unread_count bigint,
    latest_message text,
    latest_sender text,
    latest_timestamp timestamptz,
    status text -- Will be 'unread' or 'recent'
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH all_messages AS (
        -- Select all messages for the user's active chats
        SELECT
            mc.id as monitored_chat_id,
            mc.chat_id,
            mc.chat_name,
            mc.chat_type,
            tm.content,
            tm.sender_name,
            tm.timestamp,
            tm.is_read
        FROM
            telegram_messages tm
        JOIN
            monitored_chats mc ON tm.monitored_chat_id = mc.id
        WHERE
            mc.user_id = p_user_id AND mc.is_active = TRUE
    ),
    message_details AS (
        -- Add row numbers to find the latest message per chat
        SELECT *,
               ROW_NUMBER() OVER(PARTITION BY chat_id ORDER BY timestamp DESC) as rn
        FROM all_messages
    ),
    chat_summaries AS (
        -- Calculate unread counts and find the latest message timestamp for each chat
        SELECT
            chat_id,
            MAX(timestamp) as max_timestamp,
            COUNT(*) FILTER (WHERE is_read = FALSE) as unread
        FROM all_messages
        GROUP BY chat_id
    )
    -- Final selection: combine details and summaries
    SELECT
        md.chat_id,
        md.chat_name,
        md.chat_type,
        cs.unread as unread_count,
        md.content as latest_message,
        md.sender_name as latest_sender,
        md.timestamp as latest_timestamp,
        -- Determine the status: 'unread' if there are unread messages,
        -- otherwise 'recent' if the latest message is within 24 hours.
        CASE
            WHEN cs.unread > 0 THEN 'unread'
            WHEN cs.max_timestamp >= now() - interval '24 hours' THEN 'recent'
            ELSE NULL -- This will filter out old, read chats
        END as status
    FROM
        message_details md
    JOIN
        chat_summaries cs ON md.chat_id = cs.chat_id
    WHERE
        md.rn = 1 -- Only get the single latest message for the summary row
        AND (
            cs.unread > 0 OR -- It's an unread chat
            cs.max_timestamp >= now() - interval '24 hours' -- It's a recent chat
        )
    ORDER BY
        -- Unread chats first, then by latest timestamp descending
        CASE WHEN cs.unread > 0 THEN 0 ELSE 1 END,
        md.timestamp DESC;
END;
$$; 
 
 
 
 
 
 
 
 
 
 