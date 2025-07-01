# Minus: Voice-Controlled AI Assistant for Professional Accessibility
## Final Year Project (FYP) Development Plan

### 🎯 Project Overview

**Project Title**: Voice-Controlled AI Assistant for Professional Communication and Task Management  
**Focus**: Accessibility solution for individuals with hand mobility limitations  
**Duration**: 2 weeks development + 1 week UAT + 1 week report writing  
**Target Platforms**: Gmail, Google Docs, Google Calendar, Telegram  

---

## 📋 Academic Objectives

1. **Primary Goal**: Design and implement a voice-controlled AI assistant that enables users with physical disabilities to manage professional communications effectively
2. **Technical Innovation**: Demonstrate integration of STT, NLP, LLMs, and MCP protocol for accessibility applications
3. **User-Centered Design**: Create an intuitive, accessible interface validated through user testing
4. **Academic Contribution**: Advance research in workplace accessibility technology

---

## 🏗️ Technical Architecture

```
Voice Input → Whisper STT → LangChain Agent → MCP Servers → Platform APIs
                                    ↓              ↓
                            [Query Planning]  [Gmail, Docs, Calendar, Telegram]
                                    ↓              ↓
                           [Result Fusion] ← [Unified Results]
                                    ↓
                           Response → TTS → Audio Output
```

### Core Technology Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: FastAPI + Python + LangChain
- **Database**: Supabase (PostgreSQL + Auth)
- **AI Services**: OpenAI Whisper (STT), Gemma/GPT-4o (LLM), ElevenLabs (TTS)
- **Integration**: MCP (Model Context Protocol) for platform connectivity

---

## 📅 Development Timeline

### Week 1: Core Development (Days 1-7)
**Goal**: Build fundamental voice interface and platform integrations

#### Day 1: Foundation Setup
**Time**: 6-8 hours  
**Tasks**:
- [ ] Set up development environment (React + FastAPI)
- [ ] Configure Supabase project and authentication
- [ ] Initialize voice pipeline (Web Audio API setup)
- [ ] Basic FastAPI structure with CORS
- [ ] Environment variables configuration

**Deliverables**:
- Working dev environment
- Basic voice recording functionality
- API endpoints structure

#### Day 2: Voice Pipeline Implementation
**Time**: 6-8 hours  
**Tasks**:
- [ ] Implement Whisper STT integration
- [ ] Add TTS service (ElevenLabs/Google)
- [ ] Voice activity detection
- [ ] Audio processing and error handling
- [ ] Basic voice command testing

**Deliverables**:
- Complete voice input/output pipeline
- Audio quality optimization
- Voice command recognition testing

#### Day 3: Gmail Integration
**Time**: 6-8 hours  
**Tasks**:
- [ ] Google API credentials setup
- [ ] Gmail MCP server integration
- [ ] Email reading functionality
- [ ] Email composition via voice
- [ ] Email search and filtering

**Voice Commands to Implement**:
- "Read my unread emails"
- "Compose email to [person] about [subject]"
- "Reply to this email"
- "Search for emails from [person]"

**Deliverables**:
- Working Gmail voice commands
- Email management without keyboard/mouse

#### Day 4: Google Docs Integration
**Time**: 6-8 hours  
**Tasks**:
- [ ] Google Docs API integration
- [ ] Document creation via voice
- [ ] Document editing and formatting
- [ ] Document search and navigation
- [ ] Template-based document creation

**Voice Commands to Implement**:
- "Create new document called [name]"
- "Open document [name]"
- "Add paragraph: [content]"
- "Format as bullet points"
- "Save document"

**Deliverables**:
- Voice-controlled document creation
- Professional document formatting via voice

#### Day 5: Google Calendar Integration
**Time**: 6-8 hours  
**Tasks**:
- [ ] Google Calendar API setup
- [ ] Event creation via voice commands
- [ ] Calendar reading and navigation
- [ ] Meeting scheduling with participants
- [ ] Event modification and deletion

**Voice Commands to Implement**:
- "Schedule meeting with [person] [day] at [time]"
- "What's on my calendar today?"
- "Cancel my 3 PM meeting"
- "Block 2 hours for project work tomorrow"

**Deliverables**:
- Complete calendar management via voice
- Meeting scheduling without manual input

#### Day 6: Telegram Integration
**Time**: 6-8 hours  
**Tasks**:
- [ ] Telegram Bot API setup
- [ ] Message sending functionality
- [ ] Group notification system
- [ ] Quick announcement features
- [ ] Integration with other platforms

**Voice Commands to Implement**:
- "Send message to team: [message]"
- "Notify everyone about [announcement]"
- "Tell the group: [update]"

**Deliverables**:
- Team communication via voice
- Cross-platform notification system

#### Day 7: LangChain Agent Integration
**Time**: 6-8 hours  
**Tasks**:
- [ ] LangChain setup with chosen LLM
- [ ] MCP tool integration
- [ ] Cross-platform query handling
- [ ] Context-aware responses
- [ ] Command disambiguation

**Deliverables**:
- Intelligent voice command processing
- Cross-platform workflow automation

