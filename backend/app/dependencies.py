from fastapi import Header, HTTPException

async def get_user_id(x_user_id: str = Header("cbede3b0-2f68-47df-9c26-09a46e588567")) -> str:
    """
    A temporary dependency to get the user ID.
    In a real application, this would come from a proper authentication token.
    We are using a header with a default value for now.
    """
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-Id header missing")
    return x_user_id 
 
 
 
 
 
 
 
 
 
 