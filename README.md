# Vox — Voice-Powered AI Assistant

> An AI-powered voice assistant that executes tasks instantly and falls back to Groq API for everything else.

---

## Features

### Voice Input (Speech Recognition)

**Groq AI fallback:** Anything not matched above is sent to Groq AI and answered conversationally.

---

## Tech Stack

### Step 1 — Get your API key
1. Go to https://console.groq.com
2. Create an account (free tier available)
3. Go to **API Keys** → click **Create API Key**
4. Copy the key (starts with `gsk_...`)

* HTML
* CSS
* JavaScript (Vanilla JS)
* Browser Speech Recognition API

### Backend

### Step 4 — Add your API key
1. In Vercel → your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `GROQ_API_KEY`
   - **Value:** your key from Step 1
3. Click **Save**
4. Go to **Deployments** → click **Redeploy** (top right → Redeploy)

### AI Integration

* Groq API (`llama3-8b-8192` model)

---

## Project Structure

For local development, you have two options:

**Option 1: Using npm (recommended for testing)**
```bash
npm install
npm run dev
```

Then open `http://localhost:3000` in Chrome or Edge.

**Option 2: Using Vercel CLI**
```bash
npm install -g vercel
npm run dev:vercel
```

Create `.env.local` in the project root:
```
GROQ_API_KEY=gsk_your_key_here
```

---

## Notes
- Use **Google Chrome** or **Microsoft Edge** — Firefox does not support Web Speech API
- Must be on HTTPS (Vercel handles this automatically) or localhost for production
- The API key is **never** exposed to the browser — it only lives in Vercel's server environment
- Built with Groq's LLaMA 3.1 8B for fast, cost-effective AI responses
- Supports voice recognition, speech synthesis, and task execution
