# Setting Up Google AI Service Account for Minus Voice Assistant

This guide explains how to set up a Google AI service account to enable real AI responses in the Minus Voice Assistant.

## 🔑 What is a Service Account?

A service account is a special type of Google account intended for server-to-server interactions. Unlike API keys, service accounts:
- Provide stronger security through private key authentication
- Support fine-grained access control
- Allow for better monitoring and auditing

## 📋 Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the "Generative Language API" for your project

## 📋 Step 2: Create a Service Account

1. In your Google Cloud project, go to "IAM & Admin" > "Service Accounts"
2. Click "CREATE SERVICE ACCOUNT"
3. Enter a name and description for your service account
4. Click "CREATE AND CONTINUE"
5. Grant the "Generative Language API User" role to the service account
6. Click "CONTINUE" and then "DONE"

## 📋 Step 3: Create a Service Account Key

1. Click on your newly created service account
2. Go to the "KEYS" tab
3. Click "ADD KEY" > "Create new key"
4. Select "JSON" as the key type
5. Click "CREATE"
6. The key file will be downloaded to your computer

## 📋 Step 4: Set Up the Service Account in Minus

1. Copy the downloaded JSON key file to the `credentials` directory
2. Rename it to `gemini_credentials.json`
3. Update your `.env` file with:
   ```
   GEMINI_CREDENTIALS_PATH=credentials/gemini_credentials.json
   LLM_MODEL=gemma
   ```

## 📋 Step 5: Verify the Setup

Run the test script to verify your service account is working:

```bash
python tests/test_service_account.py
```

You should see "✅ Service account authentication successful!" if everything is set up correctly.

## 🔄 Alternative: Use the Setup Helper

We've created a helper script to guide you through the setup process:

```bash
python setup_credentials.py
```

This script will:
1. Ask for the path to your downloaded service account JSON file
2. Copy it to the right location
3. Update your `.env` file if needed

## 🚀 What's Next?

Once the service account is set up:

1. The Minus Voice Assistant will use real Google AI for processing commands
2. You can test voice commands at `http://localhost:3000/playground`
3. Try commands like "Read my unread emails" or "What's my schedule today?"

## 📚 Additional Resources

- [Google AI Platform Documentation](https://ai.google.dev/)
- [Service Account Authentication Guide](https://cloud.google.com/docs/authentication/getting-started)
- [Generative Language API Overview](https://cloud.google.com/vertex-ai/docs/generative-ai/learn/overview) 