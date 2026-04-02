import { useEffect, useRef, useState, useCallback } from "react";
import { Send, X, Minus } from "lucide-react";
import MessageBubble from "./MessageBubble";
import VoiceButton from "./VoiceButton";
import ImageUpload from "./ImageUpload";
import { useVoiceRecorder } from "../../hooks/useVoiceRecorder";
import { useImageUpload } from "../../hooks/useImageUpload";
import { useCartStore } from "../../store/cart";
import type { CartItem } from "../../types/cart";
import { toast } from "sonner";

// Suggestion chips shown when the chat is first opened.
const SUGGESTIONS = [
  "Recommend a pizza for a group of 6 🍕",
  "What are your vegetarian options?",
  "What's on special today?",
  "I have a photo of a pizza I love 📷",
];

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  onClose: () => void;
  onMinimize: () => void;
  initialMessage?: string;
}

// ─── Parse SSE stream from the server ─────────────────────────────────────────
// Reads a ReadableStream from a fetch response and calls onChunk for each token.
// Calls onDone when the stream ends. Returns early on [DONE].
async function readSSEStream(
  response: Response,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (msg: string) => void,
  onTranscript?: (text: string) => void
) {
  const reader = response.body?.getReader();
  if (!reader) {
    onError("No response body");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      // SSE messages are separated by double newlines
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? ""; // keep the last incomplete line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(payload) as { text?: string; error?: string; transcript?: string };
          if (parsed.error) {
            onError(parsed.error);
            return;
          }
          if (parsed.transcript && onTranscript) {
            onTranscript(parsed.transcript);
          }
          if (parsed.text) {
            onChunk(parsed.text);
          }
        } catch {
          // Ignore malformed JSON chunks
        }
      }
    }
    onDone();
  } catch (err) {
    onError(err instanceof Error ? err.message : "Stream read error");
  } finally {
    reader.cancel();
  }
}

// ─── Parse [CART_ADD:{...}] marker and update Zustand ─────────────────────────
function parseAndApplyCartAdd(
  fullText: string,
  addItem: (item: CartItem) => void
) {
  const match = fullText.match(/\[CART_ADD:(\{[^}]+\})\]/);
  if (!match) return;

  try {
    const data = JSON.parse(match[1]) as {
      itemId: string;
      name: string;
      price: number;
      quantity: number;
      size?: string;
      imageUrl: string;
    };
    addItem({
      itemId: data.itemId,
      name: data.name,
      price: data.price,
      quantity: data.quantity ?? 1,
      size: data.size,
      imageUrl: data.imageUrl,
    });
    toast.success(`🍕 ${data.name} added to cart!`);
  } catch {
    // Malformed CART_ADD — ignore silently
  }
}

