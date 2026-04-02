"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "ai/react";
import { Send, X, Minus } from "lucide-react";
import MessageBubble from "./MessageBubble";
import VoiceButton from "./VoiceButton";
import ImageUpload from "./ImageUpload";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useCartStore } from "@/store/cart";
import { toast } from "sonner";

// Suggestion chips shown when the chat is first opened.
// These make the demo immediately usable and impressive.
const SUGGESTIONS = [
  "Recommend a pizza for a group of 6 🍕",
  "What are your vegetarian options?",
  "What's on special today?",
  "I have a photo of a pizza I love 📷",
];

interface ChatPanelProps {
  onClose: () => void;
  onMinimize: () => void;
  initialMessage?: string;
}

export default function ChatPanel({ onClose, onMinimize, initialMessage }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addItem = useCartStore((state) => state.addItem);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // pendingImage holds an image to be sent with the NEXT message.
  // We store it separately because useChat's messages are plain text.
  // The image is sent as `imageData` in the request body and injected
  // into the messages array server-side.
  const [pendingImage, setPendingImage] = useState<{ base64: string; mediaType: string } | null>(null);

  // useChat is the Vercel AI SDK hook. It manages:
  // - The messages array (conversation history)
  // - Streaming the response from /api/agent token by token
  // - The input field value
  // - isLoading state
  const { messages, input, handleInputChange, handleSubmit, isLoading, setInput, append } =
    useChat({
      api: "/api/agent",
      // body is merged into every request. When pendingImage is set,
      // the server receives it and adds the image to the last user message.
      body: pendingImage ? { imageData: pendingImage } : {},
      // onFinish is called after each full response.
      // We check if the response contains a cart_update annotation from the add_to_cart tool.
      onFinish: (message) => {
        // Check annotations for cart updates from the add_to_cart tool
        if (message.annotations) {
          for (const annotation of message.annotations) {
            const ann = annotation as { type?: string; cart_update?: { type: string; action: string; itemId: string; name: string; price: number; quantity: number; size?: string; imageUrl: string } };
            if (ann?.cart_update?.type === "cart_update") {
              const { itemId, name, price, quantity, size, imageUrl } = ann.cart_update;
              addItem({ itemId, name, price, quantity, size, imageUrl });
              toast.success(`🍕 ${name} added to cart!`);
            }
          }
        }
      },
      onError: (error) => {
        console.error("Chat error:", error);
        toast.error(error.message || "Something went wrong. Please try again.");
      },
    });

  // Image upload hook
  const { attachment, isProcessing, processFile, clearAttachment } = useImageUpload();

  // Sync attachment into pendingImage so the useChat body includes it
  useEffect(() => {
    if (attachment) {
      setPendingImage({ base64: attachment.base64, mediaType: attachment.mediaType });
    } else {
      setPendingImage(null);
    }
  }, [attachment]);

  // Voice input hook — when the user stops speaking, set the transcript as the input value
  const { isRecording, interimTranscript, startRecording, stopRecording, error: voiceError, isSupported } =
    useVoiceInput({
      onTranscript: (text) => {
        setInput(text);
        // Auto-submit after the transcript is set
        setTimeout(() => {
          append({ role: "user", content: text });
          setInput("");
        }, 500);
      },
    });

  // Show voice errors as toasts
  useEffect(() => {
    if (voiceError) toast.error(voiceError);
  }, [voiceError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If a pre-filled message was passed (from "Ask Sal" button on a menu card), send it
  useEffect(() => {
    if (initialMessage) {
      append({ role: "user", content: initialMessage });
      setShowSuggestions(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !attachment) return;

    setShowSuggestions(false);

    if (attachment && !input.trim()) {
      // No text typed — add a default question so Claude knows to search for the food
      setInput("What is this food? Find me something similar on your menu.");
    }

    // handleSubmit sends the current input as a user message.
    // The pendingImage (synced from attachment) is already in the useChat body,
    // so the server will inject it into the last message automatically.
    handleSubmit(e);
    clearAttachment();
  }

  function handleSuggestion(text: string) {
    setShowSuggestions(false);
    append({ role: "user", content: text });
  }

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Panel header */}
      <div className="flex items-center justify-between p-4 bg-white border-b shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand flex items-center justify-center text-sm">
            🍕
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">Sal</p>
            <p className="text-xs text-green-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Online
            </p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Minimize chat"
          >
            <Minus size={16} />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Initial greeting */}
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs shrink-0 mr-2 mt-1">
              🍕
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm text-gray-800 shadow-sm max-w-[85%]">
              Hi! I&apos;m Sal 👋 I can help you find the perfect pizza, answer questions about
              our menu, or take your order. What can I get for you today?
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} role={msg.role as "user" | "assistant"} content={msg.content as string} />
        ))}

        {/* Typing indicator while Sal is thinking */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-brand text-white flex items-center justify-center text-xs shrink-0 mr-2">
              🍕
            </div>
            <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center h-4">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion chips — shown only before first message */}
      {showSuggestions && messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => handleSuggestion(s)}
              className="text-xs bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-full hover:border-brand hover:text-brand transition-colors"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Image attachment preview */}
      {attachment && (
        <div className="px-4 pb-1">
          <div className="text-xs text-gray-400 bg-white border border-brand/30 rounded-lg px-3 py-2 flex items-center gap-2">
            <span>📷</span>
            <span>Image attached — hit send to search our menu</span>
          </div>
        </div>
      )}

      {/* Input area */}
      <div className="p-3 bg-white border-t">
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <ImageUpload
            attachment={attachment}
            isProcessing={isProcessing}
            onFile={processFile}
            onClear={clearAttachment}
          />

          <VoiceButton
            isRecording={isRecording}
            isSupported={isSupported}
            onClick={isRecording ? stopRecording : startRecording}
          />

          <input
            ref={inputRef}
            id="sal-chat-input"
            name="message"
            autoComplete="off"
            value={isRecording && interimTranscript ? interimTranscript : input}
            onChange={handleInputChange}
            placeholder={isRecording ? "Listening..." : "Ask about our menu..."}
            disabled={isLoading}
            className={`flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-gray-400 disabled:opacity-60 ${
              isRecording ? "italic text-gray-500" : ""
            }`}
          />

          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !attachment)}
            className="p-2.5 bg-brand text-white rounded-xl hover:bg-brand-dark transition-colors disabled:opacity-40 shrink-0"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}