### Week 2: Advanced Features & Polish (Days 8-14)

#### Day 8: Cross-Platform Intelligence
**Time**: 6-8 hours  
**Tasks**:
- [ ] Unified search across platforms
- [ ] Email → Calendar workflow
- [ ] Document → Calendar integration
- [ ] Calendar → Telegram notifications
- [ ] Context correlation between platforms

**Advanced Commands**:
- "Schedule meeting based on John's email"
- "Create calendar events for document deadlines"
- "Notify team about schedule changes"

**Deliverables**:
- Sophisticated cross-platform workflows
- Intelligent task automation

#### Day 9: Accessibility Features
**Time**: 6-8 hours  
**Tasks**:
- [ ] High contrast UI mode
- [ ] Adjustable speech rate for TTS
- [ ] Voice feedback for all actions
- [ ] Error correction workflows
- [ ] Screen reader compatibility

**Accessibility Features**:
- "Repeat that" command
- "Slow down" / "Speed up" for TTS
- "Help me with [task]" guidance
- Visual indicators for voice states

**Deliverables**:
- WCAG 2.1 compliant interface
- Enhanced accessibility features

#### Day 10: Performance Optimization
**Time**: 6-8 hours  
**Tasks**:
- [ ] Response time optimization
- [ ] Voice recognition accuracy tuning
- [ ] Error handling improvements
- [ ] Caching implementation
- [ ] API rate limiting

**Performance Targets**:
- <2 second voice command response
- >95% voice recognition accuracy
- Graceful error recovery
- Responsive UI feedback

**Deliverables**:
- Optimized system performance
- Robust error handling

#### Day 11: User Interface Polish
**Time**: 6-8 hours  
**Tasks**:
- [ ] Professional UI design
- [ ] Loading states and feedback
- [ ] Voice command visualization
- [ ] Platform status indicators
- [ ] Demo-ready interface

**UI Features**:
- Voice recording visualization
- Command history display
- Platform connection status
- Clear action confirmations

**Deliverables**:
- Polished, professional interface
- Demo-ready user experience

#### Days 12-14: Testing & Documentation
**Time**: 6-8 hours per day  
**Tasks**:
- [ ] Comprehensive system testing
- [ ] User testing with target audience
- [ ] Bug fixes and improvements
- [ ] Performance validation
- [ ] Demo script preparation
- [ ] Technical documentation
- [ ] User guide creation

**Testing Focus**:
- Accessibility compliance testing
- Voice command accuracy validation
- Cross-platform workflow testing
- User feedback collection

**Deliverables**:
- Fully tested system
- User validation results
- Complete documentation

---

## 🎯 Core Features by Platform

### Gmail (Email Management)
- **Read emails**: "Read my unread emails"
- **Compose**: "Compose email to John about budget meeting"
- **Reply**: "Reply to this email: I'll attend the meeting"
- **Search**: "Find emails from Sarah about project deadlines"
- **Organize**: "Mark this email as important"

### Google Docs (Document Management)
- **Create**: "Create new document called Project Plan"
- **Edit**: "Add paragraph about timeline requirements"
- **Format**: "Make this text bold", "Create bullet points"
- **Navigate**: "Go to section 2", "Find the word budget"
- **Save**: "Save document as Meeting Notes"

### Google Calendar (Task/Meeting Management)
- **Schedule**: "Schedule team meeting Tuesday at 10 AM"
- **Check**: "What's on my calendar tomorrow?"
- **Modify**: "Move my 3 PM meeting to 4 PM"
- **Block time**: "Reserve 2 hours for focused work Friday"
- **Cancel**: "Cancel my meeting with the design team"

### Telegram (Team Communication)
- **Announce**: "Tell everyone: deadline moved to Friday"
- **Update**: "Send message to project team: budget approved"
- **Notify**: "Inform the group about the new meeting room"
- **Status**: "Let everyone know I'm working from home"

---

## 🧪 Testing & Evaluation Plan

### Week 3: User Acceptance Testing
**Target Users**: Individuals with hand mobility limitations
**Testing Methods**: 
- Task completion scenarios
- Usability interviews  
- Performance metrics collection
- Accessibility compliance audit

### Testing Scenarios
1. **Email Workflow**: Compose and send professional email via voice only
2. **Document Creation**: Create formatted meeting agenda using voice commands
3. **Calendar Management**: Schedule complex meeting with multiple participants
4. **Team Communication**: Send announcements and updates to team channels
5. **Cross-Platform**: Execute workflow spanning multiple platforms

### Success Metrics
- **Task Completion Rate**: >90% successful completion of voice commands
- **Time Efficiency**: <50% of traditional keyboard/mouse time for tasks
- **User Satisfaction**: >4/5 rating on usability scale
- **Accessibility Compliance**: WCAG 2.1 AA standard compliance
- **Voice Recognition Accuracy**: >95% command understanding

---

## 📊 Academic Deliverables

### FYP Report Structure
1. **Introduction** (5 pages)
   - Problem statement and motivation
   - Research objectives and scope
   - Accessibility context and requirements

