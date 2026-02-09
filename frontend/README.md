# SuperBryn Frontend

A Next.js frontend for the **SuperBryn AI Voice Assistant** — featuring a Tavus avatar, live chat transcript, and conversation summary panel.

## Tech Stack

| Layer       | Tool                                     |
| ----------- | ---------------------------------------- |
| Framework   | Next.js 15 (App Router)                  |
| Language    | TypeScript                               |
| Styling     | Tailwind CSS 3                           |
| Animation   | Framer Motion 11                         |
| Voice/Video | LiveKit Client SDK + Components React    |
| Avatar      | Tavus (rendered via LiveKit video track) |

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Copy the env template and set your backend URL
cp .env.local.example .env.local
# Edit .env.local → NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

| Variable                  | Description                                                        |
| ------------------------- | ------------------------------------------------------------------ |
| `NEXT_PUBLIC_BACKEND_URL` | URL of the deployed FastAPI backend (e.g. your Railway deployment) |

## Project Structure

```
src/
├── app/
│   ├── layout.tsx        # Root layout (fonts, grain overlay)
│   ├── page.tsx          # Main page: Welcome ↔ LiveKit Room
│   └── globals.css       # Tailwind + custom animations
├── components/
│   ├── AvatarDisplay.tsx  # Tavus video with ambient glow
│   ├── ChatPanel.tsx      # Chat-style transcript
│   ├── SummaryPanel.tsx   # Post-call summary cards
│   └── Controls.tsx       # Mic mute / End call
├── hooks/
│   ├── useTranscript.ts   # Collects LiveKit transcription events
│   └── useCallSummary.ts  # Listens for agent call_summary data
└── lib/
    ├── api.ts             # Backend HTTP client
    └── types.ts           # Shared TypeScript types
```

## How It Works

1. User clicks **Start Conversation** → frontend requests a LiveKit token from the backend `POST /token`.
2. Frontend connects to the LiveKit room; the agent auto-joins and Tavus avatar appears.
3. Speech is transcribed in real-time and displayed in the **Chat** tab.
4. Agent state (listening / thinking / speaking) drives visual indicators on the avatar and chat panel.
5. When the agent calls `end_conversation`, it publishes a `call_summary` data message. The frontend receives it, auto-switches to the **Summary** tab, and renders structured appointment cards.

## Deployment

Deploy to **Vercel** or **Netlify**:

```bash
npm run build   # produces .next/
npm start       # runs production server
```

Set `NEXT_PUBLIC_BACKEND_URL` as an environment variable in your hosting provider's dashboard.

## Design

**"Obsidian & Amber"** — a luxe dark theme with warm amber accents, subtle grain texture, glass-morphism panels, and refined typography (Instrument Serif + Plus Jakarta Sans).
