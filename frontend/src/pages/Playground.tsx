import React, { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import Layout from "@/components/layout/Layout";
import TranscriptArea from "@/components/ai/TranscriptArea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceInterface } from "@/components/voice/VoiceInterface";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai" | "system";
  timestamp: Date;
}

const Playground = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const { toast } = useToast();

  const handleSendMessage = (text: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      text,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Simulate AI response
    setTimeout(() => {
      const responseText = getAIResponse(text);
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        text: responseText,
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);
    }, 1000);
  };

  const handleToggleListening = () => {
    setIsListening((prev) => !prev);
    if (!isListening) {
      toast({
        title: "Listening...",
        description: "Say something or click again to stop.",
      });

      // Simulate stopping the recording after 5 seconds
      setTimeout(() => {
        if (isListening) {
          setIsListening(false);
          handleSendMessage("This is a simulated voice message");
        }
      }, 5000);
    } else {
      setIsListening(false);
    }
  };

  const handleTranscription = (text: string) => {
    console.log('Transcribed text:', text);
    // Add transcribed text as a message
    if (text.trim()) {
      handleSendMessage(text);
    }
  };

  const handleVoiceCommand = (command: string) => {
    console.log('Voice command processed:', command);
  };

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Voice Assistant Playground
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Test and experiment with voice features. This is your testing ground for speech-to-text,
            voice commands, and AI interactions.
          </p>
        </div>

        {/* Voice Interface */}
        <div className="max-w-2xl mx-auto">
          <Card className="p-6">
            <CardHeader>
              <CardTitle className="text-2xl font-semibold text-gray-800 text-center">
                Voice Control Testing
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VoiceInterface
                onTranscription={handleTranscription}
                onVoiceCommand={handleVoiceCommand}
              />
            </CardContent>
          </Card>
        </div>

        {/* Message History */}
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>Conversation History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {messages.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">
                    No messages yet. Try using the voice interface above!
                  </p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.sender === "user" ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                          message.sender === "user"
                            ? "bg-blue-500 text-white"
                            : message.sender === "ai"
                            ? "bg-gray-200 text-gray-800"
                            : "bg-yellow-100 text-yellow-800"
                        }`}
                      >
                        <p className="text-sm">{message.text}</p>
                        <p className="text-xs opacity-70 mt-1">
                          {message.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Features Overview */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
          <Card className="p-4 text-center">
            <div className="text-2xl mb-2">🎤</div>
            <h3 className="font-semibold">Speech-to-Text</h3>
            <p className="text-sm text-gray-600 mt-2">
              Local Whisper model for accurate transcription
            </p>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="text-2xl mb-2">🧠</div>
            <h3 className="font-semibold">AI Processing</h3>
            <p className="text-sm text-gray-600 mt-2">
              Intelligent command understanding and responses
            </p>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="text-2xl mb-2">⚡</div>
            <h3 className="font-semibold">Real-time</h3>
            <p className="text-sm text-gray-600 mt-2">
              Instant voice processing and feedback
            </p>
          </Card>
          
          <Card className="p-4 text-center">
            <div className="text-2xl mb-2">🔒</div>
            <h3 className="font-semibold">Privacy-First</h3>
            <p className="text-sm text-gray-600 mt-2">
              All voice processing happens locally
            </p>
          </Card>
        </div>

        {/* Testing Instructions */}
        <Card className="p-6 bg-blue-50">
          <h3 className="text-xl font-semibold text-blue-900 mb-3">
            How to Test Voice Features
          </h3>
          <div className="space-y-2 text-blue-800">
            <p>1. <strong>Click the microphone</strong> button above to start voice recording</p>
            <p>2. <strong>Speak clearly</strong> - try commands like:</p>
            <ul className="ml-6 list-disc space-y-1">
              <li>"Read my emails"</li>
              <li>"Create a document"</li>
              <li>"Schedule a meeting"</li>
              <li>"Send a message to the team"</li>
            </ul>
            <p>3. <strong>Click again</strong> to stop recording and process your command</p>
            <p>4. <strong>View results</strong> - see transcription and AI responses below</p>
          </div>
        </Card>

        {/* Technical Information */}
        <Card className="p-6 bg-green-50">
          <h3 className="text-xl font-semibold text-green-900 mb-3">
            Technical Details
          </h3>
          <div className="text-green-800 space-y-2">
            <p><strong>Speech Recognition:</strong> OpenAI Whisper (local model)</p>
            <p><strong>Backend:</strong> FastAPI with real-time audio processing</p>
            <p><strong>Privacy:</strong> All audio processing happens on your device</p>
            <p><strong>Accessibility:</strong> Designed for users with hand mobility limitations</p>
          </div>
        </Card>
      </div>
    </Layout>
  );
};

// Helper function to simulate AI responses
const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  
  if (lowerMessage.includes("hello") || lowerMessage.includes("hi")) {
    return "Hello! I'm ready to help you with professional tasks. What would you like to do?";
  }
  
  if (lowerMessage.includes("email") || lowerMessage.includes("mail")) {
    return "I can help with email management. Gmail integration is coming soon! For now, I'm processing your email-related request.";
  }
  
  if (lowerMessage.includes("document") || lowerMessage.includes("doc")) {
    return "I'll assist with document management. Google Docs integration is in development. I understand you want to work with documents.";
  }
  
  if (lowerMessage.includes("meeting") || lowerMessage.includes("schedule") || lowerMessage.includes("calendar")) {
    return "I can help schedule meetings and manage your calendar. Calendar integration is coming soon! I've noted your scheduling request.";
  }
  
  if (lowerMessage.includes("message") || lowerMessage.includes("telegram") || lowerMessage.includes("team")) {
    return "I can send messages via Telegram and other platforms. Team communication features are being developed. I understand your messaging needs.";
  }
  
  if (lowerMessage.includes("help") || lowerMessage.includes("can you")) {
    return "I'm here to help with professional communication and task management. I can assist with emails, documents, scheduling, and team communication through voice commands.";
  }
  
  return `I heard: "${userMessage}". I'm learning to understand and execute professional tasks through voice commands. How would you like me to help you with this?`;
};

export default Playground; 