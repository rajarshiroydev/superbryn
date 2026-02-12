# SuperBryn — AI Voice Agent

A web-based AI voice agent with a live video avatar that conducts natural conversations and manages appointments (book, retrieve, modify, cancel). The agent identifies users by phone number, maintains full conversation context, and generates a structured summary at the end of each call.

---

## Architecture Overview

```
┌───────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                        │
│                                                                   │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────────────┐  │
│  │  Avatar   │  │   Chat    │  │ Controls │  │  Summary Panel │  │
│  │ Display   │  │  Panel    │  │  (Mic /  │  │  (end-of-call  │  │
│  │ (Tavus)   │  │ (realtime │  │  Hangup) │  │   recap)       │  │
│  │           │  │ transcript│  │          │  │                │  │
│  └────┬──────┘  └─────┬─────┘  └────┬─────┘  └───────┬────────┘  │
│       │               │             │                 │           │
│       └───────────────┴──────┬──────┴─────────────────┘           │
│                              │ LiveKit Client SDK                 │
│                              │ (WebRTC room)                      │
└──────────────────────────────┼────────────────────────────────────┘
                               │
                    LiveKit Cloud (WebRTC)
                               │
┌──────────────────────────────┼────────────────────────────────────┐
│                         Backend (Python)                          │
│                                                                   │
│  ┌──────────────────────┐   ┌─────────────────────────────────┐  │
│  │   FastAPI (api.py)   │   │   LiveKit Agent (agent.py)      │  │
│  │   • /token           │   │   • Deepgram STT (Nova-3)       │  │
│  │   • /users/*         │   │   • Groq LLM (Kimi K2)          │  │
│  │   • /slots           │   │   • Cartesia TTS (Sonic-3)      │  │
│  │   • /appointments/*  │   │   • Silero VAD                  │  │
│  │   • /summaries/*     │   │   • Tavus Avatar                │  │
│  │   • /health          │   │   • Noise Cancellation (BVC)    │  │
│  └──────────┬───────────┘   └──────────┬──────────────────────┘  │
│             │                          │                          │
│             └────────────┬─────────────┘                          │
│                          │                                        │
│            ┌─────────────▼──────────────┐                         │
│            │   Database Layer (db.py)   │                         │
│            │   • users                  │                         │
│            │   • appointments           │                         │
│            │   • slots                  │                         │
│            │   • call_summaries         │                         │
│            └─────────────┬──────────────┘                         │
│                          │                                        │
└──────────────────────────┼────────────────────────────────────────┘
                           │
                    Supabase (PostgreSQL)
```

The system runs two co-located backend processes (a FastAPI REST server and a LiveKit agent worker) behind a single Docker container. The frontend communicates with the backend in two ways:

