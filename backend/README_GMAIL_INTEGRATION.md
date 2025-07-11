# Setting Up Gmail Integration for Minus Voice Assistant

This guide explains how to set up Gmail integration to enable real email access in the Minus Voice Assistant.

## 🔑 Prerequisites

Before you begin, you'll need:

1. A Google Cloud project with the Gmail API enabled
2. OAuth 2.0 Client ID credentials
3. The Minus Voice Assistant backend running

## 📋 Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API" and enable it

## 📋 Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" > "OAuth client ID"
3. Select "Desktop application" as the application type
4. Enter a name for your OAuth client (e.g., "Minus Voice Assistant")
5. Click "CREATE"
6. Download the JSON file

## 📋 Step 3: Set Up Gmail Credentials in Minus

1. Run the Gmail credentials setup script:
   ```
   python setup_gmail_credentials.py
   ```
2. When prompted, provide the path to your downloaded OAuth credentials JSON file
3. The script will copy the file to the right location and update your `.env` file

## 📋 Step 4: Authorize Gmail Access

1. Start the backend server:
   ```
   python -m uvicorn app.main:app --reload --port 8000
   ```
2. Run a Gmail command:
   ```
   curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "Read my unread emails"}'
   ```
3. A browser window will open asking you to authorize access to your Gmail account
4. Follow the prompts to grant access
5. The authorization token will be saved for future use

## 📋 Step 5: Test Gmail Integration

After authorization, you can test Gmail integration with:

```bash
# Test reading unread emails
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Read my unread emails"}'

# Test composing an email
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Compose an email to example@example.com about testing"}'

# Test searching emails
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Search for emails about project"}'
```

## 🔒 Security Considerations

- The OAuth tokens are stored in the `tokens` directory. Keep these secure.
- In a production environment, you should use a more secure token storage mechanism.
- The application requests only the minimum permissions needed:
  - `gmail.readonly` - Read emails
  - `gmail.send` - Send emails
  - `gmail.modify` - Modify labels (mark as read/unread)

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/) 

This guide explains how to set up Gmail integration to enable real email access in the Minus Voice Assistant.

## 🔑 Prerequisites

Before you begin, you'll need:

1. A Google Cloud project with the Gmail API enabled
2. OAuth 2.0 Client ID credentials
3. The Minus Voice Assistant backend running

## 📋 Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Gmail API" and enable it

## 📋 Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "CREATE CREDENTIALS" > "OAuth client ID"
3. Select "Desktop application" as the application type
4. Enter a name for your OAuth client (e.g., "Minus Voice Assistant")
5. Click "CREATE"
6. Download the JSON file

## 📋 Step 3: Set Up Gmail Credentials in Minus

1. Run the Gmail credentials setup script:
   ```
   python setup_gmail_credentials.py
   ```
2. When prompted, provide the path to your downloaded OAuth credentials JSON file
3. The script will copy the file to the right location and update your `.env` file

## 📋 Step 4: Authorize Gmail Access

1. Start the backend server:
   ```
   python -m uvicorn app.main:app --reload --port 8000
   ```
2. Run a Gmail command:
   ```
   curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
     -H "Content-Type: application/json" \
     -d '{"text": "Read my unread emails"}'
   ```
3. A browser window will open asking you to authorize access to your Gmail account
4. Follow the prompts to grant access
5. The authorization token will be saved for future use

## 📋 Step 5: Test Gmail Integration

After authorization, you can test Gmail integration with:

```bash
# Test reading unread emails
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Read my unread emails"}'

# Test composing an email
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Compose an email to example@example.com about testing"}'

# Test searching emails
curl -X POST "http://localhost:8000/api/v1/voice/text-command" \
  -H "Content-Type: application/json" \
  -d '{"text": "Search for emails about project"}'
```

## 🔒 Security Considerations

- The OAuth tokens are stored in the `tokens` directory. Keep these secure.
- In a production environment, you should use a more secure token storage mechanism.
- The application requests only the minimum permissions needed:
  - `gmail.readonly` - Read emails
  - `gmail.send` - Send emails
  - `gmail.modify` - Modify labels (mark as read/unread)

## 📚 Additional Resources

- [Gmail API Documentation](https://developers.google.com/gmail/api)
- [OAuth 2.0 for Google APIs](https://developers.google.com/identity/protocols/oauth2)
- [Google Cloud Console](https://console.cloud.google.com/) 
 
 