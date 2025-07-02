# Minus: Voice-Controlled AI Assistant for Professional Accessibility
## Final Year Project (FYP) Development Plan

### 🎯 Project Overview

**Project Title**: Voice-Controlled AI Assistant for Professional Communication and Task Management  
**Focus**: Accessibility solution for individuals with hand mobility limitations  
**Duration**: 1 week broad development + 1 week deep features & UAT + 1 week report writing  
**Target Platforms**: Gmail, Google Docs, Google Calendar, Telegram  

---

## 📋 Academic Objectives

1. **Primary Goal**: Design and implement a voice-controlled AI assistant that enables users with physical disabilities to manage professional communications effectively
2. **Technical Innovation**: Demonstrate integration of FastRTC, STT, NLP, LLMs, and intelligent agents for accessibility applications
3. **User-Centered Design**: Create an intuitive, accessible interface validated through user testing
4. **Academic Contribution**: Advance research in workplace accessibility technology

---

## 🏗️ Technical Architecture

```
Voice Input → FastRTC (Moonshine STT) → LangChain Agent → Platform APIs
                                              ↓              ↓
                                      [Command Router]  [Gmail, Docs, Calendar, Telegram]
                                              ↓              ↓
                                     [Response Generator] ← [Unified Results]
                                              ↓
                                   Response → Kokoro TTS → Audio Output
```

### Updated Technology Stack
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS (existing UI preserved)
- **Voice Pipeline**: FastRTC with built-in Moonshine STT + Kokoro TTS
- **Backend**: FastAPI + Python + LangChain Agent
- **Database**: Supabase (PostgreSQL + Auth)
- **LLM**: Groq (fast, free tier) with local Gemma fallback
- **Integration**: Direct API integration for all platforms

---

## 📅 Revised 3-Week Development Timeline

### **WEEK 1: BROAD - All 4 Platforms Basic Functions (Days 1-7)**
**Strategy**: Go broad first - get basic functionality working across all platforms simultaneously

#### **Day 1: Foundation + Gmail + Calendar**
**Time**: 8 hours  
**Morning Session (4h)**:
- [ ] FastRTC setup + LangChain agent foundation
- [ ] Voice pipeline test (record → transcribe → respond)
- [ ] Groq LLM integration with command routing

**Afternoon Session (4h)**:
- [ ] **Gmail Basic**: Read unread emails, basic compose functionality
- [ ] **Calendar Basic**: Check today's schedule, create simple event
- [ ] Test voice commands: "read my emails", "what's my schedule today"

**Deliverables**:
- Working voice pipeline with FastRTC
- Basic Gmail email reading and composition
- Basic Calendar schedule checking and event creation

#### **Day 2: Docs + Telegram + Agent Router**
**Time**: 8 hours  
**Morning Session (4h)**:
- [ ] **Google Docs Basic**: Create document, read document content
- [ ] **Telegram Basic**: Send message, read recent messages

**Afternoon Session (4h)**:
- [ ] LangChain agent router for all 4 platforms
- [ ] Command routing logic: detect which platform to use
- [ ] Voice commands: "create document", "send message to team"

**Deliverables**:
- Basic Google Docs document creation and reading
- Basic Telegram messaging functionality
- Intelligent command routing across platforms

#### **Day 3: Integration + UI Bridge + Error Handling**
**Time**: 8 hours  
**Morning Session (4h)**:
- [ ] End-to-end voice testing across all 4 platforms
- [ ] Add voice button to existing React UI (minimal disruption)
- [ ] Connect FastRTC service to existing ChatSidebar

**Afternoon Session (4h)**:
- [ ] Error handling and fallback responses for all platforms
- [ ] Voice feedback for successful/failed commands
- [ ] Basic accessibility features (clear voice responses)

**Deliverables**:
- All 4 platforms working with voice commands
- Voice integration with existing UI
- Robust error handling

### **WEEK 1 MILESTONE**: ✅ Basic voice control for Gmail, Calendar, Docs, and Telegram