1. **REST** — requests a LiveKit room token via `POST /token`.
2. **WebRTC** — once connected, all audio, video and data flow through a LiveKit room. The agent publishes transcription events, avatar video, and a `call_summary` data message at end-of-call.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Voice Framework** | [LiveKit Agents](https://docs.livekit.io/agents/) (Python SDK) | Real-time audio pipeline orchestration |
| **Speech-to-Text** | Deepgram Nova-3 (multi-language) | Live transcription of user speech |
| **Text-to-Speech** | Cartesia Sonic-3 | Natural voice synthesis for agent responses |
| **LLM** | Groq — Kimi K2 Instruct | Conversation reasoning & tool-call decisions |
| **Avatar** | Tavus | Lip-synced video avatar streamed via LiveKit |
| **VAD** | Silero | Voice activity detection for turn-taking |
| **Noise Cancel** | LiveKit BVC / BVC Telephony | Background noise suppression |
| **REST API** | FastAPI + Uvicorn | Token generation & CRUD endpoints |
| **Database** | Supabase (PostgreSQL) | Users, appointments, slots, call summaries |
| **Frontend** | Next.js 15, React 19, TypeScript | Single-page voice call interface |
| **UI Libraries** | LiveKit Components React, Framer Motion, Tailwind CSS | Real-time tracks, animations, styling |
| **Deployment** | Railway (Docker), Vercel / Netlify (frontend) | Cloud hosting |

---

## Features

### 1. Natural Voice Conversation
- Full-duplex audio over WebRTC via LiveKit.
- Deepgram Nova-3 provides low-latency speech recognition with live transcription streamed to the frontend.
- Cartesia Sonic-3 synthesizes the agent's spoken replies.
- Silero VAD handles turn-taking so the agent knows when the user has stopped speaking.
- LiveKit BVC noise cancellation filters out background noise.
- Maintains full conversation context across 5+ back-and-forth exchanges.

### 2. Live Video Avatar
- Tavus generates a photorealistic avatar whose lip movements are synced to the agent's TTS audio.
- The avatar video track is streamed through the LiveKit room and rendered in the frontend's `AvatarDisplay` component.
- Visual state badges indicate the agent's current mode: **Listening**, **Speaking**, **Processing…**, or **Connecting…**
- Ambient glow and animated ring effects pulse when the agent speaks.

### 3. Tool Calling (Appointment Management)
The agent has seven function tools it can invoke during a conversation:

| Tool | Description |
|---|---|
| `identify_user` | Looks up or creates a user record by 10-digit phone number. |
| `fetch_slots` | Returns available appointment slots, optionally filtered by date. |
| `book_appointment` | Books a slot for the identified user; prevents double-booking; marks the slot as taken. |
| `retrieve_appointments` | Fetches all appointments for the user (optionally filtered by status). |
| `cancel_appointment` | Cancels a booked appointment and frees the slot. |
| `modify_appointment` | Moves an appointment to a new date/time; validates availability. |
| `end_conversation` | Generates an LLM-powered call summary, saves it to the database, publishes it to the frontend, says goodbye, and disconnects. |

Each tool action is tracked with a timestamp so the call summary accurately reflects everything that happened during the call.

The agent automatically speaks confirmation messages aloud after booking, cancelling, or modifying an appointment using `session.say()` with interruptions disabled.

### 4. Real-Time Transcript
- The `useTranscript` hook listens for `TranscriptionReceived` events on the LiveKit room.
- Transcription segments are de-duplicated by segment ID, sorted chronologically, and rendered as chat bubbles in the `ChatPanel`.
- Interim (non-final) segments are shown at reduced opacity; final segments appear at full opacity.
- A "Processing request…" indicator with animated dots appears when the agent is in the `thinking` state (making a tool call).

### 5. Call Summary
At the end of every conversation:
1. The `end_conversation` tool collects all tracked tool-call actions.
2. A Groq LLM (Llama 3.3 70B) generates a structured JSON summary containing a natural-language overview and a list of appointment actions with exact dates/times.
3. The summary is saved to the `call_summaries` table in Supabase.
4. The summary JSON is published to the LiveKit room on the `call_summary` data topic.
5. The frontend's `useCallSummary` hook receives it, switches to the **Summary** tab, and renders the recap in the `SummaryPanel`.
6. The summary persists on screen after disconnection, with a "New Conversation" button to return home.

### 6. User Identification & Persistence
- The agent asks for the user's phone number at the start of every call.
- `identify_user` normalizes the number, looks it up in the `users` table, and creates a new record if needed.
- All appointments and summaries are keyed to the phone number, so returning users see their history.

### 7. REST API
The FastAPI server exposes endpoints that mirror the agent's tool capabilities, enabling external integrations or admin use:

- `POST /token` — Generate a LiveKit room access token.
- `POST /users/identify` — Look up or create a user.
- `GET /users/{phone_number}` — Fetch user details.
- `GET /slots` — List available appointment slots (optional date filter).
- `GET /appointments/{phone_number}` — List a user's appointments.
- `POST /appointments/book` — Book an appointment.
- `PUT /appointments/modify` — Modify an appointment.
- `DELETE /appointments/cancel` — Cancel an appointment.
- `GET /summaries/{phone_number}` — Fetch call summaries.
- `POST /summaries` — Save a call summary.
- `GET /health` — Health check.

---

## Database Schema (Supabase)

| Table | Key Columns |
|---|---|
| `users` | `phone_number` (PK), `name`, `created_at` |
| `slots` | `date`, `time`, `is_booked` |
| `appointments` | `phone_number`, `date`, `time`, `status` (booked/cancelled), `reason` |
| `call_summaries` | `phone_number`, `summary`, `created_at` |

---

## Frontend Design

The UI follows an **"Obsidian & Amber"** aesthetic — a luxe dark theme with warm amber accents, grain texture overlay, glass-morphism panels, and refined typography:

- **Fonts**: Instrument Serif (display) + Plus Jakarta Sans (body)
- **Layout**: Split-pane — avatar on the left, side panel (Chat / Summary tabs + controls) on the right.
- **Animations**: Framer Motion throughout — page transitions, staggered message reveals, tab switching, state badge changes.
- **Welcome screen**: Centered hero with ambient glow, decorative grid lines, and a pulsing "Start Conversation" button.

---

## Project Structure

```
super_bryn/
├── README.md
├── problem_statement.md        # Original assignment brief
├── skill.md                    # Frontend design skill prompt
│
├── backend/
│   ├── agent.py                # LiveKit agent entry point (Assistant class + session setup)
│   ├── api.py                  # FastAPI REST server (token, users, appointments, summaries)
│   ├── db.py                   # Supabase database helpers (CRUD for all tables)
│   ├── tools.py                # Function tools for the voice agent (7 tools + summary gen)
│   ├── pyproject.toml          # Python dependencies (uv/pip)
│   ├── Dockerfile              # Production container image
│   ├── start.sh                # Entrypoint — starts FastAPI + agent worker side-by-side
│   └── railway.toml            # Railway deployment configuration
│
└── frontend/
    ├── package.json            # Node dependencies (Next.js, LiveKit, Framer Motion)
    ├── next.config.ts
    ├── tailwind.config.ts
    ├── tsconfig.json
    └── src/
        ├── app/
        │   ├── layout.tsx      # Root layout (fonts, metadata, grain overlay)
        │   ├── page.tsx        # Main page (Welcome → LiveKit room flow)
        │   └── globals.css     # Tailwind base, grain texture, scrollbar, animations
        ├── components/
        │   ├── AvatarDisplay.tsx   # Tavus video track + state indicators
        │   ├── ChatPanel.tsx       # Real-time transcript chat bubbles
        │   ├── Controls.tsx        # Mic toggle + end-call button
        │   └── SummaryPanel.tsx    # Structured call summary display
        ├── hooks/
        │   ├── useTranscript.ts    # LiveKit transcription segment collector
        │   └── useCallSummary.ts   # Listens for call_summary data messages
        └── lib/
            ├── api.ts              # Backend HTTP client (getToken, getCallSummaries)
            └── types.ts            # Shared TypeScript interfaces
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `LIVEKIT_URL` | LiveKit Cloud WebSocket URL |
| `LIVEKIT_API_KEY` | LiveKit API key |
| `LIVEKIT_API_SECRET` | LiveKit API secret |
| `GROQ_API_KEY` | Groq API key for LLM access |
| `DEEPGRAM_API_KEY` | Deepgram API key for STT |
| `CARTESIA_API_KEY` | Cartesia API key for TTS |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_KEY` | Supabase anon/service key |
| `TAVUS_PERSONA_ID` | Tavus persona identifier |
| `TAVUS_REPLICA_ID` | Tavus replica identifier |
| `TAVUS_API_KEY` | Tavus API key |
| `FRONTEND_URL` | Allowed CORS origin(s), comma-separated |

### Frontend

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | Backend API base URL (default: `http://localhost:8080`) |

---

## Getting Started

### Prerequisites

- Python 3.12+
- [uv](https://github.com/astral-sh/uv) (Python package manager)
- Node.js 18+
- A Supabase project with `users`, `slots`, `appointments`, and `call_summaries` tables
- API keys for LiveKit, Deepgram, Cartesia, Groq, and Tavus

### Backend

```bash
cd backend
cp .env.example .env   # fill in your API keys
uv sync                # install dependencies
uv run uvicorn api:app --host 0.0.0.0 --port 8080 &   # start REST server
uv run python agent.py start                            # start agent worker
```

### Frontend

```bash
cd frontend
npm install
echo 'NEXT_PUBLIC_BACKEND_URL=http://localhost:8080' > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Start Conversation**, and begin talking.

### Docker (Production)

```bash
cd backend
docker build -t superbryn .
docker run --env-file .env -p 8080:8080 superbryn
```

The container runs both the FastAPI server and agent worker via `start.sh`. Deploy to Railway using the included `railway.toml`.

---

## Conversation Flow

1. User clicks **Start Conversation** → frontend requests a LiveKit token → joins the room.
2. Agent greets the user and asks for their phone number.
3. User speaks their phone number → agent calls `identify_user` → user record created or retrieved.
4. User requests an action (e.g. "I'd like to book an appointment"):
   - Agent calls `fetch_slots` → reads available times aloud.
   - User picks a slot → agent calls `book_appointment` → speaks confirmation.
5. User can also retrieve, modify, or cancel appointments in the same call.
6. User says goodbye → agent calls `end_conversation`:
   - LLM generates structured summary.
   - Summary saved to Supabase and published to the room.
   - Frontend switches to Summary tab and displays the recap.
   - Agent says goodbye and disconnects.
7. User sees the summary on screen and can start a new conversation.
