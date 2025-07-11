# backend/check_webhook_status.py
import os
import requests
from dotenv import load_dotenv
from datetime import datetime

def check_webhook_status():
    """
    Checks the current webhook status with the Telegram Bot API.

    This script retrieves and displays the currently configured webhook URL,
    how many pending updates are waiting, and details about the last
    webhook error if one occurred.
    """
    # Load environment variables from .env file
    load_dotenv()

    # 1. Get the bot token from environment variables
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not bot_token:
        print("❌ Error: TELEGRAM_BOT_TOKEN not found in your .env file.")
        return

    # 2. Make the API call to Telegram's getWebhookInfo endpoint
    telegram_api_url = f"https://api.telegram.org/bot{bot_token}/getWebhookInfo"
    
    print("--- Checking Telegram Webhook Status ---")
    
    try:
        print("Querying Telegram for current webhook info...")
        response = requests.get(telegram_api_url)
        
        if response.status_code == 200:
            data = response.json()
            if data.get("ok"):
                result = data.get("result", {})
                
                print("\n✅ Success! Webhook details retrieved.")
                print("-" * 30)

                # Display the configured URL
                url = result.get("url")
                if url:
                    print(f"🔗 Registered Webhook URL: {url}")
                else:
                    print("⚠️ Webhook URL is NOT SET.")

                # Display other useful info
                print(f"📈 Pending Updates in Queue: {result.get('pending_update_count', 0)}")
                
                if result.get('has_custom_certificate'):
                    print("🔒 Custom Certificate: Yes")
                
                # Check for and display the last error message
                last_error_date = result.get("last_error_date")
                if last_error_date:
                    error_time = datetime.fromtimestamp(last_error_date).strftime('%Y-%m-%d %H:%M:%S')
                    print("\n--- Last Webhook Error ---")
                    print(f"🚨 Last Error Time: {error_time}")
                    print(f"💬 Last Error Message: '{result.get('last_error_message', 'N/A')}'")
                    print("-" * 30)
                    print("\nThis error indicates that Telegram tried to send an update to your URL but failed.")
                    print("Common reasons include your ngrok tunnel being down or your backend server not running.")
                else:
                    print("\n✅ No recent webhook errors reported by Telegram.")

            else:
                print("❌ Error: Telegram API returned an error.")
                print(f"Description: {data.get('description')}")
        else:
            print(f"❌ Error: Failed to connect to Telegram API. Status code: {response.status_code}")

    except requests.exceptions.RequestException as e:
        print(f"❌ Error: A network error occurred: {e}")

if __name__ == "__main__":
    check_webhook_status() 