import { Router, Request, Response } from "express";
import multer from "multer";
import { GoogleGenerativeAI, Content, Part } from "@google/generative-ai";
import { catalog } from "../data/catalog.js";
import { hasSizes, getBasePrice } from "../types/catalog.js";

export const chatRouter = Router();

// Multer with memory storage — audio blobs are kept in RAM as Buffer
const upload = multer({ storage: multer.memoryStorage() });

// ─── Gemini client ────────────────────────────────────────────────────────────
// Tries GEMINI_API_KEY first, then GOOGLE_GENERATIVE_AI_API_KEY as a fallback.
function getGeminiClient(): GoogleGenerativeAI {
  const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key) {
    throw new Error(
      "Missing API key. Add GEMINI_API_KEY to .env.local at the repo root."
    );
  }
  return new GoogleGenerativeAI(key);
}

// ─── Build the full catalog context string for the system prompt ──────────────
function buildCatalogContext(): string {
  const specials = catalog.filter((i) => i.isSpecial);

  const lines = catalog.map((item) => {
    const price = hasSizes(item.price)
      ? `Small $${item.price.small} / Medium $${item.price.medium} / Large $${item.price.large}`
      : `$${item.price}`;
    const special =
      item.isSpecial && item.specialPrice ? ` (SPECIAL: $${item.specialPrice})` : "";
    const dietary = item.dietary.length > 0 ? ` [${item.dietary.join(", ")}]` : "";
    return `- ${item.id}: ${item.name} | ${item.category} | ${price}${special}${dietary} | ${item.description}`;
  });

  const specialsSummary = specials
    .map((s) => `${s.name} ($${s.specialPrice ?? getBasePrice(s.price)})`)
    .join(", ");

  return `FULL MENU CATALOG:\n${lines.join("\n")}\n\nTODAY'S SPECIALS: ${specialsSummary}`;
}

// ─── System prompt ────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are "Sal", the friendly AI ordering assistant for PalonaSlice Pizza 🍕

Your job is to help customers discover menu items, get personalized recommendations, and place orders. You are warm, enthusiastic about food, and concise.

${buildCatalogContext()}

RULES:
- Only recommend items that exist in the menu catalog above. Never invent items.
- When you recommend items, include [PRODUCT:item-id] in your response so the UI can display a product card.
  Example: "I'd recommend our Meat Lovers [PRODUCT:meat-lovers]!"
- Keep responses short — 2-4 sentences max. Use bullet points for lists.
- Be honest if something is out of stock or not on the menu.
- When the customer explicitly says they want to order / add an item to their cart, end your response
  with a JSON cart marker on its own line, like this:
  [CART_ADD:{"itemId":"classic-pepperoni","name":"Classic Pepperoni","price":14.99,"quantity":1,"size":"medium","imageUrl":"/images/pepperoni_pizza.jpg"}]
  Use the medium price for pizzas unless the customer specifies a size. Use the item's specialPrice if isSpecial is true.
  Only emit ONE [CART_ADD:...] block per turn, even if the customer asked for multiple items — add them one at a time.

RESTAURANT INFO (use instead of guessing):
- Hours: Mon–Thu 11am–10pm, Fri–Sat 11am–11pm, Sun 12pm–9pm
- Location: 123 Slice Street, San Francisco, CA 94102. Free parking behind building on weekends.
- Delivery: Within 5 miles. Free delivery on orders over $30. Usually 30–45 minutes.
- Allergens: Gluten, dairy, eggs common. Gluten-free crust available (+$2). Cannot guarantee allergen-free environment.
- Loyalty: Slice Rewards — 1 point per dollar, 100 points = $5 off.`;

// ─── Convert client message format to Gemini Content format ──────────────────
function toGeminiHistory(
  messages: Array<{ role: string; content: string }>
): Content[] {
  // Gemini uses "model" instead of "assistant", and the last message is sent
  // separately as the current turn, so we exclude it here.
  return messages.slice(0, -1).map((msg) => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));
}

// ─── POST /api/chat — text chat ───────────────────────────────────────────────
// Body: { messages: [{role, content}], sessionId? }
chatRouter.post(
  "/",
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { messages } = req.body as {
        messages: Array<{ role: string; content: string }>;
        sessionId?: string;
      };

      if (!messages || messages.length === 0) {
        res.status(400).json({ error: "messages array is required" });
        return;
      }

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite-preview",
        systemInstruction: SYSTEM_PROMPT,
      });

      const history = toGeminiHistory(messages);
      const lastMessage = messages[messages.length - 1];

      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream(lastMessage.content);

      // Set up SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          // SSE format: "data: <payload>\n\n"
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[chat] error:", message);
      // If headers already sent, can't send JSON error — just close the stream
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  }
);

// ─── POST /api/chat/voice — audio (WebM/OGG) → Gemini → SSE ─────────────────
// Accepts multipart form with field "audio" (the blob from MediaRecorder)
// and optional field "history" (JSON string of previous messages).
chatRouter.post(
  "/voice",
  upload.single("audio"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "audio file is required" });
        return;
      }

      // Parse the conversation history if provided
      let history: Content[] = [];
      if (req.body.history) {
        try {
          const parsed = JSON.parse(req.body.history) as Array<{
            role: string;
            content: string;
          }>;
          history = parsed.map((msg) => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }],
          }));
        } catch {
          // History parse failure is non-fatal
        }
      }

      const genAI = getGeminiClient();
      const model = genAI.getGenerativeModel({
        model: "gemini-3.1-flash-lite-preview",
        systemInstruction: SYSTEM_PROMPT,
      });

      // Convert audio Buffer → base64
      const audioBase64 = req.file.buffer.toString("base64");
      // Normalize the mime type — MediaRecorder typically gives audio/webm
      const mimeType = (req.file.mimetype || "audio/webm") as
        | "audio/webm"
        | "audio/ogg"
        | "audio/mp4";

      const audioPart: Part = {
        inlineData: {
          mimeType,
          data: audioBase64,
        },
      };

      // ── Step 1: Transcribe the audio (non-streaming, fast) ───────────────────
      // We do this first so the client can immediately display what the user said.
      const transcriptModel = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });
      const transcriptResult = await transcriptModel.generateContent([
        audioPart,
        { text: "Transcribe exactly what the person said in this audio. Return only the transcript — no explanation, no punctuation fixes, no extra text." },
      ]);
      const transcript = transcriptResult.response.text().trim();

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      // Send the transcript so the client can update the user message bubble
      res.write(`data: ${JSON.stringify({ transcript })}\n\n`);

      // ── Step 2: Stream the assistant response ─────────────────────────────────
      const chat = model.startChat({ history });
      const result = await chat.sendMessageStream([
        audioPart,
        { text: `The user said: "${transcript}". Respond as Sal the pizza assistant.` },
      ]);

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          res.write(`data: ${JSON.stringify({ text })}\n\n`);
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[chat/voice] error:", message);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  }
);
