import os
import base64
import json
import re
from typing import List, Optional, Dict, Any
from datetime import datetime
import email
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.models.email import (
    EmailMessage, EmailSender, EmailRecipient, EmailAttachment,
    EmailListResponse, SendEmailRequest, SendEmailResponse
)
from app.core.llm_service import GemmaLLMService

# Gmail API scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.modify'
]

class GmailService:
    """Gmail API service for handling email operations"""
    
    def __init__(self):
        self.service = None
        self.credentials = None
        
    async def authenticate(self, user_id: str) -> bool:
        """Authenticate with Gmail API using OAuth2"""
        try:
            creds = None
            token_path = f"tokens/token_{user_id}.json"
            
            # Load existing credentials
            if os.path.exists(token_path):
                creds = Credentials.from_authorized_user_file(token_path, SCOPES)
            
            # If there are no (valid) credentials available, let the user log in
            if not creds or not creds.valid:
                if creds and creds.expired and creds.refresh_token:
                    creds.refresh(Request())
                else:
                    # For production, you'd handle this differently
                    # This is a simplified version for demonstration
                    credentials_path = os.getenv("GMAIL_CREDENTIALS_PATH", "credentials/gmail_credentials.json")
                    if not os.path.exists(credentials_path):
                        raise Exception(f"Gmail credentials file not found at {credentials_path}. Please run setup_gmail_credentials.py.")
                    
                    flow = InstalledAppFlow.from_client_secrets_file(credentials_path, SCOPES)
                    creds = flow.run_local_server(port=0)
                
                # Save the credentials for the next run
                os.makedirs("tokens", exist_ok=True)
                with open(token_path, 'w') as token:
                    token.write(creds.to_json())
            
            self.credentials = creds
            self.service = build('gmail', 'v1', credentials=creds)
            return True
            
        except Exception as e:
            print(f"Gmail authentication error: {e}")
            return False
    
    def _parse_email_address(self, address_string: str) -> EmailSender:
        """Parse email address string into EmailSender object"""
        # Handle formats like "John Doe <john@example.com>" or "john@example.com"
        pattern = r'^(?:"?([^"]*)"?\s*<([^>]+)>|([^<>\s]+))$'
        match = re.match(pattern, address_string.strip())
        
        if match:
            if match.group(3):  # Just email address
                return EmailSender(email=match.group(3))
            else:  # Name and email
                name = match.group(1).strip() if match.group(1) else None
                email = match.group(2).strip()
                return EmailSender(name=name, email=email)
        else:
            # Fallback - assume it's just an email
            return EmailSender(email=address_string)
    
    def _parse_recipients(self, recipients_string: str) -> List[EmailRecipient]:
        """Parse recipients string into list of EmailRecipient objects"""
        if not recipients_string:
            return []
        
        recipients = []
        # Split by comma, but be careful with commas inside quoted names
        addresses = re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', recipients_string)
        
        for address in addresses:
            sender = self._parse_email_address(address.strip())
            recipients.append(EmailRecipient(name=sender.name, email=sender.email))
        
        return recipients
    
    def _decode_base64_safe(self, data: str) -> str:
        """Safely decode base64 data with proper padding"""
        # Add padding if needed
        missing_padding = len(data) % 4
        if missing_padding:
            data += '=' * (4 - missing_padding)
        
        try:
            return base64.urlsafe_b64decode(data).decode('utf-8')
        except Exception:
            # If UTF-8 fails, try latin-1
            try:
                return base64.urlsafe_b64decode(data).decode('latin-1')
            except Exception:
                return ""
    
    def _extract_email_body(self, payload: Dict[str, Any]) -> tuple[Optional[str], Optional[str]]:
        """Extract plain text and HTML body from email payload"""
        plain_text = None
        html_text = None
        
        def extract_from_part(part):
            nonlocal plain_text, html_text
            
            if 'parts' in part:
                for subpart in part['parts']:
                    extract_from_part(subpart)
            else:
                mime_type = part.get('mimeType', '')
                if mime_type == 'text/plain':
                    body_data = part.get('body', {}).get('data', '')
                    if body_data:
                        plain_text = self._decode_base64_safe(body_data)
                elif mime_type == 'text/html':
                    body_data = part.get('body', {}).get('data', '')
                    if body_data:
                        html_text = self._decode_base64_safe(body_data)
        
        extract_from_part(payload)
        return plain_text, html_text
    
    def _parse_gmail_message(self, message: Dict[str, Any]) -> EmailMessage:
        """Parse Gmail API message into EmailMessage object"""
        headers = {h['name']: h['value'] for h in message['payload']['headers']}
        
        # Parse sender
        sender_str = headers.get('From', '')
        sender = self._parse_email_address(sender_str)
        
        # Parse recipients
        to_recipients = self._parse_recipients(headers.get('To', ''))
        cc_recipients = self._parse_recipients(headers.get('Cc', ''))
        bcc_recipients = self._parse_recipients(headers.get('Bcc', ''))
        
        # Parse date
        date_str = headers.get('Date', '')
        try:
            date = datetime.strptime(date_str, '%a, %d %b %Y %H:%M:%S %z')
        except:
            date = datetime.now()
        
        # Extract body
        plain_body, html_body = self._extract_email_body(message['payload'])
        
        # Get labels and read status
        labels = message.get('labelIds', [])
        is_read = 'UNREAD' not in labels
        is_important = 'IMPORTANT' in labels
        is_starred = 'STARRED' in labels
        
        return EmailMessage(
            id=message['id'],
            thread_id=message['threadId'],
            subject=headers.get('Subject', '(No Subject)'),
            sender=sender,
            recipients=to_recipients,
            cc=cc_recipients,
            bcc=bcc_recipients,
            body_plain=plain_body,
            body_html=html_body,
            date=date,
            is_read=is_read,
            is_important=is_important,
            is_starred=is_starred,
            labels=labels,
            snippet=message.get('snippet', ''),
            attachments=[]  # TODO: Parse attachments if needed
        )
    
    async def get_emails(self, user_id: str, max_results: int = 10, query: str = '', minimal: bool = False) -> EmailListResponse:
        """Get list of emails. If minimal=True only return headers/snippet for speed."""
        if not await self.authenticate(user_id):
            raise Exception('Failed to authenticate with Gmail')

        try:
            # first list call
            list_resp = self.service.users().messages().list(
                userId='me', q=query, maxResults=max_results
            ).execute()
            messages = list_resp.get('messages', [])
            emails: List[EmailMessage] = []

            if minimal:
                # only populate minimal info using metadata format
                for m in messages:
                    meta = self.service.users().messages().get(
                        userId='me', id=m['id'], format='metadata', metadataHeaders=['Subject', 'From', 'Date']
                    ).execute()
                    headers = {h['name']: h['value'] for h in meta['payload'].get('headers', [])}
                    email_obj = EmailMessage(
                        id=meta['id'],
                        thread_id=meta['threadId'],
                        subject=headers.get('Subject', '(No Subject)'),
                        sender=self._parse_email_address(headers.get('From', '')),
                        recipients=[],
                        date=datetime.utcnow(),
                        is_read='UNREAD' not in meta.get('labelIds', []),
                        is_important='IMPORTANT' in meta.get('labelIds', []),
                        is_starred='STARRED' in meta.get('labelIds', []),
                        labels=meta.get('labelIds', []),
                        snippet=meta.get('snippet', '')
                    )
                    emails.append(email_obj)
                return EmailListResponse(emails=emails, total_count=len(emails))

            # full mode (existing logic)
            for m in messages:
                full = self.service.users().messages().get(userId='me', id=m['id'], format='full').execute()
                emails.append(self._parse_gmail_message(full))

            return EmailListResponse(emails=emails, total_count=len(emails))
        except HttpError as e:
            raise Exception(f'Gmail API error: {e}')

    async def get_message(self, user_id: str, message_id: str) -> EmailMessage:
        """Fetch full content for a single message."""
        if not await self.authenticate(user_id):
            raise Exception('Failed to authenticate with Gmail')
        try:
            full = self.service.users().messages().get(userId='me', id=message_id, format='full').execute()
            return self._parse_gmail_message(full)
        except HttpError as e:
            raise Exception(f'Failed to fetch message: {e}')
    
    async def send_email(self, user_id: str, email_request: SendEmailRequest) -> SendEmailResponse:
        """Send email via Gmail"""
        if not await self.authenticate(user_id):
            raise Exception("Failed to authenticate with Gmail")
        
        try:
            # Create message
            message = MIMEMultipart()
            message['to'] = ', '.join(email_request.to)
            if email_request.cc:
                message['cc'] = ', '.join(email_request.cc)
            if email_request.bcc:
                message['bcc'] = ', '.join(email_request.bcc)
            message['subject'] = email_request.subject
            
            # Add body
            if email_request.body_plain:
                message.attach(MIMEText(email_request.body_plain, 'plain'))
            if email_request.body_html:
                message.attach(MIMEText(email_request.body_html, 'html'))
            
            # Convert to raw format
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            # Send message
            send_result = self.service.users().messages().send(
                userId='me',
                body={'raw': raw_message}
            ).execute()
            
            return SendEmailResponse(
                message_id=send_result['id'],
                thread_id=send_result['threadId'],
                status='sent',
                message='Email sent successfully'
            )
            
        except HttpError as error:
            print(f"Gmail send error: {error}")
            raise Exception(f"Failed to send email: {error}")
    
    async def mark_as_read(self, user_id: str, message_id: str) -> bool:
        """Mark email as read"""
        if not await self.authenticate(user_id):
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            return True
        except HttpError as error:
            print(f"Error marking email as read: {error}")
            return False
    
    async def mark_as_unread(self, user_id: str, message_id: str) -> bool:
        """Mark email as unread"""
        if not await self.authenticate(user_id):
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['UNREAD']}
            ).execute()
            return True
        except HttpError as error:
            print(f"Error marking email as unread: {error}")
            return False
    
    async def search_emails(self, user_id: str, query: str, max_results: int = 10) -> EmailListResponse:
        """Search emails with specific query"""
        return await self.get_emails(user_id, max_results, query)
    
    async def star_email(self, user_id: str, message_id: str) -> bool:
        """Add star to email"""
        if not await self.authenticate(user_id):
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['STARRED']}
            ).execute()
            return True
        except HttpError as error:
            print(f"Error starring email: {error}")
            return False
    
    async def unstar_email(self, user_id: str, message_id: str) -> bool:
        """Remove star from email"""
        if not await self.authenticate(user_id):
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['STARRED']}
            ).execute()
            return True
        except HttpError as error:
            print(f"Error unstarring email: {error}")
            return False
    
    async def mark_as_important(self, user_id: str, message_id: str) -> bool:
        """Mark email as important"""
        if not await self.authenticate(user_id):
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['IMPORTANT']}
            ).execute()
            return True
        except HttpError as error:
            print(f"Error marking email as important: {error}")
            return False
    
    async def mark_as_unimportant(self, user_id: str, message_id: str) -> bool:
        """Mark email as not important"""
        if not await self.authenticate(user_id):
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['IMPORTANT']}
            ).execute()
            return True
        except HttpError as error:
            print(f"Error marking email as not important: {error}")
            return False

    # Voice Command Processing Methods
    async def process_voice_command(self, command_data: dict) -> dict:
        """Process Gmail voice commands using Gemma 3n"""
        action = command_data.get("action")
        params = command_data.get("params", {})
        user_id = "test_user_001"  # Mock user for testing
        
        try:
            if action == "read_unread":
                return await self.read_unread_emails_voice(user_id)
            elif action == "compose":
                return await self.compose_email_voice(user_id, params)
            elif action == "search":
                return await self.search_emails_voice(user_id, params)
            else:
                return {"error": f"Unknown Gmail action: {action}"}
        except Exception as e:
            return {"error": f"Gmail command failed: {str(e)}"}
    
    async def read_unread_emails_voice(self, user_id: str) -> dict:
        """Read unread emails and format for voice response"""
        try:
            # Mock response for testing without Gmail API
            return {
                "response": "You have 3 unread emails. 1 from John about the meeting, 1 from Sarah about the project update, and 1 from LinkedIn about new connections.",
                "count": 3,
                "emails": [
                    {"from": "John Doe", "subject": "Meeting Tomorrow", "snippet": "Can we reschedule..."},
                    {"from": "Sarah Smith", "subject": "Project Update", "snippet": "The latest updates..."},
                    {"from": "LinkedIn", "subject": "New Connections", "snippet": "You have 2 new connections..."}
                ]
            }
        except Exception as e:
            return {"error": f"Failed to read emails: {str(e)}"}
    
    async def compose_email_voice(self, user_id: str, params: dict) -> dict:
        """Compose email using voice parameters"""
        try:
            recipient = params.get("to", "")
            subject = params.get("subject", "")
            
            if not recipient:
                return {"error": "Please specify recipient"}
            
            # Mock email composition
            return {
                "response": f"Email draft created for {recipient} with subject '{subject}'. Would you like me to send it?",
                "draft": {
                    "to": recipient,
                    "subject": subject,
                    "body": f"This is a mock email about {subject}."
                }
            }
            
        except Exception as e:
            return {"error": f"Failed to compose email: {str(e)}"}
    
    async def search_emails_voice(self, user_id: str, params: dict) -> dict:
        """Search emails using voice parameters"""
        try:
            query = params.get("query", "")
            
            # Mock search results
            return {
                "response": f"Found 2 emails matching '{query}'. The most recent is from Alex about the quarterly report.",
                "count": 2,
                "emails": [
                    {"from": "Alex Johnson", "subject": "Quarterly Report", "snippet": "Please find attached..."},
                    {"from": "Manager", "subject": "Team Update", "snippet": "Following up on..."}
                ]
            }
            
        except Exception as e:
            return {"error": f"Failed to search emails: {str(e)}"}

# Global Gmail service instance
gmail_service = GmailService()