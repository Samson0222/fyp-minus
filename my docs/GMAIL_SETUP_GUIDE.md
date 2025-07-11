# Gmail Integration Setup Guide

This guide will help you set up Gmail integration for your voice-controlled AI assistant.

## Prerequisites

1. Google Cloud Platform account
2. Python environment with the new dependencies installed
3. Gmail account for testing

## Step 1: Install Dependencies

Install the new Gmail API dependencies:

```bash
cd backend
pip install -r requirements.txt
```

## Step 2: Google Cloud Platform Setup

1. **Create a Google Cloud Project**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select existing one
   - Note the project ID

2. **Enable Gmail API**
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

3. **Configure OAuth Consent Screen**
   - Go to "APIs & Services" > "OAuth consent screen"
   - Choose "External" for testing (or "Internal" if using G Suite)
   - Fill in the required fields:
     - App name: "Minus Voice Assistant"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.modify`
   - Add test users (your Gmail account)

4. **Create OAuth 2.0 Credentials**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client IDs"
   - Choose "Desktop application"
   - Name it "Minus Voice Assistant"
   - Download the JSON file
   - Rename it to `credentials.json`
   - Place it in your backend directory

## Step 3: Backend Configuration

1. **Update Environment Variables**
   ```bash
   cp env.example .env
   ```

2. **Edit .env file**
   ```env
   # Gmail API Configuration
   GMAIL_CREDENTIALS_PATH=credentials.json
   
   # Other existing configuration...
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Create tokens directory**
   ```bash
   mkdir tokens
   ```

## Step 4: First Time Authentication

1. **Start the backend server**
   ```bash
   cd backend
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Test authentication**
   - Navigate to: `http://localhost:8000/api/v1/gmail/auth-status`
   - This will trigger the OAuth flow on first run
   - A browser window will open asking you to sign in to Google
   - Grant permissions to access Gmail
   - The token will be saved automatically

## Step 5: Frontend Setup

The frontend is already configured! The Inboxes page will:
- Check authentication status
- Display emails in a list view
- Show email content when selected
- Support voice commands for email operations

## Step 6: Testing Voice Commands

Start the frontend and navigate to the Inboxes page (`/inboxes`). Try these voice commands:

### Reading Emails
- "Read my emails"
- "Show my latest emails"
- "Check my inbox"
- "Any new emails?"
- "Read my unread emails"

### Sending Emails
- "Send email to john@example.com about meeting"
- "Email sarah@company.com regarding project update"
- "Compose an email to team@company.com"

### Searching Emails
- "Search emails from john"
- "Find emails about project"
- "Look for emails containing budget"

## API Endpoints

The Gmail integration provides these endpoints:

- `GET /api/v1/gmail/emails` - Get email list
- `POST /api/v1/gmail/send` - Send email
- `POST /api/v1/gmail/voice-command` - Process voice commands
- `POST /api/v1/gmail/search` - Search emails
- `GET /api/v1/gmail/auth-status` - Check authentication
- `POST /api/v1/gmail/mark-read/{message_id}` - Mark email as read

## Usage Examples

### Get Latest Emails
```bash
curl "http://localhost:8000/api/v1/gmail/emails?count=10"
```

### Send Email
```bash
curl -X POST "http://localhost:8000/api/v1/gmail/send" \
  -H "Content-Type: application/json" \
  -d '{
    "to": ["recipient@example.com"],
    "subject": "Test Email",
    "body_plain": "This is a test email sent via the API"
  }'
```

### Voice Command
```bash
curl -X POST "http://localhost:8000/api/v1/gmail/voice-command" \
  -H "Content-Type: application/json" \
  -d '{"command": "read my latest emails"}'
```

## Troubleshooting

### Authentication Issues
1. **Invalid credentials**: Make sure `credentials.json` is in the correct location
2. **Token expired**: Delete the token file in `tokens/` directory and re-authenticate
3. **Scope issues**: Make sure all required scopes are enabled in Google Cloud Console

### Permission Errors
1. Make sure your Gmail account is added as a test user in OAuth consent screen
2. Check that Gmail API is enabled in your Google Cloud project
3. Verify the OAuth consent screen is properly configured

### API Errors
1. **403 Forbidden**: Check API quotas and billing in Google Cloud Console
2. **401 Unauthorized**: Re-authenticate by deleting token and trying again
3. **Rate limiting**: Gmail API has rate limits; implement proper retry logic for production

## Security Notes

1. **Never commit credentials.json** - Add it to `.gitignore`
2. **Token storage** - Tokens are stored locally in `tokens/` directory
3. **Production setup** - For production, consider using service accounts or more secure token storage
4. **Scopes** - Only request the minimum required scopes

## Production Considerations

1. **Token Management**: Implement proper token refresh and storage
2. **Error Handling**: Add comprehensive error handling and retry logic
3. **Rate Limiting**: Implement rate limiting to stay within Gmail API quotas
4. **Security**: Use secure token storage and encryption
5. **Logging**: Add proper logging for debugging and monitoring

## Next Steps

1. Test the basic functionality with your Gmail account
2. Customize voice command patterns for your specific needs
3. Add more advanced email features (labels, filters, etc.)
4. Implement email composition UI for complex emails
5. Add support for attachments and rich formatting

For more information, see the [Gmail API documentation](https://developers.google.com/gmail/api).