---

### **Days 4-7: DEEP - Advanced Features for All Platforms**

#### **Day 4: Gmail + Calendar Advanced Features**
**Time**: 8 hours  
**Morning Session (4h)**:
- [ ] **Gmail Advanced**: Reply to emails, search with filters, email templates
- [ ] Voice commands: "reply to John's email", "search emails from Sarah about budget"

**Afternoon Session (4h)**:
- [ ] **Calendar Advanced**: Schedule meetings with attendees, set reminders, check availability
- [ ] Voice commands: "schedule meeting with John and Sarah tomorrow at 2pm"

**Deliverables**:
- Advanced Gmail email management
- Sophisticated calendar scheduling with multiple participants

#### **Day 5: Docs + Telegram Advanced Features**
**Time**: 8 hours  
**Morning Session (4h)**:
- [ ] **Docs Advanced**: Edit documents, format text, share documents, collaborative features
- [ ] Voice commands: "add bullet points", "format as heading", "share document with team"

**Afternoon Session (4h)**:
- [ ] **Telegram Advanced**: Manage groups, forward messages, media handling
- [ ] Voice commands: "forward this message to project group", "notify all team channels"

**Deliverables**:
- Professional document editing via voice
- Advanced team communication features

#### **Day 6: AI Intelligence + Voice Optimization**
**Time**: 8 hours  
**Morning Session (4h)**:
- [ ] Optimize voice recognition for domain-specific commands
- [ ] Accessibility improvements (adjustable speech rate, voice feedback)
- [ ] Context-aware command suggestions

**Afternoon Session (4h)**:
- [ ] Enhance LangChain agent with context memory
- [ ] Cross-platform workflow automation
- [ ] Smart command disambiguation

**Deliverables**:
- Optimized voice recognition accuracy
- Intelligent cross-platform workflows
- Enhanced accessibility features

#### **Day 7: Week 1 Polish + Performance**
**Time**: 8 hours  
- [ ] Bug fixes across all platforms
- [ ] Performance optimization (sub-2 second response times)
- [ ] Cross-platform integration testing
- [ ] Prepare system for UAT
- [ ] Documentation for user testing

**Deliverables**:
- Polished, stable system ready for user testing
- All 4 platforms with basic + advanced features
- Performance-optimized voice interface

---

### **WEEK 2: UAT + Refinement (Days 8-14)**

#### **Days 8-10: User Acceptance Testing**
**Focus**: Testing with accessibility users
**Tasks**:
- [ ] Recruit 3-5 users with hand mobility limitations
- [ ] Conduct structured user testing sessions
- [ ] Test all 4 platforms with real-world scenarios
- [ ] Collect usability feedback and performance metrics
- [ ] Document accessibility compliance

**Testing Scenarios**:
1. **Email Workflow**: Compose and send professional email via voice only
2. **Document Creation**: Create formatted meeting agenda using voice commands
3. **Calendar Management**: Schedule complex meeting with multiple participants
4. **Team Communication**: Send announcements and updates via Telegram
5. **Cross-Platform**: Execute workflow spanning multiple platforms

#### **Days 11-14: Refinement Based on UAT**
**Tasks**:
- [ ] Fix critical bugs identified during UAT
- [ ] Improve voice recognition accuracy based on user feedback
- [ ] Enhance accessibility features per user suggestions
- [ ] Polish UI/UX for better user experience
- [ ] Optimize performance and error handling
- [ ] Prepare final demonstration

**Deliverables**:
- User-validated system with improved accessibility
- Enhanced features based on real user feedback
- Demo-ready application

---

### **WEEK 3: Final Polish + Report Writing (Days 15-21)**

#### **Days 15-17: Final System Polish**
**Tasks**:
- [ ] Final bug fixes and performance optimization
- [ ] Comprehensive system testing
- [ ] Demo script preparation and practice
- [ ] Technical documentation completion
- [ ] User manual creation

