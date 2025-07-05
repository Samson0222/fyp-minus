"""
Helper script to set up Gmail OAuth credentials for Minus Voice Assistant
"""
import os
import shutil
import json
from pathlib import Path

def setup_google_oauth():
    """
    Helper script to configure Google OAuth credentials for Gmail, Calendar, etc.
    1. Prompts user for the path to their downloaded client_secret.json.
    2. Copies the file to 'credentials/google_oauth_credentials.json'.
    3. Updates or creates the .env file with the correct path variable.
    """
    print("--- Google OAuth Setup ---")
    
    # Get path to client_secret.json from user
    client_secret_path = input("Enter the full path to your downloaded client_secret.json file: ").strip()
    
    # Validate the input file
    if not os.path.exists(client_secret_path) or not client_secret_path.endswith('.json'):
        print("\nError: Invalid path. Please provide the correct path to the client_secret.json file.")
        return
    
    # Define destination path
    dest_dir = "credentials"
    dest_path = os.path.join(dest_dir, "google_oauth_credentials.json")
    
    # Create credentials directory if it doesn't exist
    os.makedirs(dest_dir, exist_ok=True)
    
    # Copy the file
    try:
        with open(client_secret_path, 'r') as src, open(dest_path, 'w') as dst:
            shutil.copyfileobj(src, dst)
        print(f"\nSuccessfully copied credentials to '{dest_path}'")
    except Exception as e:
        print(f"\nError copying file: {e}")
        return
        
    # Update .env file
    env_path = ".env"
    env_vars = {}
    
    if os.path.exists(env_path):
        with open(env_path, 'r') as f:
            for line in f:
                if '=' in line:
                    key, value = line.strip().split('=', 1)
                    env_vars[key] = value

    # Set the unified OAuth path and token directory
    env_vars["GOOGLE_OAUTH_CREDENTIALS_PATH"] = dest_path
    env_vars["GOOGLE_TOKENS_DIR"] = "tokens"
    
    # Remove old, deprecated variables if they exist
    deprecated_keys = ["GMAIL_CREDENTIALS_PATH", "CALENDAR_CREDENTIALS_PATH"]
    for key in deprecated_keys:
        if key in env_vars:
            del env_vars[key]

    try:
        with open(env_path, 'w') as f:
            for key, value in env_vars.items():
                f.write(f"{key}={value}\n")
        print(f"Successfully updated '{env_path}' with unified Google OAuth settings.")
    except Exception as e:
        print(f"\nError updating .env file: {e}")

if __name__ == "__main__":
    setup_google_oauth() 
    # Check if credentials already exist
    if target_path.exists():
        print(f"⚠️ Gmail credentials file already exists at {target_path}")
        overwrite = input("Do you want to overwrite it? (y/n): ").lower() == 'y'
        if not overwrite:
            print("❌ Setup cancelled.")
            # return
    
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
                    # return
        
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