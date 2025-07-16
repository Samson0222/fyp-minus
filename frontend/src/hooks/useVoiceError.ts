import { useState, useCallback } from 'react';
import { toast } from '@/components/ui/use-toast';

export interface VoiceError {
  type: 'permission' | 'network' | 'transcription' | 'synthesis' | 'unknown';
  message: string;
  details?: string;
}

export const useVoiceError = () => {
  const [error, setError] = useState<VoiceError | null>(null);

  const handleError = useCallback((error: unknown, context: string = 'Voice operation') => {
    let voiceError: VoiceError;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      if (message.includes('permission') || message.includes('microphone')) {
        voiceError = {
          type: 'permission',
          message: 'Microphone access denied. Please check your browser permissions.',
          details: error.message
        };
      } else if (message.includes('network') || message.includes('fetch')) {
        voiceError = {
          type: 'network',
          message: 'Network error. Please check your connection and try again.',
          details: error.message
        };
      } else if (message.includes('transcription') || message.includes('stt')) {
        voiceError = {
          type: 'transcription',
          message: 'Failed to transcribe audio. Please try speaking again.',
          details: error.message
        };
      } else if (message.includes('synthesis') || message.includes('tts')) {
        voiceError = {
          type: 'synthesis',
          message: 'Failed to generate speech. Continuing with text only.',
          details: error.message
        };
      } else {
        voiceError = {
          type: 'unknown',
          message: `${context} failed. Please try again.`,
          details: error.message
        };
      }
    } else {
      voiceError = {
        type: 'unknown',
        message: `${context} failed. Please try again.`,
        details: String(error)
      };
    }

    setError(voiceError);
    
    // Only show toast for critical errors (not TTS failures)
    if (voiceError.type !== 'synthesis') {
      toast({
        title: "Voice Error",
        description: voiceError.message,
        variant: "destructive",
        duration: 5000,
      });
    }

    console.error(`Voice Error (${voiceError.type}):`, voiceError.message, voiceError.details);
    
    return voiceError;
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    error,
    handleError,
    clearError
  };
}; 