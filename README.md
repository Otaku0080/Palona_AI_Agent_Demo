# PalonaSlice — AI Pizza Ordering Agent

An AI-powered ordering assistant embedded in a pizza restaurant website. Built as a demo for Palona AI — whose real customers include restaurant chains like Pizza Guys, Cali BBQ, and Paris Baguette.

**Sal**, the AI agent, handles all 4 use cases in a single conversation:
- General Q&A ("What's your name?", "What are your hours?")
- Text-based product recommendations ("Recommend a pizza for a group of 6")
- Image-based food search (upload a food photo → Sal finds similar items)
- Voice-based ordering (speak your request → Sal responds)

## Live Demo

> Deploy to Vercel (see deployment section below) and paste your URL here.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | React + Node.js API routes in one project; zero-config Vercel deploy |
| Language | TypeScript | Type safety across catalog, tools, and API shapes |
| Styling | Tailwind CSS | Utility classes inline; fast to build, easy to read |
| AI | Vercel AI SDK + Anthropic Claude | `useChat` hook handles streaming; Claude claude-sonnet-4-6 for tool use + vision |
| Voice | Web Speech API | Browser-native; no external service needed |
| Image Search | Canvas resize → base64 → Claude Vision | Claude describes the food photo and searches the catalog |
| Cart State | Zustand | Simple global store; ~5 lines to set up |
| Deployment | Vercel | `git push` → live URL |

## Architecture: One Agent, Four Tools

All features route through a single Claude call at `POST /api/agent`. Claude decides which tool to call based on the user's message — the same pattern as multi-tool agent frameworks (Crew AI, LangChain).

```
User message (text / voice transcript / image + text)
        │
        ▼
POST /api/agent
        │
        ▼
Claude (claude-sonnet-4-6) → picks tool(s):

  search_catalog           ← text search & recommendations
  identify_food_from_image ← image-based food search
  add_to_cart              ← order confirmation
  get_restaurant_info      ← hours, location, allergens

        │
        ▼
Tool result returned to Claude
        │
        ▼
Claude streams final response → browser
```

### Key files

| File | Purpose |
|------|---------|
| `src/app/api/agent/route.ts` | Core agent endpoint — Claude + streaming + tools |
| `src/lib/agent-tools.ts` | Tool definitions, system prompt, tool handler functions |
| `src/lib/catalog-search.ts` | Weighted fuzzy search against the menu catalog |
| `src/data/catalog.ts` | 20-item typed menu catalog (pizzas, sides, drinks, desserts) |
| `src/components/agent/ChatPanel.tsx` | Chat UI using `useChat` hook |
| `src/hooks/useVoiceInput.ts` | Web Speech API wrapper |
| `src/hooks/useImageUpload.ts` | Canvas image resize → base64 |
| `src/store/cart.ts` | Zustand cart store |

## Getting Started

### Prerequisites

- Node.js v20+ ([nodejs.org](https://nodejs.org))
- An Anthropic API key ([console.anthropic.com](https://console.anthropic.com))

### Local Development

```bash
# 1. Clone the repo
git clone https://github.com/your-username/Palona_AI_Agent_Demo.git
cd Palona_AI_Agent_Demo

# 2. Install dependencies
npm install

# 3. Set up environment
cp .env.example .env.local
# Edit .env.local and add your ANTHROPIC_API_KEY

# 4. Run the dev server
npm run dev

# 5. Open http://localhost:3000
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key (required) |

## API Reference

### `POST /api/agent`

The main agent endpoint. Accepts a conversation and returns a streaming response.

**Request body:**
```json
{
  "messages": [
    { "role": "user", "content": "Recommend a vegetarian pizza" }
  ],
  "imageData": {
    "base64": "<base64 encoded image>",
    "mediaType": "image/jpeg"
  }
}
```

- `messages` — full conversation history in `{ role, content }` format
- `imageData` — optional; include when the user attaches a photo

**Response:** `text/event-stream` in Vercel AI SDK data stream format

### `GET /api/catalog`

Returns the full menu catalog.

**Response:**
```json
{
  "items": [...],
  "categories": ["pizza", "sides", "drinks", "desserts"],
  "specials": [...]
}
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx              # Homepage
│   ├── layout.tsx            # Root layout
│   └── api/
│       ├── agent/route.ts    # POST /api/agent
│       └── catalog/route.ts  # GET /api/catalog
├── components/
│   ├── layout/Header.tsx
│   ├── menu/MenuGrid.tsx
│   ├── menu/MenuCard.tsx
│   ├── cart/CartDrawer.tsx
│   └── agent/
│       ├── ChatWidget.tsx    # Floating chat button + panel
│       ├── ChatPanel.tsx     # Message list + input bar
│       ├── MessageBubble.tsx # Parses [PRODUCT:id] markers → inline cards
│       ├── VoiceButton.tsx
│       └── ImageUpload.tsx
├── data/catalog.ts           # 20 menu items
├── lib/
│   ├── agent-tools.ts        # Claude tool definitions
│   └── catalog-search.ts     # Fuzzy search algorithm
├── hooks/
│   ├── useVoiceInput.ts
│   └── useImageUpload.ts
├── store/cart.ts             # Zustand cart
└── types/
    ├── catalog.ts
    ├── agent.ts
    └── cart.ts
```

## Deployment

### Deploy to Vercel (Recommended)

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your repo
3. Vercel auto-detects Next.js — no build configuration needed
4. In **Settings → Environment Variables**, add `ANTHROPIC_API_KEY`
5. Click **Deploy**

Every `git push main` triggers an automatic redeploy.

The `vercel.json` sets a 30-second timeout on the agent route to accommodate multi-step tool calls.

## Voice Input Notes

Voice uses the browser's native `SpeechRecognition` API — no Whisper or external service. Supported in Chrome and Safari. Firefox users will see a fallback message.

## Image Search Notes

Images are resized client-side to max 800px before sending (keeps API payloads under ~200KB). Claude's vision capability identifies the food in the photo, extracts search terms, and calls `search_catalog` to find similar items in the catalog.

