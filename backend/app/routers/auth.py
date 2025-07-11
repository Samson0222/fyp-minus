from fastapi import APIRouter, HTTPException, Depends, Request, Query
from fastapi.responses import RedirectResponse
from typing import Optional
import os
import logging
from urllib.parse import urlencode

from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials

from app.core.config import GOOGLE_SCOPES

logger = logging.getLogger(__name__)
router = APIRouter(
    prefix="/api/v1/auth/google",
    tags=["google_auth"],
    responses={404: {"description": "Not found"}},
)

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
        scopes=GOOGLE_SCOPES,
        redirect_uri=redirect_uri
    )
    return flow


@router.get("/login", summary="Initiate Google OAuth2 flow")
async def google_login(request: Request, user = Depends(get_current_user)):
    """
    Redirects the user to Google's OAuth 2.0 server to initiate authentication.
    """
    try:
        # Construct the redirect URI (callback endpoint)
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/v1/auth/google/callback"
        
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
        logger.error(f"Google auth initiation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to initiate authentication: {str(e)}")


@router.get("/callback", summary="Handle Google OAuth2 callback")
async def google_auth_callback(
    request: Request, 
    code: str, 
    state: str
):
    """
    Handles the callback from Google after user authentication.
    Exchanges the authorization code for an access token and refresh token.
    """
    try:
        # Extract user_id from state
        if ':' in state:
            oauth_state, user_id = state.rsplit(':', 1)
        else:
            oauth_state = state
            user_id = "test_user_001"  # Fallback for safety

        # Exchange authorization code for credentials
        base_url = str(request.base_url).rstrip('/')
        redirect_uri = f"{base_url}/api/v1/auth/google/callback"
        flow = create_google_oauth_flow(redirect_uri)
        flow.state = oauth_state
        flow.fetch_token(code=code)
        credentials = flow.credentials

        # Save credentials to file
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_google_{user_id}.json")
        os.makedirs(tokens_dir, exist_ok=True)
        with open(token_path, "w") as token_file:
            token_file.write(credentials.to_json())
        
        logger.info(f"Google authentication successful for user {user_id}.")

        # NOTE: Webhook subscription has been removed from the auth callback
        # to keep this endpoint generic. Service-specific setup should be
        # handled elsewhere, for example, on the first visit to the service page.

        # Redirect to frontend with success message
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        success_url = f"{frontend_url}/settings?auth=success"
        return RedirectResponse(url=success_url)
        
    except Exception as e:
        logger.error(f"Google auth callback error: {e}", exc_info=True)
        # Redirect to frontend with error message
        frontend_url = os.getenv("FRONTEND_URL", "http://localhost:8080")
        error_url = f"{frontend_url}/settings?auth=error&message={str(e)}"
        return RedirectResponse(url=error_url)


@router.get("/status", summary="Check Google authentication status")
async def get_google_auth_status(user_id: str = "test_user_001"):
    """
    Checks if a valid, non-expired token exists for the user.
    """
    try:
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_google_{user_id}.json")
        
        if not os.path.exists(token_path):
            return {
                "authenticated": False,
                "message": "No token found or token is invalid."
            }
        
        # Try to load and validate credentials
        try:
            creds = Credentials.from_authorized_user_file(token_path, GOOGLE_SCOPES)
            
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
            logger.warning(f"Invalid credentials file for user {user_id}: {cred_error}")
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


@router.post("/disconnect", summary="Disconnect Google account")
async def disconnect_google_account(user_id: str = "test_user_001"):
    """
    Deletes the user's Google token file, effectively disconnecting their account.
    """
    try:
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_google_{user_id}.json")
        
        if os.path.exists(token_path):
            os.remove(token_path)
            # --- Unsubscribe from Push Notifications (Webhook) ---
            # In a real app, you would also stop the channel here
            # by calling service.channels().stop() with the channel_id and resource_id
            # stored in your database. For simplicity, we are skipping this for now.
            logger.info(f"Google Calendar disconnected for user {user_id}")
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
 
 