#### **Days 18-21: FYP Report Writing**
**Tasks**:
- [ ] Write methodology section (implementation approach)
- [ ] Document technical architecture and design decisions
- [ ] Analyze user testing results and accessibility impact
- [ ] Write conclusions and future work recommendations
- [ ] Prepare final presentation materials

---

## 🎯 Core Voice Commands by Platform

### Gmail (Email Management)
**Basic Commands**:
- "Read my unread emails"
- "Compose email to [person] about [subject]"
- "Send the email"

**Advanced Commands**:
- "Reply to [person's] email: [message]"
- "Search for emails from [person] about [topic]"
- "Mark this email as important"
- "Schedule email to send at [time]"

### Google Docs (Document Management)
**Basic Commands**:
- "Create new document called [name]"
- "Read document content"
- "Add paragraph: [content]"

**Advanced Commands**:
- "Format this text as heading"
- "Create bullet points with [items]"
- "Share document with [email]"
- "Insert table with [rows] and [columns]"

### Google Calendar (Meeting Management)
**Basic Commands**:
- "What's on my calendar today?"
- "Create meeting [title] tomorrow at [time]"
- "Check my schedule for [day]"

**Advanced Commands**:
- "Schedule meeting with [person1] and [person2] [day] at [time]"
- "Set reminder for [event] 30 minutes before"
- "Move my [time] meeting to [new time]"
- "Block 2 hours for focused work on [day]"

### Telegram (Team Communication)
**Basic Commands**:
- "Send message to [person]: [message]"
- "Read my recent messages"
- "Tell the team: [announcement]"

**Advanced Commands**:
- "Forward this message to [group]"
- "Notify all project channels about [update]"
- "Send urgent message to [group]: [message]"
- "Create group announcement: [content]"

---

## 🧪 Testing & Evaluation Plan

### Success Metrics
- **Task Completion Rate**: >90% successful completion of voice commands
- **Time Efficiency**: <50% of traditional keyboard/mouse time for tasks
- **User Satisfaction**: >4/5 rating on usability scale
- **Accessibility Compliance**: WCAG 2.1 AA standard compliance
- **Voice Recognition Accuracy**: >95% command understanding
- **Response Time**: <2 seconds for voice command processing

### Platform-Specific Testing
**Gmail**: Email composition, reading, and management efficiency
**Calendar**: Meeting scheduling accuracy and calendar navigation
**Docs**: Document creation and editing capability
**Telegram**: Team communication effectiveness

---

## 📊 Academic Deliverables

### FYP Report Structure (40 pages)
1. **Introduction** (5 pages)
   - Problem statement: workplace accessibility challenges
   - Research objectives and innovation scope
   - FastRTC and voice interface significance

2. **Literature Review** (8 pages)
   - Accessibility technology research
   - Voice interface design principles
   - AI applications in assistive technology

3. **Methodology** (6 pages)
   - Broad-first development approach
   - FastRTC integration strategy
   - Multi-platform voice command design

4. **Implementation** (12 pages)
   - FastRTC voice pipeline architecture
   - LangChain agent design and command routing
   - Platform integration strategies (Gmail, Calendar, Docs, Telegram)
   - Accessibility feature implementation

5. **Evaluation** (8 pages)
   - User testing methodology with accessibility users
   - Performance metrics and voice recognition accuracy
   - Accessibility compliance assessment
   - Cross-platform workflow effectiveness

6. **Conclusion** (1 page)
   - Contribution to accessibility research
   - Impact on professional productivity for disabled users
   - Future work and scalability potential

---

## 🚀 Demo Preparation

### 5-Minute FYP Presentation Demo
1. **Opening** (30 seconds): Accessibility problem and voice solution
2. **Cross-Platform Voice Control** (3 minutes):
   - Gmail: Voice email composition and reading
   - Calendar: Meeting scheduling via voice
   - Docs: Document creation and editing
   - Telegram: Team communication
