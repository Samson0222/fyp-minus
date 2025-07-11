"""
Centralized configuration for the application.
"""

# Unified Google API scopes used for authentication.
# Placing them here avoids circular dependencies.
GOOGLE_SCOPES = [
    # Calendar Scopes
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    
    # Gmail Scopes
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",

    # Docs & Drive Scopes
    "https://www.googleapis.com/auth/documents",
    "https://www.googleapis.com/auth/drive",          # Full Drive scope for write operations
    "https://www.googleapis.com/auth/drive.readonly"  # Included to prevent scope mismatch during OAuth
] 