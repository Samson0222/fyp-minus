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
                r"any unread emails?",
                r"what unread emails? do i have",
                r"unread (?:emails?|messages?)"
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
                r"write (?:an )?email to (.+)",
                r"compose (?:an )?email",
                r"write (?:an )?email",
                r"new email"
            ],
            'reply_email': [
                r"reply (?:to )?(?:this |the )?email",
                r"respond (?:to )?(?:this |the )?email",
                r"reply (?:to )?(?:this |the )?message",
                r"send (?:a )?reply",
                r"reply back"
            ],
            'forward_email': [
                r"forward (?:this |the )?email (?:to )?(.+)",
                r"send (?:this |the )?email to (.+)",
                r"forward (?:this |the )?message (?:to )?(.+)",
                r"share (?:this |the )?email (?:with )?(.+)"
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
            ],
            'mark_as_unread': [
                r"mark (?:this |the )?email as unread",
                r"mark as unread",
                r"make (?:this |the )?email unread",
                r"set (?:this |the )?email (?:to )?unread",
                r"unread (?:this |the )?email"
            ],
            'refresh_emails': [
                r"refresh (?:my )?emails?",
                r"check (?:for )?new emails?",
                r"update (?:my )?inbox",
                r"reload (?:my )?emails?",
                r"get (?:new )?emails?"
            ],
            'star_email': [
                r"star (?:this |the )?email",
                r"add (?:a )?star (?:to )?(?:this |the )?email",
                r"mark (?:this |the )?email (?:as )?starred",
                r"unstar (?:this |the )?email",
                r"remove (?:the )?star (?:from )?(?:this |the )?email"
            ],
            'mark_important': [
                r"mark (?:this |the )?email (?:as )?important",
                r"mark (?:as )?important",
                r"make (?:this |the )?email important",
                r"set (?:this |the )?email (?:as )?important",
                r"unmark (?:this |the )?email (?:as )?important",
                r"mark (?:this |the )?email (?:as )?not important"
            ]
        }
    
    def parse_command(self, command: str) -> VoiceEmailCommand:
        """Parse voice command and return structured command object"""
        command_lower = command.lower().strip()
        
        # Check for specific patterns first (order matters - more specific patterns first)
        priority_patterns = ['read_unread', 'mark_as_unread', 'reply_email', 'forward_email', 
                           'star_email', 'mark_important', 'send_email', 'send_email_simple', 
                           'search_emails', 'switch_account', 'refresh_emails', 'read_emails']
        
        for command_type in priority_patterns:
            if command_type in self.patterns:
                for pattern in self.patterns[command_type]:
                    match = re.search(pattern, command_lower)
                    if match:
                        print(f"DEBUG: Matched pattern '{pattern}' for command_type '{command_type}' with command '{command_lower}'")
                        return self._create_command(command_type, command, match)
        
        # If no specific pattern matches, try to infer the intent
        print(f"DEBUG: No pattern matched for command '{command_lower}', falling back to general inference")
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
            if len(match.groups()) >= 1 and match.group(1):
                recipient = match.group(1).strip()
                parameters = {
                    'recipient': self._clean_recipient(recipient),
                    'requires_subject': True,
                    'requires_body': True
                }
            else:
                # No recipient specified - just open composer
                parameters = {
                    'action': 'compose'
                }
            
        elif command_type == 'reply_email':
            parameters = {
                'requires_selected_email': True,
                'action': 'reply'
            }
            
        elif command_type == 'forward_email':
            # Extract recipient from the forward command
            if len(match.groups()) >= 1 and match.group(1):
                recipient = match.group(1).strip()
                parameters = {
                    'recipient': self._clean_recipient(recipient),
                    'requires_selected_email': True,
                    'action': 'forward'
                }
            else:
                parameters = {
                    'requires_selected_email': True,
                    'requires_recipient': True,
                    'action': 'forward'
                }
            
        elif command_type == 'search_emails':
            search_term = match.group(1).strip()
            parameters = {
                'query': search_term,
                'count': 10
            }
            
        elif command_type == 'switch_account':
            parameters = {}
        
        elif command_type == 'mark_as_unread':
            parameters = {}
        
        elif command_type == 'refresh_emails':
            parameters = {}
        
        elif command_type == 'star_email':
            parameters = {}
        
        elif command_type == 'mark_important':
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
                    return "You have no unread emails. I'll apply the unread filter so you can see this clearly."
                elif count == 1:
                    return "You have 1 unread email. I'll apply the unread filter and show it to you."
                else:
                    return f"You have {count} unread emails. I'll apply the unread filter and show them to you."
            return "Let me check your unread emails and apply the unread filter."
            
        elif command.command_type == 'send_email':
            if result and hasattr(result, 'status') and result.status == 'sent':
                recipient = command.parameters.get('recipient', 'recipient')
                return f"Email sent successfully to {recipient}."
            return "I'll open the email composer for you."
            
        elif command.command_type == 'send_email_simple':
            return "I'll open the email composer so you can compose your email."
            
        elif command.command_type == 'reply_email':
            if result and hasattr(result, 'status') and result.status == 'sent':
                return "Your reply has been sent successfully."
            return "I'll open the reply composer for the selected email. Please make sure you have an email selected first."
            
        elif command.command_type == 'forward_email':
            recipient = command.parameters.get('recipient')
            if result and hasattr(result, 'status') and result.status == 'sent':
                return f"Email forwarded successfully to {recipient}." if recipient else "Email forwarded successfully."
            elif recipient:
                return f"I'll forward the selected email to {recipient}. Please make sure you have an email selected first."
            else:
                return "I'll open the forward composer for the selected email. Please specify the recipient and make sure you have an email selected."
            
        elif command.command_type == 'search_emails':
            if result and hasattr(result, 'emails'):
                count = len(result.emails)
                query = command.parameters.get('query', 'your search')
                if count == 0:
                    return f"No emails found for '{query}'. I'll apply the search filter to show you the results."
                elif count == 1:
                    return f"Found 1 email matching '{query}'. I'll apply the search filter to show it."
                else:
                    return f"Found {count} emails matching '{query}'. I'll apply the search filter to show them."
            return "I'll search your emails and apply the search filter."
             
        elif command.command_type == 'switch_account':
            return "I'll sign you out so you can switch to a different Gmail account."
             
        elif command.command_type == 'mark_as_unread':
            if result and hasattr(result, 'status') and result.status == 'success':
                return "I've marked the email as unread for you."
            return "I'll mark the selected email as unread. Please make sure you have an email selected first."
             
        elif command.command_type == 'refresh_emails':
            if result and hasattr(result, 'emails'):
                count = len(result.emails)
                return f"I've refreshed your emails and found {count} emails. The interface has been updated with the latest data."
            return "I'm refreshing your emails now and updating the interface."
             
        elif command.command_type == 'star_email':
            return "I'll mark the selected email as starred."
            
        elif command.command_type == 'mark_important':
            if result and hasattr(result, 'status') and result.status == 'success':
                return "I've marked the email as important for you."
            return "I'll mark the selected email as important. Please make sure you have an email selected first."
             
        else:
            return "I can help you read emails, send emails, search your inbox, mark emails as unread, refresh your emails, or switch accounts. What would you like to do?"

# Global voice email processor instance
voice_email_processor = VoiceEmailProcessor()