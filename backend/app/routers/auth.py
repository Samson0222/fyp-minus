from fastapi import APIRouter, HTTPException, Depends, Request
from fastapi.responses import RedirectResponse
from typing import Optional
import os
import logging
from urllib.parse import urlencode
import uuid
from datetime import datetime, timedelta

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.database import get_database, SupabaseManager

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/v1/auth", tags=["authentication"])

# Calendar API scopes
CALENDAR_SCOPES = [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events"
]

# Dependency to get current user (simplified for now)
async def get_current_user(authorization: Optional[str] = None):
    """Stub user extraction - replace with real auth if needed."""
    return {"user_id": "test_user_001", "email": "test@example.com"}


def create_google_oauth_flow(redirect_uri: str) -> Flow:
    """Create Google OAuth flow for Calendar authentication."""
    credentials_path = os.getenv("GOOGLE_OAUTH_CREDENTIALS_PATH")
    if not credentials_path or not os.path.exists(credentials_path):
        raise HTTPException(
            status_code=500, 
            detail="Google OAuth credentials not configured. Set GOOGLE_OAUTH_CREDENTIALS_PATH in your .env file."
        )
    
    flow = Flow.from_client_secrets_file(
        credentials_path,
        scopes=CALENDAR_SCOPES,
        redirect_uri=redirect_uri
    )
    return flow


@router.get("/google/calendar/login")
async def initiate_google_calendar_auth(request: Request, user = Depends(get_current_user)):
    """Initiate Google Calendar OAuth flow."""
    try:
        # Construct the redirect URI (callback endpoint)
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/v1/auth/google/calendar/callback"
        
        # Create OAuth flow
        flow = create_google_oauth_flow(redirect_uri)
        
        # Generate authorization URL
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'  # Force consent to get refresh token
        )
        
        # Store state and user_id in session/cache for verification
        # For now, we'll include user_id in the state parameter
        state_with_user = f"{state}:{user['user_id']}"
        
        # Redirect user to Google OAuth consent screen
        return RedirectResponse(url=authorization_url)
        
    except Exception as e:
        logger.error(f"Google Calendar auth initiation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate authentication: {str(e)}")


@router.get("/google/calendar/callback")
async def google_calendar_auth_callback(
    request: Request, 
    code: str, 
    state: str,
    db: SupabaseManager = Depends(get_database)
):
    """Handle Google Calendar OAuth callback and subscribe to webhooks."""
    try:
        # Extract user_id from state
        if ':' in state:
            oauth_state, user_id = state.rsplit(':', 1)
        else:
            oauth_state = state
            user_id = "test_user_001"  # Fallback for safety

        # Exchange authorization code for credentials
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/v1/auth/google/calendar/callback"
        flow = create_google_oauth_flow(redirect_uri)
        flow.state = oauth_state
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Save credentials to file
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_calendar_{user_id}.json")
        os.makedirs(tokens_dir, exist_ok=True)
        with open(token_path, "w") as token_file:
            token_file.write(credentials.to_json())
        
        logger.info(f"Google Calendar authentication successful for user {user_id}. Now subscribing to webhooks.")

        # --- Subscribe to Push Notifications (Webhook) ---
        try:
            service = build('calendar', 'v3', credentials=credentials)
            channel_id = str(uuid.uuid4())
            webhook_url = f"{base_url}/api/v1/webhooks/google-calendar"

            watch_request_body = {
                "id": channel_id,
                "type": "web_hook",
                "address": webhook_url,
            }

            watch_response = service.events().watch(calendarId='primary', body=watch_request_body).execute()
            
            resource_id = watch_response['resourceId']
            # Expiration is in milliseconds since epoch, convert to datetime
            expires_ms = int(watch_response['expiration'])
            expires_at = datetime.utcfromtimestamp(expires_ms / 1000)

            # Store the channel info in our database
            await db.store_google_channel(user_id, channel_id, resource_id, expires_at)
            
            logger.info(f"Successfully subscribed user {user_id} to Google Calendar notifications. Channel: {channel_id}")

        except HttpError as error:
            logger.error(f"Failed to subscribe to Google Calendar webhooks for user {user_id}: {error}")
            # Don't fail the entire auth flow, just log the error. The user can still use manual sync.
        except Exception as e:
            logger.error(f"An unexpected error occurred during webhook subscription for user {user_id}: {e}")

        # Redirect to frontend with success message
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        success_url = f"{frontend_url}/calendar?auth=success"
        return RedirectResponse(url=success_url)
        
    except Exception as e:
        logger.error(f"Google Calendar auth callback error: {e}", exc_info=True)
        # Redirect to frontend with error message
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000")
        error_url = f"{frontend_url}/calendar?auth=error&message={str(e)}"
        return RedirectResponse(url=error_url)


@router.get("/google/calendar/status")
async def check_google_calendar_auth_status(user = Depends(get_current_user)):
    """Check if user has authenticated Google Calendar."""
    try:
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_calendar_{user['user_id']}.json")
        
        if not os.path.exists(token_path):
            return {
                "authenticated": False,
                "message": "Google Calendar not connected"
            }
        
        # Try to load and validate credentials
        try:
            creds = Credentials.from_authorized_user_file(token_path, CALENDAR_SCOPES)
            
            # Check if credentials are valid or can be refreshed
            if creds.valid:
                return {
                    "authenticated": True,
                    "message": "Google Calendar connected and valid"
                }
            elif creds.expired and creds.refresh_token:
                return {
                    "authenticated": True,
                    "message": "Google Calendar connected (needs refresh)"
                }
            else:
                return {
                    "authenticated": False,
                    "message": "Google Calendar authentication expired"
                }
                
        except Exception as cred_error:
            logger.warning(f"Invalid credentials file for user {user['user_id']}: {cred_error}")
            return {
                "authenticated": False,
                "message": "Invalid Google Calendar credentials"
            }
            
    except Exception as e:
        logger.error(f"Auth status check error: {e}")
        return {
            "authenticated": False,
            "message": f"Error checking authentication: {str(e)}"
        }


@router.post("/google/calendar/disconnect")
async def disconnect_google_calendar(user = Depends(get_current_user)):
    """Disconnect Google Calendar by removing stored credentials."""
    try:
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_calendar_{user['user_id']}.json")
        
        if os.path.exists(token_path):
            os.remove(token_path)
            # --- Unsubscribe from Push Notifications (Webhook) ---
            # In a real app, you would also stop the channel here
            # by calling service.channels().stop() with the channel_id and resource_id
            # stored in your database. For simplicity, we are skipping this for now.
            logger.info(f"Google Calendar disconnected for user {user['user_id']}")
            return {
                "success": True,
                "message": "Google Calendar disconnected successfully"
            }
        else:
            return {
                "success": True,
                "message": "Google Calendar was not connected"
            }
            
    except Exception as e:
        logger.error(f"Disconnect error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to disconnect: {str(e)}") 
 
 