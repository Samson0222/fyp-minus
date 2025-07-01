import React, { useState, useCallback } from 'react';
import { Mic, MicOff, Volume2, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useVoiceRecording } from '@/hooks/useVoiceRecording';
import { useToast } from '@/hooks/use-toast';

interface VoiceInterfaceProps {
  onTranscription?: (text: string) => void;
  onVoiceCommand?: (command: string) => void;
  disabled?: boolean;
  className?: string;
}

export const VoiceInterface: React.FC<VoiceInterfaceProps> = ({
  onTranscription,
  onVoiceCommand,
  disabled = false,
  className = '',
}) => {
  const [transcribedText, setTranscribedText] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const { toast } = useToast();
  const {
    isRecording,
    isLoading,
    audioLevel,
    error,
    startRecording,
    stopRecording,
    clearError,
  } = useVoiceRecording();

  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
      setTranscribedText('');
      setResponse('');
      clearError();
    } catch (err) {
      console.error('Failed to start recording:', err);
      toast({
        title: "Recording Error",
        description: "Failed to start voice recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  }, [startRecording, clearError, toast]);

  const handleStopRecording = useCallback(async () => {
    try {
      setIsTranscribing(true);
      const audioBlob = await stopRecording();
      
      if (!audioBlob) {
        throw new Error('No audio data captured');
      }

      // Send audio to backend for transcription
      const formData = new FormData();
      formData.append('audio_file', audioBlob, 'recording.webm');

      console.log('Sending transcription request...');
      const response = await fetch('http://localhost:8000/api/v1/audio/transcribe', {
        method: 'POST',
        body: formData,
      });

      console.log('Transcription response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Transcription response error:', errorText);
        throw new Error(`Transcription failed: ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Transcription response data:', data);
      const transcription = data.transcribed_text;
      console.log('Setting transcribed text:', transcription);
      
      setTranscribedText(transcription);
      onTranscription?.(transcription);
      console.log('Transcription set successfully');

      // If transcription looks like a command, process it
      if (transcription.trim()) {
        await handleVoiceCommand(transcription);
      }

    } catch (err) {
      console.error('Transcription error:', err);
      toast({
        title: "Transcription Error",
        description: "Failed to transcribe audio. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsTranscribing(false);
    }
  }, [stopRecording, onTranscription, toast]);

  const handleVoiceCommand = useCallback(async (command: string) => {
    try {
      setIsProcessing(true);
      
      const response = await fetch('http://localhost:8000/api/v1/chat/text-message', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: command,
          context: 'voice_command',
          platform_context: {
            timestamp: new Date().toISOString(),
            interface: 'voice',
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Command processing failed: ${response.statusText}`);
      }

      const data = await response.json();
      setResponse(data.reply);
      onVoiceCommand?.(command);

      // Play TTS response (placeholder for now)
      if (data.reply) {
        toast({
          title: "Voice Assistant",
          description: data.reply,
        });
      }

    } catch (err) {
      console.error('Command processing error:', err);
      toast({
        title: "Processing Error",
        description: "Failed to process voice command. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onVoiceCommand, toast]);

  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  }, [isRecording, handleStartRecording, handleStopRecording]);

  const getButtonState = () => {
    if (isLoading) return { icon: Loader2, color: 'bg-yellow-500', spin: true };
    if (isRecording) return { icon: MicOff, color: 'bg-red-500', spin: false };
    return { icon: Mic, color: 'bg-blue-500 hover:bg-blue-600', spin: false };
  };

  const { icon: ButtonIcon, color: buttonColor, spin } = getButtonState();

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={clearError}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Voice Controls */}
      <Card className="p-6">
        <div className="flex flex-col items-center space-y-4">
          {/* Recording Button */}
          <Button
            size="lg"
            className={`w-20 h-20 rounded-full ${buttonColor} text-white transition-all duration-200 ${
              isRecording ? 'scale-110 shadow-lg' : ''
            }`}
            onClick={handleToggleRecording}
            disabled={disabled || isTranscribing || isProcessing}
            aria-label={isRecording ? 'Stop recording' : 'Start recording'}
          >
            <ButtonIcon 
              className={`w-8 h-8 ${spin ? 'animate-spin' : ''}`} 
            />
          </Button>

          {/* Audio Level Indicator */}
          {isRecording && (
            <div className="w-full max-w-xs">
              <div className="text-sm text-center text-gray-600 mb-2">
                Audio Level
              </div>
              <Progress 
                value={audioLevel * 100} 
                className="w-full h-2"
              />
            </div>
          )}

          {/* Status Text */}
          <div className="text-center">
            {isLoading && (
              <p className="text-sm text-gray-600">Initializing microphone...</p>
            )}
            {isRecording && (
              <p className="text-sm text-red-600 font-medium">
                🔴 Recording... (Click to stop)
              </p>
            )}
            {isTranscribing && (
              <p className="text-sm text-blue-600 font-medium">
                <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                Transcribing audio...
              </p>
            )}
            {isProcessing && (
              <p className="text-sm text-green-600 font-medium">
                <Loader2 className="inline w-4 h-4 mr-2 animate-spin" />
                Processing command...
              </p>
            )}
            {!isRecording && !isLoading && !isTranscribing && !isProcessing && (
              <p className="text-sm text-gray-600">
                Click the microphone to start voice recording
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Transcription Display */}
      {transcribedText && (
        <Card className="p-4">
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-700">
              You said:
            </h3>
            <p className="text-gray-900 bg-gray-50 p-3 rounded border">
              "{transcribedText}"
            </p>
          </div>
        </Card>
      )}

      {/* Response Display */}
      {response && (
        <Card className="p-4">
          <div className="space-y-2">
            <h3 className="font-medium text-sm text-gray-700 flex items-center">
              <Volume2 className="w-4 h-4 mr-2" />
              Assistant Response:
            </h3>
            <p className="text-gray-900 bg-blue-50 p-3 rounded border-l-4 border-blue-500">
              {response}
            </p>
          </div>
        </Card>
      )}

      {/* Voice Commands Help */}
      <Card className="p-4 bg-gray-50">
        <h3 className="font-medium text-sm text-gray-700 mb-2">
          Try saying:
        </h3>
        <div className="text-xs text-gray-600 space-y-1">
          <p>• "Read my emails"</p>
          <p>• "Create a new document"</p>
          <p>• "Schedule a meeting for tomorrow"</p>
          <p>• "Send a message to my team"</p>
        </div>
      </Card>
    </div>
  );
}; 