import google.generativeai as genai
from google.oauth2 import service_account

def test_service_account():
    """
    Tests the service account key by authenticating with the JSON file.
    """
    try:
        # Define the path to your credentials file
        credentials_path = 'credentials/gemini_credentials.json'

        print(f"Attempting to load credentials from: {credentials_path}")

        # Create credentials from the service account file
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path,
            scopes=['https://www.googleapis.com/auth/generative-language.retriever'] # A common scope
        )

        print("Credentials loaded successfully. Configuring Google AI...")

        # Configure the SDK with the service account credentials
        genai.configure(credentials=credentials)

        # Create the model instance
        model = genai.GenerativeModel('gemini-1.5-flash')

        print("Model created. Sending prompt to the AI...")

        # Send a prompt and get the response
        response = model.generate_content("In one sentence, what is a service account?")

        print("\n-----------------------------------------")
        print(f"AI Response: {response.text}")
        print("-----------------------------------------\n")
        print("✅ Test successful! Your Service Account key is working.")

    except Exception as e:
        print("\n❌ An error occurred during the test.")
        print(f"Error details: {e}")
        print("\nPlease check that 'credentials.json' is in the correct folder and is valid.")

# Run the test function
if __name__ == "__main__":
    test_service_account()