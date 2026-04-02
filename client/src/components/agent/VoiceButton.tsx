import { Mic, MicOff } from "lucide-react";
import { cn } from "../../lib/utils";

interface VoiceButtonProps {
  isRecording: boolean;
  isSupported: boolean;
  onClick: () => void;
}

export default function VoiceButton({ isRecording, isSupported, onClick }: VoiceButtonProps) {
  if (!isSupported) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "p-2 rounded-lg transition-colors shrink-0",
        isRecording
          ? "bg-red-500 text-white animate-pulse"
          : "text-gray-400 hover:text-brand hover:bg-gray-100"
      )}
      aria-label={isRecording ? "Stop recording" : "Start voice input"}
      title={isRecording ? "Stop recording" : "Speak your order"}
    >
      {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
    </button>
  );
}
