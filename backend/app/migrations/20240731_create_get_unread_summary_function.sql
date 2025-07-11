-- This function retrieves a summary of unread messages for a specific user.
-- It is designed to be called via RPC from the backend.
DROP FUNCTION IF EXISTS public.get_telegram_summary(uuid);
CREATE OR REPLACE FUNCTION public.get_telegram_summary(p_user_id uuid)
RETURNS TABLE(
    chat_id bigint,
    chat_name text,
    chat_type text,
    unread_count bigint,
    latest_message text,
    latest_sender text,
    latest_timestamp timestamptz
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH message_details AS (
        -- Get all messages for the user's active chats and number them by recency
        SELECT
            mc.id as monitored_chat_id,
            mc.chat_id,
            mc.chat_name,
            mc.chat_type,
            tm.content,
            tm.sender_name,
            tm.timestamp,
            tm.is_read,
            ROW_NUMBER() OVER(PARTITION BY mc.chat_id ORDER BY tm.timestamp DESC) as rn
        FROM
            telegram_messages tm
        JOIN
            monitored_chats mc ON tm.monitored_chat_id = mc.id
        WHERE
            mc.user_id = p_user_id AND mc.is_active = TRUE
    ),
    unread_counts AS (
        -- Calculate the count of unread messages for each chat
        SELECT
            md.chat_id,
            COUNT(*) as count
        FROM
            message_details md
        WHERE
            md.is_read = FALSE
        GROUP BY
            md.chat_id
    )
    -- Final selection: join the details with the counts
    SELECT
        md.chat_id,
        md.chat_name,
        md.chat_type,
        COALESCE(uc.count, 0) as unread_count,
        md.content as latest_message,
        md.sender_name as latest_sender,
        md.timestamp as latest_timestamp
    FROM
        message_details md
    LEFT JOIN
        unread_counts uc ON md.chat_id = uc.chat_id
    WHERE
        md.rn = 1 -- Only select the most recent message for the summary row
    ORDER BY
        md.timestamp DESC;
END;
$$; 
 
 
 