import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SYSTEM_PROMPT, agentTools } from "@/lib/agent-tools";

// Tell Next.js this route can run up to 30 seconds (needed for multi-step tool calls)
export const maxDuration = 30;

export async function POST(req: Request) {
  // Parse the request body sent by the useChat hook on the client.
  // imageData is sent separately when the user attaches a photo.
  const { messages, imageData } = await req.json();

  // If the user sent an image alongside their message, inject it into the
  // last user message as a multimodal content array.
  // This lets useChat on the client stay simple (text only), while the server
  // sends Claude the full image + text combination.
  const processedMessages = imageData
    ? messages.map((msg: { role: string; content: unknown }, idx: number) => {
        if (idx === messages.length - 1 && msg.role === "user") {
          return {
            ...msg,
            content: [
              { type: "text", text: typeof msg.content === "string" ? msg.content : "" },
              { type: "image", image: imageData.base64, mimeType: imageData.mediaType },
            ],
          };
        }
        return msg;
      })
    : messages;

  // streamText sends messages to Claude and streams the response back token by token.
  // maxSteps: 5 means Claude can call a tool, get the result, then call another tool
  // (up to 5 rounds) before writing the final response — all in one request.
  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: SYSTEM_PROMPT,
    messages: processedMessages,
    tools: agentTools,
    maxSteps: 5,
  });

  // toDataStreamResponse() converts the stream into the format the
  // Vercel AI SDK's useChat hook expects on the client side.
  return result.toDataStreamResponse();
}
