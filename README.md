# VOX — Voice Operated eXecutive

> A browser-based AI voice assistant built by [Diya Kanwar](https://github.com/DiyaKanwar).  
> Speaks to you, listens to you, and answers using Groq's LLaMA AI.

---

## What This Does

You click the mic, say something, and VOX either:
- **Runs a built-in task instantly** (set timer, do math, open YouTube, etc.) — no API call
- **Asks Groq AI** for anything else and speaks the answer back to you

---

## Tech Used

| Layer | Technology |
|---|---|
| UI | HTML, CSS, Vanilla JavaScript |
| Voice Input | Web Speech API — `SpeechRecognition` |
| Voice Output | Web Speech API — `SpeechSynthesis` |
| AI | Groq API — `llama-3.1-8b-instant` model |
| Server | Node.js (built-in `http` module, no Express) |
| Config | `dotenv` for API key loading |

---

## How It Works

```
You speak
   ↓
SpeechRecognition converts audio → text
   ↓
script.js checks against built-in task patterns (regex)
   ↓
Match found?  ──YES──→ Run task locally (instant, no network)
   ↓ NO
POST /api/chat → server.js → Groq API → LLaMA 3.1
   ↓
Reply text → SpeechSynthesis speaks it aloud
```

### SpeechRecognition (voice input)
Built into Chrome/Edge. Streams mic audio and returns a text transcript. VOX uses `continuous: false` so it listens for one command at a time and stops automatically after a pause. Requires HTTPS or localhost — browsers block mic on plain HTTP.

### SpeechSynthesis (voice output)
Also built into the browser. Converts any text string to spoken audio using the OS voice engine. VOX keeps AI replies under 150 tokens so the spoken response stays short and natural.

### Groq API
Groq runs open-source LLMs on custom hardware (LPUs) making inference extremely fast — usually under 500ms. The model `llama-3.1-8b-instant` is free tier, no credit card needed. The API key lives only in `server.js` via environment variables and is never exposed to the browser.

---

## File Structure

```
vox/
├── public/
│   ├── index.html     # UI — mic button, rings, response panel
│   ├── style.css      # Styling
│   └── script.js      # Voice recognition + task engine + API calls
├── api/
│   └── chat.js        # Serverless stub for Vercel routing
├── server.js          # Node.js server + Groq API proxy
├── package.json
├── .env               # Your API key (never commit this)
└── .gitignore
```

---

## Built-in Tasks

These run instantly with no AI or network call:

| Say something like… | What happens |
|---|---|
| "Set a timer for 10 minutes" | Countdown timer starts |
| "Calculate 340 divided by 7" | Math result spoken |
| "What time is it?" | Current time/date |
| "Search for best laptops" | Opens Google |
| "Play lo-fi on YouTube" | Opens YouTube search |
| "Weather in Mumbai" | Opens weather lookup |
| "Navigate to Connaught Place" | Opens Google Maps |
| "Tell me about Nikola Tesla" | Opens Wikipedia |
| "Translate hello in Hindi" | Opens Google Translate |
| "Open Gmail" | Opens Gmail |

Anything not matched above goes to Groq AI.

---

## Running Locally

**Requirements:** Node.js v18+, Chrome or Edge, a free Groq API key

```bash
# 1. Clone
git clone https://github.com/DiyaKanwar/vox.git
cd vox

# 2. Install
npm install

# 3. Add your API key — create a .env file in the root
GROQ_API_KEY=gsk_your_key_here

# 4. Start
npm run dev

# 5. Open in Chrome or Edge
http://localhost:3000
```

Get your free Groq key at [console.groq.com](https://console.groq.com) → API Keys → Create API Key

---

## Deploying to Vercel

1. Push this repo to GitHub
2. Go to [vercel.com](https://vercel.com) → Add New Project → import your repo → Deploy
3. In Vercel → Settings → Environment Variables → add `GROQ_API_KEY` → Save
4. Deployments → Redeploy (required so Vercel picks up the new key)

---

## Notes

- Chrome or Edge only — Firefox has no Web Speech API support
- API key is never exposed to the browser — only lives in the server environment
- Speech recognition only works on HTTPS or localhost