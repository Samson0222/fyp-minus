import logging
import asyncio
from fastapi import APIRouter, Depends, Header, HTTPException, Request
from typing import Dict, Any


from app.core.database import get_database, SupabaseManager
from app.websockets import ConnectionManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/webhooks", tags=["webhooks"])
manager = ConnectionManager()

# It's crucial to validate that the request is coming from Google.
# This would typically involve checking a secret token or signature.
# For now, we will rely on specific Google headers.
async def verify_google_notification(
    x_goog_channel_id: str = Header(...),
    x_goog_resource_id: str = Header(...),
    x_goog_resource_state: str = Header(...),
    # x_goog_channel_token: str = Header(None), # Optional: If you set a token during watch request
):
    """
    A dependency to verify that the webhook notification is from Google.
    Placeholder for more robust validation.
    """
    if not all([x_goog_channel_id, x_goog_resource_id, x_goog_resource_state]):
        raise HTTPException(status_code=400, detail="Missing Google webhook headers.")
    
    # In a production environment, you would also:
    # 1. Verify the x_goog_channel_token if you provided one.
    # 2. Check that the x_goog_channel_id is one you have stored and are expecting notifications for.
    
    logger.info(f"Received Google webhook notification for channel {x_goog_channel_id} with state {x_goog_resource_state}")
    return {
        "channel_id": x_goog_channel_id,
        "resource_id": x_goog_resource_id,
        "state": x_goog_resource_state,
    }


@router.post("/google-calendar")
async def receive_google_calendar_notification(
    request: Request,
    google_headers: dict = Depends(verify_google_notification),
    db: SupabaseManager = Depends(get_database)
):
    """
    Endpoint to receive push notifications from Google Calendar.
    
    When a change occurs, Google sends a notification with a 'sync' state.
    We then trigger our full sync logic for the relevant user.
    """
    channel_id = google_headers["channel_id"]
    state = google_headers["state"]
    
    logger.info(f"Received notification for channel {channel_id} with state '{state}'")

    if state == "sync":
        # Find the user associated with this channel
        user_id = await db.get_user_from_channel_id(channel_id)
        
        if not user_id:
            # If we get a notification for a channel we don't recognize,
            # it's a potential issue. We should log it and maybe stop the channel.
            logger.error(f"Received sync notification for unknown channel_id: {channel_id}. Cannot process.")
            raise HTTPException(status_code=404, detail="Notification channel not found.")
        
        logger.info(f"Found user {user_id} for channel {channel_id}. Triggering background sync.")
        
        # Since we no longer maintain local tasks, we just notify the frontend
        # that the calendar has been updated and they should refresh
        async def notify_calendar_update():
            await manager.broadcast_to_user(
                user_id,
                {"event": "calendar_updated", "message": "Your Google Calendar has been updated."}
            )

        asyncio.create_task(notify_calendar_update())

        return {"status": "received", "detail": "Calendar update notification sent."}

    elif state == "exists":
        # This is the confirmation notification after subscribing.
        logger.info(f"Successfully validated webhook for channel {channel_id}.")
        return {"status": "received", "detail": "Webhook validation successful."}
        
    else:
        logger.warning(f"Received unhandled notification state '{state}' for channel {channel_id}.")
        return {"status": "received", "detail": f"Notification state '{state}' acknowledged but not processed."} 