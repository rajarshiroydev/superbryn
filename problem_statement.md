# SuperBryn AI Engineer Task

# 🎙️ AI Voice Agent Assignment

**Welcome!** This assignment is your chance to build web-based AI voice agent with a visual avatar that can have natural conversations and book/retrieve appointments.

**Timeline:** **24-48 hrs** from receipt

**\*Expected Effort**: 3-6 hrs\*

---

## 🎯 What You'll Build

A web-based voice agent that:

- **Listens** to what users say (speech recognition)
- **Responds** naturally (synthesized voice)
- **Shows** a visual avatar (synced with speech)
- **Books/Retrieves** appointments automatically
- **Summarizes** each conversation (shown at the end of conversation)

---

## 🛠️ Your Tech Stack (Mostly Free!)

| Component           | Tool                        | Free Tier             |
| ------------------- | --------------------------- | --------------------- |
| **Voice Framework** | LiveKit Agents (Python)     | Cloud Free Tier       |
| **Speech → Text**   | Deepgram                    | 200 hours/month       |
| **Text → Speech**   | Cartesia                    | Check current limits  |
| **Avatar**          | Beyond Presence / Tavus     | Verify developer tier |
| **AI (LLM)**        | Your choice                 | See options below     |
| **WebApp**          | ReactJS on Netlify / Vercel | Generous Free Plan    |
| **Database**        | Supabase                    | Generous Free Plan    |

### 🧠 Choose Your LLM ( Note: using the paid models yields better results)

**OpenAI** / **Claude** 🤖

- First Class Features and API Availability
- Requires credit card

**Together AI / OpenRouter** 🌐

- Free credits available
- Multiple models

---

## ✅ Required Features

### 1. Voice Conversation

- Hear and understand user speech
- Respond naturally with voice
- Maintain conversation context
- Handle 5+ back-and-forth exchanges
- Response latency <3 seconds (can go upto 5 secs when making tool calls)
- The call interface is shown on a WebApp that you create (using web SDK allowed)

### 2. Avatar Integration

- Display visual avatar on WebApp using Beyond Presence / Tavus
- Sync avatar with voice output
- Maintain smooth video throughout conversation

### 3. Tool Calling

Classify user requests into these categories:

1. `identify_user` - Ask for user’s phone number to identify user
2. `fetch_slots` - _Assume hard-coded available slots_
3. `book_appointment` - Book appointment for user
   1. Create and save appointment records in DB against a user (id: `contact_number`)
   2. Confirm bookings verbally with all details
   3. Prevent double-booking at the same slot
4. `retrieve_appointments` - Fetches past appointments of user from database
5. `cancel_appointment` - Marks an appointment as cancelled
6. `modify_appointment` - Change date/time of an appointment
7. `end_conversation` - Ends call

**Must Extract:** Dates, times, names, contact info

**UI**: Whenever you make a tool call, it MUST be displayed on the WebApp in an intuitive visual manner

### 4. Call Summary

At conversation end:

- Generate summary of discussion
- List booked appointments
- Include user preferences mentioned
- Save with timestamp
- Display to user on WebApp before ending
- Generate full summary within 10 seconds

---

## 🌟 Deliverables

1. **Public GitHub repo** of the Voice Agent **backend**
2. **Public GitHub repo** of the Voice Agent **frontend**
3. **Deployed link** of the Voice Agent playground

---

## 📊 Evaluation Criteria

1. Functionality takes precedence over UI polish
   1. **Functionality broken**: Not acceptable
   2. **UI bad**: Acceptable, but a polished UI earns brownie points
2. Edge cases well thought through
   1. Do final end-to-end testing before submission
3. Documentation of known limitations (if any)
4. **_[Optional Bonus]_** Estimate and show cost incurred at the end of each call with breakup
