import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { chatRouter } from "./routes/chat.js";
import { imageRouter } from "./routes/image.js";

// Load .env.local from the monorepo root (one directory up from server/)
dotenv.config({ path: "../.env.local" });

// NOTE: You need to add GEMINI_API_KEY to your .env.local file at the repo root.
// Example: GEMINI_API_KEY=AIza...
// If you previously had GOOGLE_GENERATIVE_AI_API_KEY, that also works as a fallback.

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.use("/api/chat", chatRouter);
app.use("/api/image-search", imageRouter);

const PORT = process.env.PORT ?? 3001;

app.listen(PORT, () => {
  console.log(`PalonaSlice server running on http://localhost:${PORT}`);
  const hasKey = !!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY);
  if (!hasKey) {
    console.warn(
      "WARNING: GEMINI_API_KEY not found in environment. Add it to .env.local at the repo root."
    );
  }
});
