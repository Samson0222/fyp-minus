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
2. **Technical Innovation**: Integrate cutting-edge voice recognition, natural language processing, and AI agent technologies
3. **Accessibility Focus**: Create an intuitive, hands-free interface for professional task management
4. **Platform Integration**: Seamlessly connect with major productivity platforms (Gmail, Google Docs, Google Calendar, Telegram)
5. **User Validation**: Conduct User Acceptance Testing (UAT) with target accessibility users

---

## 🏗️ Technology Stack

### **Core Infrastructure**
- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui
- **Backend**: FastAPI + Python + LangChain
- **Database**: Supabase (PostgreSQL + Authentication)
- **Voice Pipeline**: FastRTC with Moonshine STT + Kokoro TTS

### **🧠 LLM Strategy (Budget-Optimized)**
**Primary Choice**: Google Gemma 3n (FREE Tier)
- ✅ **Cost**: Completely FREE - saves entire RM300-500 budget
- ✅ **Limits**: 30 RPM, 15,000 TPM, 14,400 RPD
- ✅ **Benefits**: Google ecosystem consistency, academic credibility
- ✅ **Integration**: Direct Google AI API access

**Upgrade Path**: Qwen3 32B (If Enhanced Performance Needed)
- 💰 **Cost**: $0.10/M input, $0.30/M output (~RM50-80 total)
- 🚀 **Performance**: 32.8B parameters, advanced reasoning
- ⚡ **Speed**: Available on Groq (~400 T/s) or OpenRouter
- 🎯 **Use Case**: Switch during UAT if Gemma 3n insufficient

**Emergency Fallback**: DeepSeek R1 Distill Qwen 32B
- 💰 **Cost**: $0.30/M tokens (~RM40-70 total)
- 🧠 **Reasoning**: Distilled from DeepSeek R1 capabilities
- 🔧 **Features**: Tool calling, JSON mode support

### **Platform Integrations**
- **Gmail**: Gmail API + OAuth2 authentication
- **Google Calendar**: Calendar API + event management
- **Google Docs**: Docs API + document operations
- **Telegram**: Telegram Bot API + message handling

---

## 📅 3-Week Development Timeline

### **Week 1: Broad Development - All 4 Platforms (Days 1-7)**
**Strategy**: Build basic functionality across all platforms simultaneously

#### **Day 1: Foundation + Gmail + Calendar**
**Morning (4h):**
- ✅ FastRTC setup + LangChain agent foundation
- ✅ **Gemma 3n integration** (Google AI API)
- ✅ Voice pipeline test (record → transcribe → respond)

**Afternoon (4h):**
- ✅ Gmail: read unread emails, basic compose
- ✅ Calendar: check today's schedule, create simple event

#### **Day 2: Docs + Telegram + Agent Router**
**Morning (4h):**
- ✅ Google Docs: create document, read document content
- ✅ Telegram: send message, read recent messages

**Afternoon (4h):**
- ✅ **LangChain agent with Gemma 3n** for all 4 platforms
- ✅ Command routing: "read emails" → Gmail, "check schedule" → Calendar

#### **Day 3: Integration + Voice Interface**
**Morning (4h):**
- ✅ Test end-to-end: voice input → Gemma 3n → platform action → voice response
- ✅ **Performance evaluation**: Check if Gemma 3n meets requirements

**Afternoon (4h):**
- ✅ Voice UI integration with existing React frontend
- ✅ Basic error handling and fallback responses

#### **Day 4: Basic Commands All Platforms**
**Morning (4h):**
- ✅ Gmail: reply to emails, search with keywords
- ✅ Calendar: schedule meetings, set reminders

**Afternoon (4h):**
- ✅ Docs: edit documents, format text
- ✅ Telegram: manage groups, forward messages

#### **Day 5: Cross-Platform Testing**
**Morning (4h):**
- ✅ Test voice commands across all 4 platforms
- ✅ **LLM Performance Check**: Evaluate if upgrade to Qwen3 32B needed

**Afternoon (4h):**
- ✅ Bug fixes and optimization
- ✅ **Decision Point**: Stick with Gemma 3n or upgrade to Qwen3 32B

#### **Day 6: Voice Optimization + Intelligence**
**Morning (4h):**
- ✅ Voice recognition optimization for domain commands
- ✅ **LLM Enhancement**: Implement upgrade if decided (Qwen3 32B setup)

**Afternoon (4h):**
- ✅ Context memory and smart command suggestions
- ✅ Accessibility features refinement

#### **Day 7: Week 1 Polish**
**Full Day (8h):**
- ✅ End-to-end testing across all platforms
- ✅ Performance optimization and bug fixes
- ✅ **Final LLM configuration** for UAT phase
- ✅ Prepare demonstration for UAT users

---

### **Week 2: UAT + Deep Features + Refinement (Days 8-14)**
**Strategy**: User testing with accessibility users + advanced features

