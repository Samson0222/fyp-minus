"""
Helper script to set up service account credentials for Minus Voice Assistant
"""
import os
import shutil
import json
from pathlib import Path

def setup_credentials():
    """Set up service account credentials"""
    print("\n🔑 MINUS VOICE ASSISTANT - CREDENTIALS SETUP")
    print("=" * 50)
    
    # Create credentials directory if it doesn't exist
    credentials_dir = Path("credentials")
    credentials_dir.mkdir(exist_ok=True)
    
    # Define target path
    target_path = credentials_dir / "gemini_credentials.json"
    
    # Check if credentials already exist
    if target_path.exists():
        print(f"⚠️ Credentials file already exists at {target_path}")
        overwrite = input("Do you want to overwrite it? (y/n): ").lower() == 'y'
        if not overwrite:
            print("❌ Setup cancelled.")
            return
    
    # Ask for source file path
    print("\nPlease provide the path to your Google AI service account JSON file.")
    source_path = input("Path to service account JSON file: ")
    
    try:
        # Validate JSON file
        with open(source_path, 'r') as f:
            creds_data = json.load(f)
            
            # Check if it looks like a service account file
            required_fields = ['type', 'project_id', 'private_key_id', 'private_key', 'client_email']
            missing_fields = [field for field in required_fields if field not in creds_data]
            
            if missing_fields:
                print(f"⚠️ Warning: The file is missing these required fields: {', '.join(missing_fields)}")
                confirm = input("Continue anyway? (y/n): ").lower() == 'y'
                if not confirm:
                    print("❌ Setup cancelled.")
                    return
        
        # Copy the file
        shutil.copy2(source_path, target_path)
        print(f"✅ Credentials copied to {target_path}")
        
        # Update .env file if needed
        env_path = Path(".env")
        if env_path.exists():
            with open(env_path, 'r') as f:
                env_content = f.read()
            
            if "GEMINI_CREDENTIALS_PATH" not in env_content:
                with open(env_path, 'a') as f:
                    f.write("\n# Gemini service account credentials path\n")
                    f.write("GEMINI_CREDENTIALS_PATH=credentials/gemini_credentials.json\n")
                print("✅ Updated .env file with credentials path")
        
        print("\n✅ Credentials setup complete!")
        print("You can now run: python tests/test_service_account.py")
        
    except FileNotFoundError:
        print(f"❌ Error: File not found at {source_path}")
    except json.JSONDecodeError:
        print(f"❌ Error: The file at {source_path} is not a valid JSON file")
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    setup_credentials() 