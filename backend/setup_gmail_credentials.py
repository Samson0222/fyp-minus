"""
Helper script to set up Gmail OAuth credentials for Minus Voice Assistant
"""
import os
import shutil
import json
from pathlib import Path

def setup_gmail_credentials():
    """Set up Gmail OAuth credentials"""
    print("\n📧 MINUS VOICE ASSISTANT - GMAIL CREDENTIALS SETUP")
    print("=" * 50)
    
    # Create credentials directory if it doesn't exist
    credentials_dir = Path("credentials")
    credentials_dir.mkdir(exist_ok=True)
    
    # Define target path
    target_path = credentials_dir / "gmail_credentials.json"
    
    # Check if credentials already exist
    if target_path.exists():
        print(f"⚠️ Gmail credentials file already exists at {target_path}")
        overwrite = input("Do you want to overwrite it? (y/n): ").lower() == 'y'
        if not overwrite:
            print("❌ Setup cancelled.")
            return
    
    # Ask for source file path
    print("\nPlease provide the path to your Gmail OAuth credentials JSON file.")
    print("You can create this file in the Google Cloud Console:")
    print("1. Go to https://console.cloud.google.com/")
    print("2. Create a project or select an existing one")
    print("3. Enable the Gmail API")
    print("4. Create OAuth 2.0 Client ID credentials")
    print("5. Download the JSON file")
    
    source_path = input("\nPath to Gmail OAuth credentials JSON file: ")
    
    try:
        # Validate JSON file
        with open(source_path, 'r') as f:
            creds_data = json.load(f)
            
            # Check if it looks like an OAuth client file
            if 'installed' not in creds_data and 'web' not in creds_data:
                print("⚠️ Warning: This doesn't appear to be a valid OAuth client credentials file.")
                confirm = input("Continue anyway? (y/n): ").lower() == 'y'
                if not confirm:
                    print("❌ Setup cancelled.")
                    return
        
        # Copy the file
        shutil.copy2(source_path, target_path)
        print(f"✅ Gmail credentials copied to {target_path}")
        
        # Update .env file if needed
        env_path = Path(".env")
        if env_path.exists():
            with open(env_path, 'r') as f:
                env_content = f.read()
            
            if "GMAIL_CREDENTIALS_PATH" not in env_content:
                with open(env_path, 'a') as f:
                    f.write("\n# Gmail OAuth credentials path\n")
                    f.write("GMAIL_CREDENTIALS_PATH=credentials/gmail_credentials.json\n")
                print("✅ Updated .env file with Gmail credentials path")
        
        print("\n✅ Gmail credentials setup complete!")
        print("\nNext steps:")
        print("1. Start the backend server: python -m uvicorn app.main:app --reload --port 8000")
        print("2. Try a Gmail command like 'Read my unread emails'")
        print("3. The first time you run a Gmail command, you'll be prompted to authorize access")
        
    except FileNotFoundError:
        print(f"❌ Error: File not found at {source_path}")
    except json.JSONDecodeError:
        print(f"❌ Error: The file at {source_path} is not a valid JSON file")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    setup_gmail_credentials() 