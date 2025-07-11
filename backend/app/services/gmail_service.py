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
from fastapi import HTTPException

from app.models.email import (
    EmailMessage, EmailSender, EmailRecipient, EmailAttachment,
    EmailListResponse, SendEmailRequest, SendEmailResponse
)
from app.core.llm_factory import get_llm_service
from app.core.config import GOOGLE_SCOPES
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

class GmailService:
    """Gmail API service for handling email operations"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.service = self._get_gmail_service()
        
    def _get_gmail_service(self):
        """Authenticates and returns the Gmail service, raising HTTPException on failure."""
        creds = None
        tokens_dir = os.getenv("GOOGLE_TOKENS_DIR", "tokens")
        os.makedirs(tokens_dir, exist_ok=True)
        token_path = os.path.join(tokens_dir, f"token_google_{self.user_id}.json")

        if not os.path.exists(token_path):
            logger.warning(f"Authentication token not found for user_id: {self.user_id}")
            raise HTTPException(
                status_code=401,
                detail="User is not authenticated. Please connect your Google account via the settings page.",
            )

        try:
            creds = Credentials.from_authorized_user_file(token_path, GOOGLE_SCOPES)
        except Exception as e:
            logger.error(f"Failed to load credentials for user {self.user_id}: {e}")
            raise HTTPException(
                status_code=401,
                detail="Could not load credentials. Please try re-authenticating.",
            )

        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                logger.info(f"Refreshing expired token for user_id: {self.user_id}")
                try:
                    creds.refresh(Request())
                    # Save the refreshed credentials
                    with open(token_path, 'w') as token:
                        token.write(creds.to_json())
                except Exception as e:
                    logger.error(f"Failed to refresh token for user {self.user_id}: {e}")
                    # If refresh fails, the token is likely invalid.
                    # Delete the bad token and force re-authentication.
                    os.remove(token_path)
                    raise HTTPException(
                        status_code=401,
                        detail="Failed to refresh authentication token. Please re-authenticate.",
                    )
            else:
                # No valid credentials and no refresh token.
                logger.warning(f"Invalid credentials and no refresh token for user_id: {self.user_id}")
                raise HTTPException(
                    status_code=401,
                    detail="Invalid credentials. Please re-authenticate.",
                )
        
        return build('gmail', 'v1', credentials=creds)
    
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
            parsed_date = email.utils.parsedate_to_datetime(date_str)
        except Exception:
            parsed_date = datetime.utcnow()
        
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
            date=parsed_date,
            is_read=is_read,
            is_important=is_important,
            is_starred=is_starred,
            labels=labels,
            snippet=message.get('snippet', ''),
            attachments=[]  # TODO: Parse attachments if needed
        )
    
    async def get_emails(self, max_results: int = 10, query: str = '', minimal: bool = False) -> EmailListResponse:
        """Get list of emails. If minimal=True only return headers/snippet for speed."""
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
                    
                    # Correctly parse the date from headers
                    date_str = headers.get('Date', '')
                    try:
                        # Gmail dates can be in various formats, so we need a robust parser
                        parsed_date = email.utils.parsedate_to_datetime(date_str)
                    except Exception:
                        parsed_date = datetime.utcnow() # Fallback

                    email_obj = EmailMessage(
                        id=meta['id'],
                        thread_id=meta['threadId'],
                        subject=headers.get('Subject', '(No Subject)'),
                        sender=self._parse_email_address(headers.get('From', '')),
                        recipients=[],
                        date=parsed_date,
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

    async def get_message(self, message_id: str) -> EmailMessage:
        """Fetch full content for a single message."""
        try:
            full = self.service.users().messages().get(userId='me', id=message_id, format='full').execute()
            return self._parse_gmail_message(full)
        except HttpError as e:
            raise Exception(f'Failed to fetch message: {e}')
    
    async def send_email(self, email_request: SendEmailRequest) -> SendEmailResponse:
        """Sends an email on behalf of the user"""
        try:
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
    
    async def mark_as_read(self, message_id: str) -> bool:
        """Mark an email as read"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            return True
        except HttpError as e:
            raise Exception(f'Failed to mark as read: {e}')
    
    async def mark_as_unread(self, message_id: str) -> bool:
        """Mark an email as unread"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['UNREAD']}
            ).execute()
            return True
        except HttpError as e:
            raise Exception(f'Failed to mark as unread: {e}')
    
    async def search_emails(self, query: str, max_results: int = 10) -> EmailListResponse:
        """Alias for get_emails with a query"""
        return await self.get_emails(max_results=max_results, query=query)
    
    async def star_email(self, message_id: str) -> bool:
        """Star an email"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['STARRED']}
            ).execute()
            return True
        except HttpError as e:
            raise Exception(f'Failed to star email: {e}')
    
    async def unstar_email(self, message_id: str) -> bool:
        """Unstar an email"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['STARRED']}
            ).execute()
            return True
        except HttpError as e:
            raise Exception(f'Failed to unstar email: {e}')
    
    async def mark_as_important(self, message_id: str) -> bool:
        """Mark an email as important"""
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['IMPORTANT']}
            ).execute()
            return True
        except HttpError as e:
            raise Exception(f'Failed to mark as important: {e}')
    
    async def mark_as_unimportant(self, message_id: str) -> bool:
        """Mark an email as not important."""
        return await self._modify_labels(message_id, remove_label_ids=['IMPORTANT'])

    async def process_voice_command(self, command_data: dict) -> dict:
        """Processes a voice command by routing to the appropriate function."""
        
        # Initialize LLM on demand
        llm_service = get_llm_service()
        if not llm_service:
            return {"response": "The AI reasoning module is not available right now."}

        action = command_data.get("action", "unknown")
        params = command_data.get("params", {})
        
        if action == "read_unread":
            return await self.read_unread_emails_voice()
        elif action == "compose":
            # The LLM's response for "compose" might need further processing
            # to extract details like recipient, subject, and body.
            # For now, we assume params are well-formed.
            return await self.compose_email_voice(params)
        elif action == "search":
            return await self.search_emails_voice(params)
        else:
            # If the action is unknown, ask the LLM to clarify or respond directly.
            response_text = await llm_service.process_command(
                user_input=f"The user wanted to perform an unknown email action: '{action}'. Ask for clarification.",
            )
            return {"response": response_text.get("params", {}).get("text", "I'm not sure how to handle that email command. Could you please rephrase?")}


    async def read_unread_emails_voice(self) -> dict:
        """Fetches unread emails and formats them for a voice response."""
        try:
            response = await self.get_emails(max_results=5, query="is:unread")
            if not response.emails:
                return {"summary": "You have no unread emails."}

            summary = f"You have {len(response.emails)} unread emails. "
            for i, email in enumerate(response.emails):
                summary += f"Email {i+1} is from {email.sender.name or email.sender.email} with subject: {email.subject}. "
            
            return {"summary": summary, "emails": response.dict()['emails']}
        except Exception as e:
            return {"error": str(e)}
    
    async def compose_email_voice(self, params: dict) -> dict:
        """Composes and sends an email based on voice parameters."""
        recipient = params.get("to")
        subject = params.get("subject", "(No Subject)")
        body = params.get("body", "Sent via voice command.")

        if not recipient:
            return {"response": "I need to know who to send the email to. Please specify a recipient."}

        try:
            email_req = SendEmailRequest(
                recipients=[EmailRecipient(email=recipient)],
                subject=subject,
                body=body
            )
            await self.send_email(email_req)
            return {"response": f"The email to {recipient} about {subject} has been sent."}
        except Exception as e:
            logger.error(f"Failed to send email via voice: {e}")
            return {"response": "Sorry, I was unable to send the email."}
    
    async def search_emails_voice(self, params: dict) -> dict:
        """Searches for emails based on a voice query."""
        query = params.get("query")
        if not query:
            return {"error": "No search query provided."}
        
        try:
            response = await self.get_emails(max_results=3, query=query)
            if not response.emails:
                return {"summary": f"I couldn't find any emails matching '{query}'."}
            
            summary = f"I found {len(response.emails)} emails matching your search. "
            for i, email in enumerate(response.emails):
                summary += f"Email {i+1} from {email.sender.name or email.sender.email}, subject: {email.subject}. "
            
            return {"summary": summary, "emails": response.dict()['emails']}
        except Exception as e:
            logger.error(f"Failed to search emails via voice: {e}")
            return {"response": "Sorry, I ran into an error while searching your emails."}