2. **Literature Review** (8 pages)
   - Accessibility technology research
   - Voice interface design principles
   - AI applications in assistive technology

3. **Methodology** (6 pages)
   - User research approach
   - System design methodology
   - Technical architecture decisions

4. **Implementation** (10 pages)
   - System architecture and components
   - Platform integration strategies
   - Voice interface design patterns
   - Accessibility feature implementation

5. **Evaluation** (8 pages)
   - User testing methodology
   - Performance metrics and results
   - Accessibility assessment
   - User feedback analysis

6. **Conclusion** (3 pages)
   - Contribution summary
   - Limitations and future work
   - Impact on accessibility research

### Technical Documentation
- API documentation
- Installation and setup guide
- User manual for voice commands
- Developer guide for extensions

---

## 🚀 Demo Preparation

### 5-Minute FYP Presentation Demo
1. **Opening** (30 seconds): Problem statement and solution overview
2. **Email Management** (90 seconds): Voice-controlled email composition and reading
3. **Document Creation** (90 seconds): Professional document creation via voice
4. **Calendar Scheduling** (90 seconds): Meeting scheduling and management
5. **Team Communication** (60 seconds): Cross-platform notifications and updates
6. **Closing** (30 seconds): Impact statement and future potential

### Demo Script
- **Setup**: Professional workspace with accessibility challenges
- **User Persona**: Working professional with RSI/hand mobility limitations
- **Scenarios**: Real-world professional tasks requiring keyboard/mouse alternatives
- **Outcome**: Demonstrate equivalent or improved efficiency via voice control

---

## 📦 Deployment & Infrastructure

### Development Environment
- **Local**: React dev server + FastAPI development
- **Staging**: Render/Railway backend + Vercel frontend
- **Production**: Stable deployment for user testing

### Environment Variables
```bash
# AI Services
OPENAI_API_KEY=your_key
ELEVENLABS_API_KEY=your_key

# Google APIs
GOOGLE_CLIENT_ID=your_id
GOOGLE_CLIENT_SECRET=your_secret
GOOGLE_CALENDAR_API_KEY=your_key

# Telegram
TELEGRAM_BOT_TOKEN=your_token

# Database
SUPABASE_URL=your_url
SUPABASE_ANON_KEY=your_key
```

---

## 🛠️ Technical Requirements

### Minimum System Requirements
- **Browser**: Chrome/Edge (for Web Audio API support)
- **Microphone**: Built-in or external microphone
- **Internet**: Stable connection for AI services and APIs
- **RAM**: 4GB minimum for local development

### API Quotas and Limits
- **OpenAI Whisper**: 25MB file limit per request
- **Google APIs**: 100 requests/100 seconds/user
- **Telegram Bot**: 30 messages/second
- **ElevenLabs**: Character limits based on plan

---

## 📈 Success Criteria

### Technical Success
- ✅ Voice commands work with >95% accuracy
- ✅ All 4 platforms integrate successfully
- ✅ Cross-platform workflows function correctly
- ✅ Response time <2 seconds for voice commands
- ✅ System handles errors gracefully

### Academic Success
- ✅ Clear demonstration of accessibility improvement
- ✅ User validation with target disability community
- ✅ Technical innovation in voice interface design
- ✅ Comprehensive evaluation and documentation
- ✅ Contribution to assistive technology research

### Impact Success
- ✅ Measurable improvement in task completion time
- ✅ Positive user feedback from accessibility testing
- ✅ Demonstration of workplace productivity enhancement
- ✅ Framework for future accessibility tool development

---

## 🔧 Risk Mitigation

### Technical Risks
- **Voice Recognition Issues**: Implement fallback to typing input
- **API Rate Limits**: Add caching and request optimization
- **Integration Complexity**: Start with simple implementations, iterate
- **Performance Problems**: Profile and optimize critical paths

### Scope Risks
- **Feature Creep**: Stick to core platforms and functionality
- **Timeline Pressure**: Prioritize working demo over perfect polish
- **User Testing Delays**: Have backup evaluation methods ready

### Academic Risks
- **Limited User Access**: Supplement with simulated accessibility scenarios
- **Technical Documentation**: Document as you build, not after
- **Evaluation Metrics**: Define success criteria early and measure consistently

---

## 📞 Support & Resources

### Technical Resources
- MCP Documentation: https://modelcontextprotocol.io/
- Google APIs: https://developers.google.com/
- LangChain Docs: https://python.langchain.com/
- Accessibility Guidelines: https://www.w3.org/WAI/WCAG21/

### Academic Support
- FYP Supervisor: Regular progress meetings
- Accessibility Community: User testing participants
- Technical Mentors: Code review and architecture guidance

---

**Project Start Date**: [Current Date]  
**Development Completion**: [Current Date + 14 days]  
**UAT Completion**: [Current Date + 21 days]  
**Report Submission**: [Current Date + 28 days]

---

*This project plan represents a comprehensive roadmap for developing a voice-controlled AI assistant focused on workplace accessibility. The timeline is aggressive but achievable with focused effort and clear priorities.*