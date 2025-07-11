# backend/register_telegram_webhook.py
import os
import requests
from dotenv import load_dotenv

def register_webhook():
    """
    Registers the application's webhook with the Telegram Bot API.

    This script reads the bot token from the .env file and prompts the user
    for the public URL (e.g., from ngrok) where the backend is exposed.
    It then makes the API call to Telegram to set the webhook.
    """
    # Load environment variables from .env file
    load_dotenv()

    # 1. Get the bot token from environment variables
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        print("❌ Error: TELEGRAM_BOT_TOKEN not found in your .env file.")
        print("Please make sure you have added your bot token to the backend/.env file.")
        return

    # 2. Get the public URL from the user
    print("--- Telegram Webhook Registration ---")
    public_url = input("Enter your public URL (e.g., https://your-id.ngrok-free.app): ").strip()
    
    if not public_url.startswith("https://"):
        print("❌ Error: Invalid URL. It must start with https://")
        return

    # 3. Construct the full webhook URL
    # This must match the endpoint defined in `backend/app/routers/telegram.py`
    webhook_path = "/api/v1/telegram/webhook"
    full_webhook_url = public_url + webhook_path
    
    print(f"✅ Your full webhook URL is: {full_webhook_url}")

    # 4. Make the API call to Telegram
    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/setWebhook"
    
    try:
        print("\nRegistering webhook with Telegram...")
        response = requests.post(telegram_api_url, json={"url": full_webhook_url})
        
        # Check the response from Telegram
        if response.status_code == 200:
            response_data = response.json()
            if response_data.get("ok"):
                print("✅🎉 Success! Webhook was set successfully.")
                print(f"Description: {response_data.get('description')}")
            else:
                print("❌ Error: Telegram API returned an error.")
                print(f"Error Code: {response_data.get('error_code')}")
                print(f"Description: {response_data.get('description')}")
        else:
            print(f"❌ Error: Failed to connect to Telegram API. Status code: {response.status_code}")
            print(f"Response: {response.text}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Error: A network error occurred: {e}")

if __name__ == "__main__":
    register_webhook() 