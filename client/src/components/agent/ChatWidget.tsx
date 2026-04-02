import { useState } from "react";
import { MessageCircle } from "lucide-react";
import ChatPanel from "./ChatPanel";

interface ChatWidgetProps {
  // Optional: pre-fill a message (used by "Ask Sal" on menu cards)
  initialMessage?: string;
  onClearInitialMessage?: () => void;
}

export default function ChatWidget({ initialMessage, onClearInitialMessage }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  function openChat() {
    setIsOpen(true);
    setIsMinimized(false);
  }

  function closeChat() {
    setIsOpen(false);
    onClearInitialMessage?.();
  }

  function minimizeChat() {
    setIsMinimized(true);
  }

  return (
    <>
      {/* Chat panel — fixed bottom-right, slides up */}
      {isOpen && !isMinimized && (
        <div className="fixed bottom-24 right-6 z-50 w-[calc(100vw-3rem)] sm:w-96 h-[600px] max-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl overflow-hidden border border-gray-200 transition-all">
          <ChatPanel
            onClose={closeChat}
            onMinimize={minimizeChat}
            initialMessage={initialMessage}
          />
        </div>
      )}

      {/* Floating action button */}
      <button
        onClick={isOpen && !isMinimized ? minimizeChat : openChat}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-brand text-white px-5 py-3 rounded-full shadow-lg hover:bg-brand-dark transition-all hover:scale-105 active:scale-95"
        aria-label="Open Sal AI assistant"
      >
        <MessageCircle size={20} />
        <span className="font-medium text-sm">Ask Sal</span>
        {isMinimized && (
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white" />
        )}
      </button>
    </>
  );
}