export default function ChatPanel({ onClose, onMinimize, initialMessage }: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const addItem = useCartStore((state) => state.addItem);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  // Image upload hook
  const { attachment, isProcessing, processFile, clearAttachment, error: uploadError } = useImageUpload();

  // Show image upload errors as toasts
  useEffect(() => {
    if (uploadError) toast.error(uploadError);
  }, [uploadError]);

  // ─── Send a text message to /api/chat ──────────────────────────────────────
  const sendMessage = useCallback(
    async (userText: string, imageFile?: File) => {
      if (!userText.trim() && !imageFile) return;

      setShowSuggestions(false);
      setIsLoading(true);

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: imageFile
          ? userText || "What is this food? Find me something similar on your menu."
          : userText,
      };

      // Optimistically add the user message
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      // Placeholder assistant message that we'll stream into
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      let accumulatedText = "";

      try {
        let response: Response;

        if (imageFile) {
          // ── Image search: POST multipart to /api/image-search ──────────────
          const form = new FormData();
          form.append("image", imageFile);
          response = await fetch("/api/image-search", {
            method: "POST",
            body: form,
          });
        } else {
          // ── Text chat: POST JSON to /api/chat ────────────────────────────
          // Build the full conversation history to send to the server
          const historyMessages = messages.map((m) => ({
            role: m.role,
            content: m.content,
          }));
          historyMessages.push({ role: "user", content: userText });

          response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: historyMessages }),
          });
        }

        if (!response.ok) {
          const errData = (await response.json()) as { error?: string };
          throw new Error(errData.error ?? `Server error ${response.status}`);
        }

        await readSSEStream(
          response,
          (chunk) => {
            accumulatedText += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedText } : m
              )
            );
          },
          () => {
            // Stream done — parse any CART_ADD marker in the full response
            parseAndApplyCartAdd(accumulatedText, addItem);
            setIsLoading(false);
          },
          (errMsg) => {
            toast.error(errMsg || "Something went wrong. Please try again.");
            // Remove the empty assistant message on error
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            setIsLoading(false);
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong.";
        toast.error(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setIsLoading(false);
      }
    },
    [messages, addItem]
  );

  // ─── Send audio to /api/chat/voice ─────────────────────────────────────────
  const sendVoice = useCallback(
    async (audioBlob: Blob) => {
      setShowSuggestions(false);
      setIsLoading(true);

      // Show a placeholder "Voice message" bubble while we wait
      const userMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: userMsgId, role: "user", content: "🎤 Voice message" },
      ]);

      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      let accumulatedText = "";

      try {
        const form = new FormData();
        // Use a filename with the correct extension so the server knows the type
        const ext = audioBlob.type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", audioBlob, `recording.${ext}`);

        // Send the prior conversation history so Sal has context
        const historyForServer = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        form.append("history", JSON.stringify(historyForServer));

        const response = await fetch("/api/chat/voice", {
          method: "POST",
          body: form,
        });

        if (!response.ok) {
          const errData = (await response.json()) as { error?: string };
          throw new Error(errData.error ?? `Server error ${response.status}`);
        }

        await readSSEStream(
          response,
          (chunk) => {
            accumulatedText += chunk;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: accumulatedText } : m
              )
            );
          },
          () => {
            parseAndApplyCartAdd(accumulatedText, addItem);
            setIsLoading(false);
          },
          (errMsg) => {
            toast.error(errMsg || "Voice processing failed.");
            setMessages((prev) => prev.filter((m) => m.id !== assistantId));
            setIsLoading(false);
          },
          (transcript) => {
            // Replace the "🎤 Voice message" placeholder with what the user actually said
            setMessages((prev) =>
              prev.map((m) =>
                m.id === userMsgId ? { ...m, content: transcript } : m
              )
            );
          }
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Voice processing failed.";
        toast.error(msg);
        setMessages((prev) =>
          prev.filter((m) => m.id !== assistantId && m.id !== userMsgId)
        );
        setIsLoading(false);
      }
    },
    [messages, addItem]
  );

  // Voice recorder hook — when recording stops, blob is passed to sendVoice
  const { isRecording, startRecording, stopRecording, error: voiceError, isSupported } =
    useVoiceRecorder({ onAudioReady: sendVoice });

  // Show voice errors as toasts
  useEffect(() => {
    if (voiceError) toast.error(voiceError);
  }, [voiceError]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // If a pre-filled message was passed (from "Ask Sal" button on a menu card), send it once
  useEffect(() => {
    if (initialMessage) {
      sendMessage(initialMessage);
    }
    // We only want this to run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() && !attachment) return;

    const imageFile = attachment?.file;
    const text = input.trim();

    clearAttachment();
    sendMessage(text, imageFile);
  }

  function handleSuggestion(text: string) {
    setShowSuggestions(false);
    sendMessage(text);
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
          <MessageBubble key={msg.id} role={msg.role} content={msg.content} />
        ))}

        {/* Typing indicator while Sal is thinking */}
        {isLoading && messages[messages.length - 1]?.content === "" && (
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
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isRecording ? "Recording... click mic to stop" : "Ask about our menu..."}
            disabled={isLoading || isRecording}
            className={`flex-1 bg-gray-100 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30 placeholder:text-gray-400 disabled:opacity-60 ${
              isRecording ? "italic text-gray-500" : ""
            }`}
          />

          <button
            type="submit"
            disabled={isLoading || isRecording || (!input.trim() && !attachment)}
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
