# PalonaSlice — AI Pizza Ordering Agent

An AI-powered ordering assistant embedded in a pizza restaurant website. Built as a take-home demo for Palona AI — whose real customers include restaurant chains like Pizza Guys, Cali BBQ, and Paris Baguette.

**Sal**, the AI agent, handles all 4 use cases in one conversation:

- **General Q&A** — hours, location, allergens, loyalty program
- **Text recommendations** — "Recommend a pizza for a group of 6"
- **Image search** — upload any food photo → Sal finds the closest menu match
- **Voice ordering** — speak your request → Sal transcribes and responds

---

## Tech Stack & Why

| Layer | Technology | Decision Rationale |
|-------|-----------|-------------------|
| Frontend | **React + Vite + TypeScript** | React is the industry standard for component-driven UIs. Vite replaces Create React App with near-instant HMR and a native ESM dev server — no Webpack config needed. TypeScript catches shape mismatches between the catalog, API payloads, and UI components at compile time. |
| Styling | **Tailwind CSS** | Utility classes co-located with markup make it fast to build and easy to read. No separate CSS files to maintain. The brand color (`#e8400c`) is defined once in `tailwind.config.ts` and reused everywhere as `bg-brand`. |
| Backend | **Node.js + Express** | Lightweight, unopinionated, and easy to explain line by line. Express gives full control over multipart uploads (Multer), CORS, and SSE streaming — things that are harder to customize in framework-level abstractions. Running the AI server separately from the UI also mirrors how production restaurant tech stacks are structured. |
| AI — Chat & Voice | **Google Gemini (`gemini-3.1-flash-lite-preview`)** | Gemini is multimodal out of the box — the same model handles text, audio, and vision. The free tier is generous enough for demos. The `@google/generative-ai` SDK is minimal: one import, one client, one streaming call. |
| AI — Image Search | **Transformers.js + CLIP (`Xenova/clip-vit-base-patch32`)** | CLIP runs entirely in Node.js via ONNX Runtime — no external API, no per-request cost, no latency round-trip. It encodes both images and text into the same vector space, so comparing a photo to "a photo of mozzarella sticks, an appetizer" produces a meaningful similarity score. Gemini then writes the final response from the top-ranked matches. |
| Voice Recording | **Web MediaRecorder API** | Browser-native — no library, no permission complexity beyond the mic prompt. Outputs WebM/OGG blobs that Gemini accepts directly as audio input. |
| Image Processing | **Canvas API** | Client-side resize to max 800px before upload keeps payloads under ~200KB without a server-side image processing dependency. Falls back to raw file read if the browser can't decode the format. |
| Cart State | **Zustand** | ~5 lines to set up a global store with no boilerplate. Lighter than Redux, simpler than Context + useReducer for this scale. |
| Monorepo | **npm workspaces** | `client/` and `server/` share one `node_modules` and one `npm install`. A single `npm run dev` from the root starts both with `concurrently`. No Turborepo or Nx complexity needed for a two-package project. |

---

## How the 4 Features Work

```
User types text        ──► POST /api/chat        ──► Gemini streams response
User describes need    ──► POST /api/chat        ──► Gemini recommends items
User uploads image     ──► POST /api/image-search ──► CLIP ranks menu items
                                                      ──► Gemini writes response
User records voice     ──► POST /api/chat/voice  ──► Gemini transcribes audio
                                                      ──► Gemini responds as Sal
```

### Image Search (CLIP + Gemini)
1. User uploads a food photo (JPG, PNG, WebP, GIF, BMP, AVIF — max 10MB)
2. Server runs CLIP locally — scores every menu item against the photo using natural-language labels like `"a photo of mozzarella sticks, an appetizer or side dish"`
3. Full catalog + top CLIP matches are passed to Gemini with the image
4. Gemini identifies the food and writes a recommendation with `[PRODUCT:id]` markers
5. Client parses the markers and renders inline product cards

### Voice Search (MediaRecorder → Gemini)
1. User clicks the mic — MediaRecorder records in WebM/OGG
2. On stop, audio blob is POST'd to `/api/chat/voice`
3. Gemini transcribes first (non-streaming), sends `{ transcript }` as the first SSE event — the user bubble updates immediately with what they said
4. Gemini then streams the response as Sal

### Cart Updates
Gemini appends a `[CART_ADD:{...}]` marker when a user confirms an order. The client parses it after the stream closes and updates the Zustand store — no separate API call needed.

---

## Project Structure

```
Palona_AI_Agent_Demo/
├── client/                        # Vite React frontend (port 3000)
│   ├── vite.config.ts             # Proxies /api → localhost:3001; serves root /public
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── agent/
│       │   │   ├── ChatPanel.tsx      # Chat state, SSE streaming, voice/image dispatch
│       │   │   ├── ChatWidget.tsx     # Floating button + panel toggle
│       │   │   ├── MessageBubble.tsx  # Parses [PRODUCT:id] → inline cards
│       │   │   ├── VoiceButton.tsx
│       │   │   └── ImageUpload.tsx
│       │   └── menu/
│       │       ├── MenuCard.tsx
│       │       ├── MenuSection.tsx
│       │       └── CartDrawer.tsx
│       ├── hooks/
│       │   ├── useImageUpload.ts      # Canvas resize with raw-file fallback
│       │   └── useVoiceRecorder.ts    # MediaRecorder wrapper
│       ├── data/catalog.ts            # 19 menu items
│       ├── store/cart.ts              # Zustand cart store
│       └── types/
├── server/                        # Express backend (port 3001)
│   └── src/
│       ├── index.ts               # App entry, middleware, route registration
│       ├── routes/
│       │   ├── chat.ts            # POST /api/chat  |  POST /api/chat/voice
│       │   └── image.ts           # POST /api/image-search (CLIP + Gemini)
│       ├── data/catalog.ts        # Catalog used for CLIP candidate labels
│       └── types/catalog.ts
├── public/images/                 # Food photos served as static assets by Vite
├── .env.example
└── package.json                   # Root workspace — runs client + server together
```

