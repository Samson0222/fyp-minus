import re
from typing import Dict, Any, List, Optional
from app.models.email import VoiceEmailCommand, SendEmailRequest

class VoiceEmailProcessor:
    """Process voice commands for email operations"""
    
    def __init__(self):
        # Command patterns for different email operations
        self.patterns = {
            'read_emails': [
                r"read (?:my )?(?:latest |recent |new )?emails?",
                r"show (?:my )?(?:latest |recent |new )?emails?",
                r"check (?:my )?(?:latest |recent |new )?emails?",
                r"what (?:emails? |messages? )?do i have",
                r"any new emails?",
                r"inbox"
            ],
            'read_unread': [
                r"read (?:my )?unread emails?",
                r"show (?:my )?unread emails?",
                r"check (?:my )?unread emails?",
                r"any unread emails?"
            ],
            'send_email': [
                r"send (?:an )?email to (.+?) (?:about |regarding |with subject |subject) (.+)",
                r"email (.+?) (?:about |regarding |with subject |subject) (.+)",
                r"compose (?:an )?email to (.+?) (?:about |regarding |with subject |subject) (.+)",
                r"write (?:an )?email to (.+?) (?:about |regarding |with subject |subject) (.+)"
            ],
            'send_email_simple': [
                r"send (?:an )?email to (.+)",
                r"email (.+)",
                r"compose (?:an )?email to (.+)",
                r"write (?:an )?email to (.+)"
            ],
            'search_emails': [
                r"search (?:for )?emails? (?:about |containing |with |from) (.+)",
                r"find emails? (?:about |containing |with |from) (.+)",
                r"look for emails? (?:about |containing |with |from) (.+)"
            ],
            'switch_account': [
                r"switch (?:gmail )?account",
                r"change (?:gmail )?account",
                r"sign out (?:of )?(?:gmail)?",
                r"logout (?:of )?(?:gmail)?",
                r"use (?:a )?different account"
            ]
        }
    
    def parse_command(self, command: str) -> VoiceEmailCommand:
        """Parse voice command and return structured command object"""
        command_lower = command.lower().strip()
        
        # Try to match different command types
        for command_type, patterns in self.patterns.items():
            for pattern in patterns:
                match = re.search(pattern, command_lower)
                if match:
                    return self._create_command(command_type, command, match)
        
        # If no specific pattern matches, try to infer the intent
        if any(word in command_lower for word in ['read', 'show', 'check', 'inbox']):
            return VoiceEmailCommand(
                command_type='read_emails',
                parameters={'count': 5},
                raw_command=command
            )
        elif any(word in command_lower for word in ['send', 'email', 'compose', 'write']):
            return VoiceEmailCommand(
                command_type='send_email',
                parameters=self._extract_email_info(command),
                raw_command=command
            )
        elif any(word in command_lower for word in ['search', 'find', 'look']):
            return VoiceEmailCommand(
                command_type='search_emails',
                parameters={'query': command_lower},
                raw_command=command
            )
        elif any(word in command_lower for word in ['switch', 'change', 'logout', 'sign out', 'different account']):
            return VoiceEmailCommand(
                command_type='switch_account',
                parameters={},
                raw_command=command
            )
        else:
            return VoiceEmailCommand(
                command_type='unknown',
                parameters={},
                raw_command=command
            )
    
    def _create_command(self, command_type: str, original_command: str, match) -> VoiceEmailCommand:
        """Create structured command based on type and regex match"""
        parameters = {}
        
        if command_type == 'read_emails':
            # Extract count if mentioned
            count_match = re.search(r'(\d+)', original_command)
            parameters['count'] = int(count_match.group(1)) if count_match else 10
            
        elif command_type == 'read_unread':
            parameters['unread_only'] = True
            parameters['count'] = 20
            
        elif command_type == 'send_email':
            if len(match.groups()) >= 2:
                recipient = match.group(1).strip()
                subject = match.group(2).strip()
                parameters = {
                    'recipient': self._clean_recipient(recipient),
                    'subject': subject,
                    'requires_body': True
                }
            else:
                parameters = self._extract_email_info(original_command)
                
        elif command_type == 'send_email_simple':
            recipient = match.group(1).strip()
            parameters = {
                'recipient': self._clean_recipient(recipient),
                'requires_subject': True,
                'requires_body': True
            }
            
        elif command_type == 'search_emails':
            search_term = match.group(1).strip()
            parameters = {
                'query': search_term,
                'count': 10
            }
            
        elif command_type == 'switch_account':
            parameters = {}
        
        return VoiceEmailCommand(
            command_type=command_type,
            parameters=parameters,
            raw_command=original_command
        )
    
    def _clean_recipient(self, recipient: str) -> str:
        """Clean and validate recipient email address"""
        # Remove common speech artifacts
        recipient = recipient.replace(" at ", "@").replace(" dot ", ".")
        
        # Handle common domain substitutions
        domain_replacements = {
            "gmail": "gmail.com",
            "yahoo": "yahoo.com", 
            "hotmail": "hotmail.com",
            "outlook": "outlook.com"
        }
        
        for domain_key, domain_full in domain_replacements.items():
            if recipient.endswith(f"@{domain_key}"):
                recipient = recipient.replace(f"@{domain_key}", f"@{domain_full}")
        
        return recipient
    
    def _extract_email_info(self, command: str) -> Dict[str, Any]:
        """Extract email information from natural language command"""
        parameters = {}
        
        # Try to find email addresses
        email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
        emails = re.findall(email_pattern, command)
        if emails:
            parameters['recipient'] = emails[0]
        else:
            # Look for potential email-like patterns (handling speech-to-text)
            potential_email = re.search(r'(\w+(?:\s+at\s+|\s*@\s*)\w+(?:\s+dot\s+|\s*\.\s*)\w+)', command.lower())
            if potential_email:
                parameters['recipient'] = self._clean_recipient(potential_email.group(1))
        
        # Try to extract subject
        subject_patterns = [
            r'(?:about|regarding|subject|with subject)\s+(.+?)(?:\s+(?:saying|message|body|content)|$)',
            r'(?:titled|subject line)\s+(.+?)(?:\s+(?:saying|message|body|content)|$)'
        ]
        
        for pattern in subject_patterns:
            subject_match = re.search(pattern, command.lower())
            if subject_match:
                parameters['subject'] = subject_match.group(1).strip()
                break
        
        # Try to extract message body
        body_patterns = [
            r'(?:saying|message|body|content|text)\s+(.+)$',
            r'(?:tell them|say)\s+(.+)$'
        ]
        
        for pattern in body_patterns:
            body_match = re.search(pattern, command.lower())
            if body_match:
                parameters['body'] = body_match.group(1).strip()
                break
        
        return parameters
    
    def create_send_request(self, command: VoiceEmailCommand, default_body: str = None) -> SendEmailRequest:
        """Create SendEmailRequest from voice command"""
        params = command.parameters
        
        recipient = params.get('recipient', '')
        if not recipient:
            raise ValueError("Recipient email address is required")
        
        subject = params.get('subject', 'Email from Voice Assistant')
        body = params.get('body', default_body or 'This email was sent via voice command.')
        
        return SendEmailRequest(
            to=[recipient],
            subject=subject,
            body_plain=body
        )
    
    def generate_response(self, command: VoiceEmailCommand, result: Any = None) -> str:
        """Generate natural language response for email command"""
        if command.command_type == 'read_emails':
            if result and hasattr(result, 'emails'):
                count = len(result.emails)
                if count == 0:
                    return "You have no emails in your inbox."
                elif count == 1:
                    return "You have 1 email. I'll read it for you."
                else:
                    return f"You have {count} emails. I'll read them for you."
            return "Let me check your emails."
            
        elif command.command_type == 'read_unread':
            if result and hasattr(result, 'emails'):
                count = len(result.emails)
                if count == 0:
                    return "You have no unread emails."
                elif count == 1:
                    return "You have 1 unread email. I'll read it for you."
                else:
                    return f"You have {count} unread emails. I'll read them for you."
            return "Let me check your unread emails."
            
        elif command.command_type == 'send_email':
            if result and hasattr(result, 'status') and result.status == 'sent':
                recipient = command.parameters.get('recipient', 'recipient')
                return f"Email sent successfully to {recipient}."
            return "Preparing to send your email."
            
        elif command.command_type == 'search_emails':
            if result and hasattr(result, 'emails'):
                count = len(result.emails)
                query = command.parameters.get('query', 'your search')
                if count == 0:
                    return f"No emails found for '{query}'."
                elif count == 1:
                    return f"Found 1 email matching '{query}'."
                else:
                    return f"Found {count} emails matching '{query}'."
            return "Searching your emails."
             
        elif command.command_type == 'switch_account':
            return "I'll sign you out so you can switch to a different Gmail account."
             
        else:
            return "I can help you read emails, send emails, search your inbox, or switch accounts. What would you like to do?"

# Global voice email processor instance
voice_email_processor = VoiceEmailProcessor()