3. **Advanced Workflows** (1 minute): Cross-platform task automation
4. **Closing** (30 seconds): Accessibility impact and future potential

### Demo Script Focus
- **User Persona**: Professional with RSI/hand mobility limitations
- **Real Scenarios**: Actual workplace tasks requiring multi-platform coordination
- **Efficiency Demonstration**: Voice commands faster than traditional input methods
- **Accessibility Impact**: Clear improvement in workplace productivity

---

## 🛠️ Technical Implementation Details

### FastRTC Integration Architecture
```python
# Standalone FastRTC service
from fastrtc import Stream, ReplyOnPause, get_stt_model, get_tts_model
from langchain.agents import create_openai_tools_agent
from langchain_groq import ChatGroq

# Built-in models (local, free)
stt_model = get_stt_model()  # Moonshine
tts_model = get_tts_model()  # Kokoro

# LangChain agent with all platform tools
agent_tools = [
    GmailTool(),      # Email management
    CalendarTool(),   # Meeting scheduling  
    DocsTool(),       # Document creation
    TelegramTool()    # Team communication
]

def voice_handler(audio):
    # 1. Transcribe with FastRTC's built-in STT
    transcript = stt_model.stt(audio)
    
    # 2. Route command through LangChain agent
    response = agent.run(transcript)
    
    # 3. Convert response to speech and stream
    for chunk in tts_model.stream_tts_sync(response):
        yield chunk

# FastRTC handles all WebRTC complexity
stream = Stream(ReplyOnPause(voice_handler))
stream.ui.launch()  # Or integrate with existing FastAPI
```

### Platform Integration Strategy
- **Minimal UI Disruption**: Single voice button added to existing React interface
- **Microservice Approach**: FastRTC service communicates with existing FastAPI backend
- **API Reuse**: Leverage existing Gmail service, extend with Calendar/Docs/Telegram
- **Error Handling**: Voice feedback for failed commands, fallback to existing UI

---

## 📈 Success Criteria & Risk Mitigation

### Technical Success Criteria
- ✅ All 4 platforms integrated with voice control
- ✅ Voice recognition accuracy >95%
- ✅ Response time <2 seconds
- ✅ Cross-platform workflows functional
- ✅ Accessibility features implemented

### Academic Success Criteria
- ✅ User validation with disability community
- ✅ Measurable productivity improvement
- ✅ Technical innovation demonstrated
- ✅ Comprehensive evaluation completed
- ✅ Contribution to accessibility research documented

### Risk Mitigation
- **Technical Risk**: FastRTC fallback to existing voice components if issues arise
- **Timeline Risk**: Broad-first approach ensures core functionality by Day 3
- **User Testing Risk**: Multiple accessibility user recruitment channels
- **Platform Risk**: Direct API integration reduces dependency complexity

---

## 📞 Updated Resource Requirements

### Development Tools
- **Voice Pipeline**: FastRTC (handles WebRTC, STT, TTS complexity)
- **LLM Service**: Groq API (free tier, fast responses)
- **Platform APIs**: Gmail, Google Calendar, Google Docs, Telegram Bot
- **Development**: Existing React + FastAPI setup

### API Quotas & Costs
- **Groq**: Free tier (sufficient for development and testing)
- **FastRTC**: Built-in local models (Moonshine STT + Kokoro TTS)
- **Google APIs**: Free tier limits adequate for testing
- **Telegram Bot**: Free for standard usage

---

**Project Start Date**: [Current Date]  
**Week 1 Completion**: [Start Date + 7 days] - All platforms basic + advanced features  
**Week 2 Completion**: [Start Date + 14 days] - UAT completed, system refined  
**Week 3 Completion**: [Start Date + 21 days] - Report completed, demo ready  

---

*This updated project plan reflects a strategic broad-first approach, ensuring all four platforms have working voice control by Day 3, with advanced features and polish in the remaining time. The FastRTC integration simplifies the technical complexity while delivering professional-grade voice interface capabilities.*