---

## Getting Started

### Prerequisites

- Node.js v20+ ([nodejs.org](https://nodejs.org))
- A Gemini API key — free at [aistudio.google.com](https://aistudio.google.com)

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/your-username/Palona_AI_Agent_Demo.git
cd Palona_AI_Agent_Demo

# 2. Install all workspace dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local and add: GEMINI_API_KEY=AIza...

# 4. Start both servers with one command
npm run dev
# client → http://localhost:3000
# server → http://localhost:3001
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key — get one free at aistudio.google.com |

---

## Agent API Reference

All endpoints are served by the Express server on port 3001. During development, Vite proxies `/api/*` requests so the client calls `/api/...` without specifying the port.

All streaming endpoints respond with `Content-Type: text/event-stream`. Each chunk is a line in the format:

```
data: <JSON payload>\n\n
```

The stream ends with:

```
data: [DONE]\n\n
```

---

### `POST /api/chat`

General text chat. Sends the full conversation history and streams Sal's response.

**Request body** (`application/json`):

```json
{
  "messages": [
    { "role": "user",      "content": "What are your vegetarian options?" },
    { "role": "assistant", "content": "We have two great vegetarian pizzas..." },
    { "role": "user",      "content": "Which one is cheaper?" }
  ]
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `messages` | `{ role: "user" \| "assistant", content: string }[]` | Yes | Full conversation history including the current user message as the last entry |

**SSE response chunks:**

```
data: {"text":"I'd recommend the"}
data: {"text":" Margherita [PRODUCT:margherita]"}
data: {"text":" — it's $13.99 for a medium!"}
data: [DONE]
```

**Error chunk** (if something goes wrong mid-stream):

```
data: {"error":"Missing API key..."}
```

**`[PRODUCT:id]` markers** — when Sal recommends a menu item it includes a marker like `[PRODUCT:classic-pepperoni]`. The client parses these and renders inline product cards.

**`[CART_ADD:{...}]` marker** — when the user confirms they want to order, Sal appends a cart marker at the end of its response:

```
[CART_ADD:{"itemId":"classic-pepperoni","name":"Classic Pepperoni","price":14.99,"quantity":1,"size":"medium","imageUrl":"/images/pepperoni_pizza.jpg"}]
```

The client strips this from the displayed message and updates the Zustand cart store.

---

### `POST /api/chat/voice`

Accepts a voice recording. Gemini transcribes it, then responds as Sal. The transcript is sent as the **first** SSE event so the UI can update the user's message bubble before the response starts streaming.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `audio` | `Blob` | Yes | Audio recording from MediaRecorder. Filename extension should be `.webm` or `.ogg`. |
| `history` | `string` | No | JSON-encoded array of prior messages (`{ role, content }[]`) for conversation context |

**SSE response:**

```
data: {"transcript":"I want a large meat lovers pizza"}
data: {"text":"Great choice! The Meat Lovers [PRODUCT:meat-lovers] is one of our most popular..."}
data: [DONE]
```

The `transcript` event always comes first. The client uses it to replace the `🎤 Voice message` placeholder with what the user actually said.

---

### `POST /api/image-search`

Accepts a food photo. Runs CLIP locally to rank menu items by visual similarity, then passes the top matches + the image to Gemini for a friendly recommendation.

**Request body** (`multipart/form-data`):

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image` | `File` | Yes | Food photo. Supported formats: JPG, PNG, WebP, GIF, BMP, AVIF. Max size: 10MB. |

**SSE response:**

```
data: {"text":"That looks like mozzarella sticks! We have"}
data: {"text":" Mozzarella Sticks (6 pcs) [PRODUCT:mozzarella-sticks]"}
data: {"text":" for just $7.99 — golden-fried with marinara sauce!"}
data: [DONE]
```

**CLIP fallback** — if the CLIP model hasn't loaded yet (cold start on first request), the server falls back to passing one item from each menu category to Gemini so the response still covers the full menu.

---

## Notes

**CLIP cold start** — the first image search downloads the CLIP model (~85MB) from Hugging Face Hub to the local cache. Subsequent requests are fast. The cache lives at `server/.cache/`.

**Voice browser support** — MediaRecorder is supported in all modern browsers. Chrome records WebM, Safari records MP4. Both are accepted by Gemini for transcription.

**Image formats** — the client attempts canvas-resize first (produces a compact JPEG). If the browser cannot decode the format, it falls back to sending the raw file as-is. HEIC (iPhone default format) is not supported by the browser canvas — export iPhone photos as JPEG before uploading.
