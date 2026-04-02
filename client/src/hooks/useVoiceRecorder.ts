import { useState, useRef, useCallback } from "react";

interface UseVoiceRecorderOptions {
  // Called when the user stops recording and a blob is available
  onAudioReady: (blob: Blob) => void;
}

// Records audio using the MediaRecorder API (replaces Web Speech API).
// MediaRecorder works in all modern browsers and records real audio data
// that we can POST to our server for Gemini to transcribe.
export function useVoiceRecorder({ onAudioReady }: UseVoiceRecorderOptions) {
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // MediaRecorder is supported in all modern browsers.
  // We check at call time rather than at module load to avoid SSR issues.
  const isSupported =
    typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined";

  const startRecording = useCallback(async () => {
    if (!isSupported) {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setError(null);
      chunksRef.current = [];

      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Pick the best supported MIME type
      // Chrome supports webm/opus, Firefox supports ogg/opus, Safari supports mp4
      const mimeType = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
      ].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        // Combine all chunks into a single Blob
        const blob = new Blob(chunksRef.current, {
          type: mimeType || "audio/webm",
        });

        // Stop all microphone tracks to release the hardware
        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        onAudioReady(blob);
      };

      recorder.onerror = () => {
        setError("Recording failed. Please try again.");
        setIsRecording(false);
      };

      // Collect data in 250ms chunks so we don't lose any audio
      recorder.start(250);
      setIsRecording(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotAllowedError") {
        setError("Microphone access denied. Please allow microphone in your browser settings.");
      } else {
        setError("Could not access microphone. Please check your settings.");
      }
    }
  }, [isSupported, onAudioReady]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  return { isRecording, startRecording, stopRecording, error, isSupported };
}
