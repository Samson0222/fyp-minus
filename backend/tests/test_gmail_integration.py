"""
Test script to verify Gmail integration with OAuth
"""
import sys
import os
import json
import asyncio
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.services.gmail_service import GmailService

async def test_gmail_authentication():
    """Test Gmail authentication with OAuth"""
    print("\n🔑 TESTING GMAIL AUTHENTICATION")
    print("=" * 50)
    
    # Initialize Gmail service
    gmail_service = GmailService()
    
    # Test user ID
    user_id = "test_user_001"
    
    # Try to authenticate
    print(f"Attempting to authenticate with user_id: {user_id}")
    print("If this is your first time, a browser window will open for OAuth authorization.")
    
    try:
        success = await gmail_service.authenticate(user_id)
        
        if success:
            print("✅ Authentication successful!")
            print(f"Token saved to: tokens/token_{user_id}.json")
            return True
        else:
            print("❌ Authentication failed.")
            return False
    except Exception as e:
        print(f"❌ Error during authentication: {e}")
        return False

async def test_get_emails(user_id):
    """Test getting emails from Gmail"""
    print("\n📧 TESTING EMAIL RETRIEVAL")
    print("=" * 50)
    
    # Initialize Gmail service
    gmail_service = GmailService()
    
    try:
        # Get 5 emails with minimal info
        print("Fetching 5 recent emails (minimal info)...")
        emails = await gmail_service.get_emails(user_id, max_results=5, minimal=True)
        
        print(f"✅ Retrieved {len(emails.emails)} emails")
        
        # Print email subjects
        for i, email in enumerate(emails.emails):
            print(f"{i+1}. From: {email.sender.email} - Subject: {email.subject}")
        
        return True
    except Exception as e:
        print(f"❌ Error retrieving emails: {e}")
        return False

async def test_search_emails(user_id):
    """Test searching emails in Gmail"""
    print("\n🔍 TESTING EMAIL SEARCH")
    print("=" * 50)
    
    # Initialize Gmail service
    gmail_service = GmailService()
    
    try:
        # Search query
        query = "is:unread"
        print(f"Searching for emails with query: '{query}'")
        
        # Search emails
        results = await gmail_service.search_emails(user_id, query, max_results=3)
        
        print(f"✅ Found {len(results.emails)} matching emails")
        
        # Print email subjects
        for i, email in enumerate(results.emails):
            print(f"{i+1}. From: {email.sender.email} - Subject: {email.subject}")
        
        return True
    except Exception as e:
        print(f"❌ Error searching emails: {e}")
        return False

async def main():
    """Run Gmail integration tests"""
    print("\n🚀 MINUS VOICE ASSISTANT - GMAIL INTEGRATION TESTING")
    print("=" * 50)
    
    # Test user ID
    user_id = "test_user_001"
    
    # Test authentication
    auth_success = await test_gmail_authentication()
    
    if auth_success:
        # Test getting emails
        await test_get_emails(user_id)
        
        # Test searching emails
        await test_search_emails(user_id)
    
    print("\n✅ Testing complete!")

if __name__ == "__main__":
    asyncio.run(main()) 