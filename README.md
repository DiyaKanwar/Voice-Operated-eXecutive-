# VOX — Voice Operated eXecutive

> An AI-powered voice assistant that executes tasks instantly and falls back to Claude AI for everything else.

---

## What VOX Can Do

**Built-in tasks (instant, no AI needed):**
- Set timers ("set a timer for 10 minutes")
- Do math ("calculate 250 divided by 7")
- Tell time and date
- Search Google ("search for best laptops 2025")
- Open YouTube ("play lo-fi music on YouTube")
- Check weather ("weather in Mumbai")
- Open Spotify ("play jazz on Spotify")
- Navigate maps ("navigate to Connaught Place")
- Look up Wikipedia ("tell me about Nikola Tesla")
- Convert currency ("100 USD to INR")
- Translate text ("translate hello in Hindi")
- Open Gmail
- Show news headlines

**Claude AI fallback:** Anything not matched above is sent to Claude AI and answered conversationally.

---

## Deploy to Vercel (5 minutes)

### Step 1 — Get your API key
1. Go to https://console.anthropic.com
2. Create an account (free tier available)
3. Go to **API Keys** → click **Create Key**
4. Copy the key (starts with `sk-ant-...`)

### Step 2 — Push to GitHub
1. Create a new repo on https://github.com/new
2. Upload all files from this folder (drag & drop works)
3. Commit

### Step 3 — Deploy on Vercel
1. Go to https://vercel.com → **Add New Project**
2. Import your GitHub repo
3. Click **Deploy** (default settings work)

### Step 4 — Add your API key
1. In Vercel → your project → **Settings** → **Environment Variables**
2. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your key from Step 1
3. Click **Save**
4. Go to **Deployments** → click **Redeploy** (top right → Redeploy)

### Done!
Your VOX instance is live at `https://your-project.vercel.app`

---

## Run Locally

```bash
# Install Vercel CLI
npm install -g vercel

# In the project root
vercel dev
```

Then set your API key locally:
```bash
# Create .env.local file
echo "ANTHROPIC_API_KEY=sk-ant-your-key-here" > .env.local
```

Open `http://localhost:3000` in Chrome or Edge.

---

## Notes
- Use **Google Chrome** or **Microsoft Edge** — Firefox does not support Web Speech API
- Must be on HTTPS (Vercel handles this automatically) or localhost
- The API key is **never** exposed to the browser — it only lives in Vercel's server environment
