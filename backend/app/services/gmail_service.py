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
from unittest.mock import MagicMock

logger = logging.getLogger(__name__)

class GmailService:
    """Gmail API service for handling email operations"""
    
    def __init__(self, user_id: str, testing: bool = False):
        self.user_id = user_id
        if testing:
            self.service = self._get_mock_service()
        else:
        self.service = self._get_gmail_service()
        
    def _get_mock_service(self):
        """Returns a mock service for testing purposes."""
        return MagicMock()
        
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
    
    async def create_draft_email(self, to: str, subject: str, body: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
        """Creates a draft email but does not send it."""
        try:
            message = MIMEText(body)
            message['to'] = to
            message['subject'] = subject
            
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            
            draft_body = {'message': {'raw': raw_message}}
            if thread_id:
                draft_body['message']['threadId'] = thread_id
                
            draft = self.service.users().drafts().create(userId='me', body=draft_body).execute()
            
            # Return a simplified dictionary, not a full Pydantic model
            return {
                "draft_id": draft['id'],
                "message_id": draft['message']['id'],
                "to": to,
                "subject": subject,
                "body": body,
                "thread_id": thread_id
            }
        except HttpError as error:
            logger.error(f"An error occurred creating a draft: {error}")
            raise HTTPException(status_code=500, detail="Failed to create email draft.")
            
    async def send_draft(self, draft_id: str) -> Dict[str, Any]:
        """Sends a previously created draft."""
        try:
            sent_message = self.service.users().drafts().send(userId='me', body={'id': draft_id}).execute()
            return sent_message
        except HttpError as error:
            logger.error(f"An error occurred sending a draft: {error}")
            raise HTTPException(status_code=500, detail="Failed to send draft.")

    async def get_draft_details(self, draft_id: str) -> EmailMessage:
        """Fetch full content for a single draft."""
        try:
            draft = self.service.users().drafts().get(userId='me', id=draft_id, format='full').execute()
            # A draft resource contains a message resource, which we can parse.
            return self._parse_gmail_message(draft['message'])
        except HttpError as e:
            logger.error(f"Failed to fetch draft details for draft_id {draft_id}: {e}")
            raise Exception(f'Failed to fetch draft details: {e}')

    async def delete_draft(self, draft_id: str) -> Dict[str, Any]:
        """Deletes a specific draft."""
        try:
            self.service.users().drafts().delete(userId='me', id=draft_id).execute()
            return {"status": "success", "message": f"Draft {draft_id} deleted."}
        except HttpError as error:
            # It's possible the draft was already sent/deleted, which can be ignored.
            if error.resp.status == 404:
                logger.warning(f"Attempted to delete draft {draft_id} which was not found.")
                return {"status": "success", "message": "Draft not found, may have been already sent or deleted."}
            logger.error(f"An error occurred deleting a draft: {error}")
            raise HTTPException(status_code=500, detail="Failed to delete draft.")
    
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
        """Mark an email as not important by removing the IMPORTANT label."""
        return await self._modify_labels(message_id, remove_label_ids=['IMPORTANT'])