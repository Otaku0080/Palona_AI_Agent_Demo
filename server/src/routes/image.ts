import { Router, Request, Response } from "express";
import multer from "multer";
import { GoogleGenerativeAI, Part } from "@google/generative-ai";
import { catalog } from "../data/catalog.js";
import { hasSizes } from "../types/catalog.js";

export const imageRouter = Router();

// Multer — store uploaded images in memory as Buffer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// ─── Lazy-load the CLIP pipeline ─────────────────────────────────────────────
// @huggingface/transformers runs locally in Node.js — no external API needed.
// We cache the pipeline after the first load so subsequent requests are fast.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let clipPipeline: any = null;

async function getClipPipeline() {
  if (clipPipeline) return clipPipeline;

  // Dynamic import so the heavy model only loads when first needed
  const { pipeline, env } = await import("@huggingface/transformers");

  // Allow downloading the model from Hugging Face Hub to local cache
  env.allowLocalModels = false;
  env.allowRemoteModels = true;

  clipPipeline = await pipeline(
    "zero-shot-image-classification",
    "Xenova/clip-vit-base-patch32"
  );
  return clipPipeline;
}

// ─── Build CLIP candidate labels from the catalog ────────────────────────────
// CLIP works best with descriptive natural-language labels.
// Including the category helps CLIP distinguish pizza from sides/drinks/desserts.
function buildCandidateLabels(): Array<{ label: string; itemId: string }> {
  const categoryDescriptions: Record<string, string> = {
    pizza: "pizza",
    sides: "appetizer or side dish",
    drinks: "drink or beverage",
    desserts: "dessert",
  };

  return catalog.map((item) => {
    const categoryWord = categoryDescriptions[item.category] ?? item.category;
    const toppingText =
      item.toppings && item.toppings.length > 0
        ? ` with ${item.toppings.slice(0, 3).join(", ")}`
        : "";
    return {
      label: `a photo of ${item.name.toLowerCase()}, a ${categoryWord}${toppingText}`,
      itemId: item.id,
    };
  });
}

// ─── POST /api/image-search ────────────────────────────────────────────────────
// Accepts: multipart form with field "image"
// Returns: SSE stream with Gemini's friendly recommendation text
imageRouter.post(
  "/",
  upload.single("image"),
  async (req: Request, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "image file is required" });
        return;
      }

      // ── Step 1: Run CLIP to find the most similar menu items ───────────────
      const candidateMeta = buildCandidateLabels();
      const candidateLabels = candidateMeta.map((c) => c.label);

      let topMatches: Array<{ itemId: string; score: number }> = [];

      try {
        const pipe = await getClipPipeline();

        // Convert Buffer to a data URL for CLIP (it expects a URL or image data)
        const mimeType = req.file.mimetype || "image/jpeg";
        const base64Image = req.file.buffer.toString("base64");
        const dataUrl = `data:${mimeType};base64,${base64Image}`;

        const results = await pipe(dataUrl, candidateLabels);

        // results is an array of { label, score } sorted by score descending
        // Map scores back to itemIds
        topMatches = (results as Array<{ label: string; score: number }>)
          .slice(0, 5)
          .map((r) => {
            const meta = candidateMeta.find((c) => c.label === r.label);
            return { itemId: meta?.itemId ?? "", score: r.score };
          })
          .filter((m) => m.itemId !== "");
      } catch (clipErr) {
        console.warn("[image-search] CLIP failed, falling back to Gemini-only search:", clipErr);
        // Graceful degradation: pick one item from each category so Gemini
        // sees a representative sample of the full menu, not just pizzas.
        const seen = new Set<string>();
        topMatches = catalog
          .filter((item) => {
            if (seen.has(item.category)) return false;
            seen.add(item.category);
            return true;
          })
          .map((item) => ({ itemId: item.id, score: 0 }));
      }

      // ── Step 2: Build item descriptions for Gemini ────────────────────────
      // Always send the FULL catalog so Gemini can find the right match even
      // if CLIP ranked it low. CLIP narrows the field; Gemini makes the final call.
      const matchedItems = catalog;

      const itemDescriptions = matchedItems
        .map((item) => {
          if (!item) return "";
          const price = hasSizes(item.price)
            ? `from $${item.price.medium}`
            : `$${item.price}`;
          const special =
            item.isSpecial && item.specialPrice
              ? ` (on special: $${item.specialPrice})`
              : "";
          return `- ${item.name} [PRODUCT:${item.id}] — ${price}${special}: ${item.description}`;
        })
        .join("\n");

      // ── Step 3: Pass image + matches to Gemini for a friendly response ──────
      const key =
        process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!key) {
        res.status(500).json({
          error: "Missing GEMINI_API_KEY. Add it to .env.local at the repo root.",
        });
        return;
      }

      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: "gemini-3.1-flash-lite-preview" });

      const imagePart: Part = {
        inlineData: {
          mimeType: req.file.mimetype as "image/jpeg" | "image/png" | "image/webp",
          data: req.file.buffer.toString("base64"),
        },
      };

      const prompt = `You are Sal, the friendly AI assistant for PalonaSlice Pizza.

A customer uploaded a food photo. First, identify exactly what food is in the photo (it could be anything — pizza, mozzarella sticks, fries, salad, a drink, a dessert, etc.). Then look at the menu items below and recommend whichever ones are the closest match to what you see, regardless of category.

Our menu items that may match:
${itemDescriptions}

Write a short, enthusiastic response (2-3 sentences): name what you think the food in the photo is, then recommend the closest matching item(s) from the list above.
Include the [PRODUCT:item-id] markers exactly as shown above for any items you mention.
Do NOT default to pizza if the photo shows something else — be accurate about what you see.
Keep it warm and conversational.`;

      // Set up SSE
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders();

      const result = await model.generateContentStream([imagePart, { text: prompt }]);

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
      console.error("[image-search] error:", message);
      if (!res.headersSent) {
        res.status(500).json({ error: message });
      } else {
        res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        res.end();
      }
    }
  }
);
