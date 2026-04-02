"use client";

import { useState, useRef, useCallback } from "react";

interface UseVoiceInputOptions {
  onTranscript: (text: string) => void;
}

// Web Speech API hook — wraps the browser's built-in speech recognition.
// No external API needed. Works in Chrome and Safari.
export function useVoiceInput({ onTranscript }: UseVoiceInputOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const isSupported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const startRecording = useCallback(() => {
    if (!isSupported) {
      setError("Voice input is not supported in this browser. Please use Chrome or Safari.");
      return;
    }

    // Create a new recognition instance
    const SpeechRecognitionAPI =
      window.SpeechRecognition ?? (window as unknown as { webkitSpeechRecognition: typeof SpeechRecognition }).webkitSpeechRecognition;
    const recognition = new SpeechRecognitionAPI();

    recognition.lang = "en-US";
    recognition.continuous = false;    // Stop after first pause
    recognition.interimResults = true; // Show live transcript as user speaks

    recognition.onstart = () => {
      setIsRecording(true);
      setError(null);
      setInterimTranscript("");
    };

    recognition.onresult = (event) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      setInterimTranscript(interim);

      if (final) {
        // Final transcript ready — call the callback after a short delay
        // so the UI has time to show the recognized text
        setTimeout(() => {
          onTranscript(final.trim());
          setInterimTranscript("");
        }, 300);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed") {
        setError("Microphone access denied. Please allow microphone in your browser settings.");
      } else if (event.error !== "no-speech") {
        setError(`Voice error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimTranscript("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isSupported, onTranscript]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  return { isRecording, interimTranscript, startRecording, stopRecording, error, isSupported };
}
