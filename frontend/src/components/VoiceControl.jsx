import React, { useState, useEffect, useCallback } from "react";
import vapiService from "../services/vapiService";

const VoiceControl = ({ onVoiceMessage, disabled = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [error, setError] = useState(null);

  // Initialize VAPI service
  useEffect(() => {
    vapiService.initialize();

    // Set up callback for voice messages
    vapiService.onMessage((transcript) => {
      if (onVoiceMessage && transcript) {
        onVoiceMessage(transcript);
      }
    });

    // Clean up on unmount
    return () => {
      vapiService.cleanup();
    };
  }, [onVoiceMessage]);

  // Set up event listeners
  useEffect(() => {
    const handleSpeechStart = () => {
      setIsSpeaking(true);
    };

    const handleSpeechEnd = () => {
      setIsSpeaking(false);
    };

    const handleCallStart = () => {
      setIsListening(true);
      setError(null);
    };

    const handleCallEnd = () => {
      setIsListening(false);
    };

    const handleVolumeLevel = (volume) => {
      setVolumeLevel(volume);
    };

    const handleError = (err) => {
      console.error("VAPI error:", err);
      setError("Voice service error. Please try again.");
      setIsListening(false);
    };

    // Add event listeners
    vapiService.addEventListener("speech-start", handleSpeechStart);
    vapiService.addEventListener("speech-end", handleSpeechEnd);
    vapiService.addEventListener("call-start", handleCallStart);
    vapiService.addEventListener("call-end", handleCallEnd);
    vapiService.addEventListener("volume-level", handleVolumeLevel);
    vapiService.addEventListener("error", handleError);

    // Clean up event listeners
    return () => {
      vapiService.removeEventListener("speech-start", handleSpeechStart);
      vapiService.removeEventListener("speech-end", handleSpeechEnd);
      vapiService.removeEventListener("call-start", handleCallStart);
      vapiService.removeEventListener("call-end", handleCallEnd);
      vapiService.removeEventListener("volume-level", handleVolumeLevel);
      vapiService.removeEventListener("error", handleError);
    };
  }, []);

  // Toggle voice listening
  const toggleVoice = useCallback(() => {
    if (disabled) return;

    if (isListening) {
      vapiService.stopVoiceSession();
    } else {
      vapiService.startVoiceSession();
    }
  }, [isListening, disabled]);

  // Calculate the size of the microphone button based on volume level
  const getMicSize = () => {
    // Base size plus a factor of the volume level
    const baseSize = 40;
    const volumeFactor = Math.min(volumeLevel * 20, 20); // Cap the growth
    return baseSize + volumeFactor;
  };

  return (
    <div className="flex flex-col items-center">
      {error && (
        <div className="text-red-500 text-xs mb-2">{error}</div>
      )}
      
      <button
        onClick={toggleVoice}
        disabled={disabled}
        className={`
          relative rounded-full p-2 transition-all duration-200
          ${isListening 
            ? "bg-red-500 hover:bg-red-600" 
            : "bg-blue-500 hover:bg-blue-600"}
          ${disabled ? "opacity-50 cursor-not-allowed" : ""}
        `}
        style={{ 
          width: `${getMicSize()}px`, 
          height: `${getMicSize()}px` 
        }}
        aria-label={isListening ? "Stop listening" : "Start listening"}
      >
        {/* Microphone icon */}
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          viewBox="0 0 24 24" 
          fill="currentColor" 
          className="w-6 h-6 text-white"
        >
          <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
          <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.751 6.751 0 01-6 6.709v2.291h3a.75.75 0 010 1.5h-7.5a.75.75 0 010-1.5h3v-2.291a6.751 6.751 0 01-6-6.709v-1.5A.75.75 0 016 10.5z" />
        </svg>
        
        {/* Pulsing animation when speaking */}
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full bg-blue-400 opacity-75 animate-ping"></span>
        )}
      </button>
      
      <div className="text-xs mt-1 text-gray-600 dark:text-gray-400">
        {isListening ? "Tap to stop" : "Tap to speak"}
      </div>
    </div>
  );
};

export default VoiceControl;