#### **LLM Strategy for Week 2:**
- **Continue with chosen model** from Week 1 (Gemma 3n or Qwen3 32B)
- **Monitor performance** during UAT sessions
- **Ready to upgrade** to Qwen3 32B if user feedback demands higher intelligence

#### **Day 8-9: User Acceptance Testing Setup**
- ✅ Recruit accessibility users for testing
- ✅ Set up controlled testing environment
- ✅ **LLM monitoring**: Track response quality and user satisfaction

#### **Day 10-11: Intensive UAT Sessions**
- ✅ Conduct 6-8 hour daily UAT sessions
- ✅ **Performance evaluation**: Real user interaction with current LLM
- ✅ Gather detailed user feedback on voice assistant intelligence

#### **Day 12-13: Advanced Features Based on Feedback**
- ✅ **LLM Upgrade Decision**: Switch to Qwen3 32B if users need more intelligence
- ✅ Implement advanced Gmail features (templates, filters)
- ✅ Enhanced Calendar features (attendee management, availability)

#### **Day 14: Week 2 Integration**
- ✅ **Final LLM optimization** based on UAT results
- ✅ Integration of all UAT feedback
- ✅ Performance optimization and accessibility improvements

---

### **Week 3: Final Polish + FYP Report (Days 15-21)**

#### **Day 15-16: Final System Polish**
- ✅ **LLM fine-tuning**: Optimize prompts and response quality
- ✅ Final bug fixes and performance optimization
- ✅ Documentation and code cleanup

#### **Day 17-21: FYP Report Writing**
- ✅ **Methodology**: Document LLM selection process and rationale
- ✅ **Implementation**: Technical details including cost-effective LLM strategy
- ✅ **Testing Results**: UAT findings and LLM performance analysis
- ✅ **Analysis**: Cost analysis showing budget savings with Gemma 3n approach
- ✅ **Conclusion**: Demonstration preparation

---

## 💰 Budget Allocation

### **LLM Costs (Optimized Strategy)**
- **Development Phase**: RM0 (Gemma 3n FREE)
- **UAT Phase**: RM0-80 (Gemma 3n or upgrade to Qwen3 32B)
- **Final Polish**: RM0-30 (minimal additional usage)
- **Total LLM Cost**: RM0-110 (saving RM190-500 from original budget!)

### **Other Potential Costs**
- **API Usage**: Gmail/Calendar/Docs APIs (FREE tiers)
- **Hosting**: Supabase (FREE tier)
- **FastRTC**: Open source (FREE)
- **Total Project Cost**: RM0-110 (maximum)

---

## 🎯 Success Metrics

### **Technical Metrics**
- ✅ Voice recognition accuracy >90%
- ✅ **LLM response relevance** >85% (measured during UAT)
- ✅ Platform integration success rate >95%
- ✅ End-to-end response time <3 seconds

### **User Experience Metrics**
- ✅ User satisfaction score >4/5
- ✅ **LLM intelligence rating** >4/5 from accessibility users
- ✅ Task completion rate >90%
- ✅ Accessibility compliance score >95%

### **Academic Metrics**
- ✅ **Cost-effectiveness demonstration** (Gemma 3n vs premium models)
- ✅ Technical innovation in accessibility
- ✅ Comprehensive UAT with target users
- ✅ **LLM strategy optimization** for academic constraints

---

## 🚀 Innovation Highlights

1. **Budget-Optimized LLM Strategy**: Demonstrating enterprise-quality AI assistant with minimal costs
2. **Multi-Platform Voice Control**: Seamless integration across 4 major productivity platforms
3. **Accessibility-First Design**: Purpose-built for users with hand mobility limitations
4. **Real-Time Voice Processing**: Sub-second response times with FastRTC
5. **Academic Rigor**: Comprehensive UAT with systematic LLM performance evaluation

---

## 📝 Deliverables

### **Technical Deliverables**
- ✅ Complete voice-controlled AI assistant application
- ✅ **LLM integration documentation** (Gemma 3n implementation + upgrade strategy)
- ✅ Multi-platform API integrations (Gmail, Calendar, Docs, Telegram)
- ✅ Comprehensive testing suite and UAT results

### **Academic Deliverables**
- ✅ **FYP Report**: Including cost-effective LLM strategy analysis
- ✅ Technical documentation and system architecture
- ✅ **LLM Performance Analysis**: Comparing Gemma 3n vs alternatives
- ✅ UAT findings and accessibility impact assessment
- ✅ Live demonstration and code repository

---

**Last Updated**: January 2025  
**LLM Strategy**: Gemma 3n (Primary) → Qwen3 32B (Upgrade) → DeepSeek R1 Distill (Fallback)  
**Budget Status**: Optimized for RM0-110 total cost (saving RM190-390!)