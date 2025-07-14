import os
import json
import logging
from fastapi import Header, HTTPException, status
from typing import Optional

from .core.database import supabase_manager
from .models.user_context import UserContext

logger = logging.getLogger(__name__)

async def get_current_user(authorization: Optional[str] = Header(None)) -> UserContext:
    """
    Validates a Supabase JWT from the Authorization header and returns the user context.
    If the DEV_AUTH_BYPASS environment variable is set to "true", it will bypass
    JWT validation and return a hardcoded test user with their Google credentials.
    """
    # DEV MODE BYPASS: This check runs first.
    if os.getenv("DEV_AUTH_BYPASS") == "true":
        logger.warning(f"[WARNING] DEV_AUTH_BYPASS is enabled. All requests are authenticated as test user.")
        user_id = "cbede3b0-2f68-47df-9c26-09a46e588567"
        google_creds_str = None
        
        # Attempt to load Google credentials if they exist for the test user
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        token_path = os.path.join(tokens_dir, f"token_google_{user_id}.json")
        
        if os.path.exists(token_path):
            try:
                with open(token_path, 'r') as f:
                    # Load the credentials dict
                    creds_dict = json.load(f)
                    # Convert the dict to a JSON string for the model
                    google_creds_str = json.dumps(creds_dict)
                logger.info(f"Successfully loaded and serialized Google credentials for dev user {user_id}")
            except Exception as e:
                logger.error(f"Failed to load or process Google credentials for dev user {user_id}: {e}")
        else:
            logger.warning(f"Google token file not found for dev user {user_id} at {token_path}")

        return UserContext(user_id=user_id, google_credentials=google_creds_str, email="test@example.com")

    # PRODUCTION MODE: Real JWT validation
    if authorization is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        # Extract the token from "Bearer <token>"
        token = authorization.split(" ")[1]
        user_data = supabase_manager.get_client().auth.get_user(token).user
        
        if not user_data:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # In production, we don't fetch Google creds here. 
        # Services that need them will fetch them using the user_id.
        return UserContext(user_id=user_data.id, google_credentials=None)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Could not validate credentials: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        ) 
 
 
 
 
 
 
 
 
 
 