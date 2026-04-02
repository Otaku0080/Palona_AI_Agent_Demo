# PalonaSlice — AI Pizza Ordering Agent

An AI-powered ordering assistant embedded in a pizza restaurant website. Built as a take-home demo for Palona AI — whose real customers include restaurant chains like Pizza Guys, Cali BBQ, and Paris Baguette.

**Sal**, the AI agent, handles all 4 use cases in one conversation:

- **General Q&A** — hours, location, allergens, loyalty program
- **Text recommendations** — "Recommend a pizza for a group of 6"
- **Image search** — upload any food photo → Sal finds the closest menu match
- **Voice ordering** — speak your request → Sal transcribes and responds

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React + Vite + TypeScript | UI, HMR, proxies `/api` to Express during dev |
| Styling | Tailwind CSS | Utility-first, brand colors `#e8400c` |
| Backend | Node.js + Express | REST API server on port 3001 |
| AI — Chat & Voice | Google Gemini (`gemini-3.1-flash-lite-preview`) | Text chat, recommendations, audio transcription |
| AI — Image Search | Transformers.js + CLIP (`Xenova/clip-vit-base-patch32`) | Runs locally in Node.js — no external API, no GPU |
| Voice Recording | Web MediaRecorder API | Browser-native audio recording (WebM/OGG) |
| Image Upload | Canvas API | Client-side resize to max 800px before sending |
| Cart State | Zustand | Global store, ~5 lines to set up |
| Monorepo | npm workspaces | `client/` and `server/` share one `node_modules` |

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

### Image Search (CLIP)
1. User uploads a food photo (JPG, PNG, WebP, GIF, BMP, AVIF — max 10MB)
2. Server runs CLIP locally to score every menu item against the photo
3. Top matches are passed to Gemini along with the image
4. Gemini identifies the food and writes a recommendation with `[PRODUCT:id]` markers
5. Client parses the markers and renders inline product cards

### Voice Search (MediaRecorder → Gemini)
1. User clicks the mic button — MediaRecorder records in WebM/OGG
2. On stop, audio blob is POST'd to `/api/chat/voice`
3. Gemini transcribes the audio (sent as the first SSE event so the user bubble updates immediately)
4. Gemini responds as Sal with menu recommendations

### Cart Updates
Gemini appends a `[CART_ADD:{...}]` marker when a user confirms an order. The client parses it after the stream closes and updates the Zustand cart — no separate API call needed.

---

## Project Structure

```
Palona_AI_Agent_Demo/
├── client/                        # Vite React frontend (port 3000)
│   ├── vite.config.ts             # Proxies /api → localhost:3001; serves /public
│   ├── tailwind.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── components/
│       │   ├── agent/
│       │   │   ├── ChatPanel.tsx  # Chat state, SSE streaming, voice/image dispatch
│       │   │   ├── ChatWidget.tsx # Floating button + panel toggle
│       │   │   ├── MessageBubble.tsx # Parses [PRODUCT:id] → inline cards
│       │   │   ├── VoiceButton.tsx
│       │   │   └── ImageUpload.tsx
│       │   └── menu/
│       │       ├── MenuCard.tsx
│       │       ├── MenuSection.tsx
│       │       └── CartDrawer.tsx
│       ├── hooks/
│       │   ├── useImageUpload.ts  # Canvas resize with raw-file fallback
│       │   └── useVoiceRecorder.ts # MediaRecorder wrapper
│       ├── data/catalog.ts        # 19 menu items
│       ├── store/cart.ts          # Zustand cart store
│       └── types/
├── server/                        # Express backend (port 3001)
│   └── src/
│       ├── index.ts               # App entry, middleware, route registration
│       ├── routes/
│       │   ├── chat.ts            # POST /api/chat and POST /api/chat/voice
│       │   └── image.ts           # POST /api/image-search (CLIP + Gemini)
│       ├── data/catalog.ts        # Same catalog used for CLIP labels
│       └── types/catalog.ts
├── public/images/                 # Food photos served as static assets
├── .env.example
└── package.json                   # Root workspace (runs both client + server)
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
# Add your key: GEMINI_API_KEY=AIza...

# 4. Start both servers
npm run dev
# client → http://localhost:3000
# server → http://localhost:3001
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `GEMINI_API_KEY` | Google Gemini API key (required) |

---

## API Reference

### `POST /api/chat`
Text chat with conversation history.

**Request:**
```json
{
  "messages": [
    { "role": "user", "content": "Recommend a vegetarian pizza" }
  ]
}
```
**Response:** `text/event-stream` — chunks of `data: {"text":"..."}`, ends with `data: [DONE]`

---

### `POST /api/chat/voice`
Multipart form with audio blob. Returns transcript + response over SSE.

**Form fields:** `audio` (Blob), `history` (JSON string of prior messages)

**Response:** SSE — first event is `data: {"transcript":"..."}`, then text chunks, then `[DONE]`

---

### `POST /api/image-search`
Multipart form with image file. Runs CLIP locally then asks Gemini to write the response.

**Form fields:** `image` (File — JPG/PNG/WebP/GIF/BMP/AVIF, max 10MB)

**Response:** `text/event-stream` — same format as `/api/chat`

---

## Notes

**CLIP cold start** — the first image search downloads the CLIP model (~85MB) from Hugging Face. Subsequent requests use the cached model and are fast.

**Voice browser support** — MediaRecorder is supported in all modern browsers. Chrome uses WebM, Safari uses MP4. Both are sent to Gemini for transcription.

**Image formats** — the client tries canvas-resize first (produces a compact JPEG). If the browser can't decode the format, it falls back to sending the raw file. HEIC (iPhone default) is not supported by the browser canvas — share iPhone photos as JPEG instead.
