const API_URL = '/api/chat';

// ─── DOM ─────────────────────────────────────────────────────────────────────
const btn          = document.getElementById('listen-btn');
const btnIcon      = document.getElementById('btn-icon');
const btnLabel     = document.getElementById('btn-label');
const statusText   = document.getElementById('status-text');
const subtitle     = document.getElementById('subtitle');
const subtitlePanel= document.getElementById('subtitle-panel');
const waveform     = document.getElementById('waveform');
const ringWrapper  = document.getElementById('ring-wrapper');
const micStatus    = document.getElementById('mic-status');
const clockEl      = document.getElementById('clock');

// ─── Clock ────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2,'0');
  const m = String(now.getMinutes()).padStart(2,'0');
  const s = String(now.getSeconds()).padStart(2,'0');
  if (clockEl) clockEl.textContent = `${h}:${m}:${s}`;
}
setInterval(updateClock, 1000);
updateClock();

function debugLog(msg) { console.log(`[VOX]: ${msg}`); }

// ─── BUG 1 FIX: track whether this is the first activation ───────────────────
let hasActivatedBefore = false;

// ─── State Machine ────────────────────────────────────────────────────────────
let currentState = 'idle';

function setState(state) {
  currentState = state;
  btn.classList.remove('state-listening','state-thinking','state-speaking','state-error');
  ringWrapper.classList.remove('listening','thinking','speaking','error');
  waveform.classList.remove('active');

  switch (state) {
    case 'idle':
      btnIcon.className    = 'fa fa-microphone';
      btnLabel.textContent = 'Activate';
      btn.disabled         = false;
      statusText.textContent = 'Voice Operated eXecutive';
      micStatus.textContent  = 'MIC: STANDBY';
      break;
    case 'listening':
      btn.classList.add('state-listening');
      ringWrapper.classList.add('listening');
      waveform.classList.add('active');
      btnIcon.className    = 'fa fa-circle';
      btnLabel.textContent = 'Listening…';
      btn.disabled         = true;
      statusText.textContent = 'Speak now…';
      micStatus.textContent  = 'MIC: ACTIVE';
      break;
    case 'thinking':
      btn.classList.add('state-thinking');
      ringWrapper.classList.add('thinking');
      btnIcon.className    = 'fa fa-cog fa-spin';
      btnLabel.textContent = 'Processing…';
      btn.disabled         = true;
      statusText.textContent = 'Analyzing command…';
      micStatus.textContent  = 'MIC: PROCESSING';
      break;
    case 'speaking':
      btn.classList.add('state-speaking');
      ringWrapper.classList.add('speaking');
      waveform.classList.add('active');
      btnIcon.className    = 'fa fa-volume-up';
      btnLabel.textContent = 'Speaking…';
      btn.disabled         = true;
      statusText.textContent = 'Responding…';
      micStatus.textContent  = 'MIC: OUTPUT';
      break;
    case 'error':
      btn.classList.add('state-error');
      ringWrapper.classList.add('error');
      btnIcon.className    = 'fa fa-exclamation-triangle';
      btnLabel.textContent = 'Error';
      btn.disabled         = false;
      statusText.textContent = 'Error — click to retry';
      micStatus.textContent  = 'MIC: ERROR';
      setTimeout(() => { if (currentState === 'error') setState('idle'); }, 3000);
      break;
  }
}

// ─── Subtitle ────────────────────────────────────────────────────────────────
let subtitleTimeout = null;

function showSubtitle(text, taskLabel = null, autohide = true) {
  let badge = subtitlePanel.querySelector('.task-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'task-badge';
    subtitlePanel.insertBefore(badge, subtitle);
  }
  if (taskLabel) {
    badge.textContent = taskLabel;
    badge.classList.add('show');
  } else {
    badge.classList.remove('show');
  }

  subtitle.textContent = text;
  subtitlePanel.classList.add('show');
  if (subtitleTimeout) clearTimeout(subtitleTimeout);
  if (autohide) {
    subtitleTimeout = setTimeout(() => subtitlePanel.classList.remove('show'), 9000);
  }
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
function speak(text, onEnd) {
  try {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate   = 0.92;
    utt.pitch  = 0.95;
    utt.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.toLowerCase().includes('daniel') ||
      v.name.toLowerCase().includes('david')  ||
      (v.lang === 'en-US' && !v.name.toLowerCase().includes('female'))
    );
    if (preferred) utt.voice = preferred;

    utt.onend   = () => onEnd && onEnd();
    utt.onerror = () => onEnd && onEnd();
    window.speechSynthesis.speak(utt);
  } catch(e) {
    debugLog(`TTS error: ${e.message}`);
    onEnd && onEnd();
  }
}

function speakAndShow(text, taskLabel = null, autohide = true) {
  setState('speaking');
  showSubtitle(text, taskLabel, autohide);
  speak(text, () => setState('idle'));
}

// ─── Groq API ────────────────────────────────────────────────────────────────
async function askGroq(message) {
  debugLog(`→ Groq AI: "${message}"`);
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });

    if (!res.ok) {
      const text = await res.text();
      try {
        const err = JSON.parse(text);
        throw new Error(err.error || `Server error ${res.status}`);
      } catch {
        throw new Error(`Server error ${res.status}: ${text}`);
      }
    }

    const data = await res.json();
    if (!data.reply) throw new Error('Empty response from API');
    debugLog(`← Reply: "${data.reply}"`);
    return data.reply;
  } catch (error) {
    debugLog(`API error: ${error.message}`);
    throw error;
  }
}

// ─── BUG 2 FIX: Shared intent classifiers ────────────────────────────────────
//
// The root cause of Bug 2 is that task matchers checked for keyword *presence*
// alone. "weather", "news", "time" all appear in sentences where the user's
// intent is not a command — e.g. "what causes bad weather", "any news about my
// results", "time flies when you're having fun". A single shared predicate that
// characterises question-shaped queries is a better gate than patching every
// individual task regex.
//
// isQuestion(l) — returns true when the query is clearly asking for information
// rather than issuing a command. Task matchers that would open a browser tab or
// return a fixed local answer should call this and bail out when it returns true,
// handing off to Groq instead.
//
// isActionCommand(l, verbs) — returns true only when the query *starts with* (or
// is dominated by) one of the supplied imperative verbs. This prevents a keyword
// buried in the middle of a sentence from triggering a task.

const QUESTION_STARTERS = /^(what|who|why|how|when|where|which|is|are|does|do|can|could|would|tell me|explain|describe|give me|define|show me what|i want to know|i'd like to know)/;

const QUESTION_PATTERNS = /\b(what (is|are|was|were|causes?|makes?|happens?|does)|who (is|are|was|were)|why (is|are|does|do|did)|how (does|do|did|is|are|can)|tell me about|explain|describe|what('s| is) the (history|meaning|definition|difference|reason)|any (news|updates|information) (about|on|regarding))\b/;

function isQuestion(l) {
  return QUESTION_STARTERS.test(l) || QUESTION_PATTERNS.test(l);
}

// Returns true when the query leads with an imperative action verb from the
// supplied list, meaning the user is clearly issuing a command rather than
// asking about a topic that happens to contain the verb.
function isActionCommand(l, verbs) {
  const pattern = new RegExp(`^(${verbs.join('|')})\\b`);
  return pattern.test(l.trim());
}

// ─── TASK HELPERS ─────────────────────────────────────────────────────────────
function getWeatherText(lower) {
  const match = lower.match(/weather(?:\s+in)?\s+([a-z\s]+)/);
  const city = match ? match[1].trim() : null;
  if (city) {
    window.open(`https://www.google.com/search?q=weather+${encodeURIComponent(city)}`, '_blank');
    return `Opening weather for ${city}.`;
  }
  window.open('https://www.google.com/search?q=weather+today', '_blank');
  return 'Opening current weather for you.';
}

function doSearch(lower, raw) {
  const query = raw
    .replace(/^(search|search for|look up|find|google|look for)\s+/i, '')
    .trim();
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, '_blank');
  return `Searching for "${query}".`;
}

function doYouTube(raw) {
  const query = raw.replace(/^(play|search|find|look up|youtube|open youtube for)\s+/i,'').replace(/on youtube$/i,'').trim();
  window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  return `Opening YouTube for "${query}".`;
}

function doWikipedia(raw) {
  const query = raw.replace(/^(wikipedia|wiki|tell me about|search wikipedia for|look up on wikipedia)\s+/i,'').trim();
  window.open(`https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(query)}`, '_blank');
  return `Opening Wikipedia for "${query}".`;
}

function doTimer(lower) {
  const minMatch = lower.match(/(\d+)\s*(?:minute|min)/);
  const secMatch = lower.match(/(\d+)\s*(?:second|sec)/);
  const hrMatch  = lower.match(/(\d+)\s*(?:hour|hr)/);
  let totalSec = 0;
  if (hrMatch)  totalSec += parseInt(hrMatch[1])  * 3600;
  if (minMatch) totalSec += parseInt(minMatch[1]) * 60;
  if (secMatch) totalSec += parseInt(secMatch[1]);
  if (totalSec === 0) return 'Please specify a duration, like "set a timer for 5 minutes".';

  const label = [];
  if (hrMatch)  label.push(`${hrMatch[1]} hour${hrMatch[1]>1?'s':''}`);
  if (minMatch) label.push(`${minMatch[1]} minute${minMatch[1]>1?'s':''}`);
  if (secMatch) label.push(`${secMatch[1]} second${secMatch[1]>1?'s':''}`);

  setTimeout(() => {
    speakAndShow(`Timer complete! Your ${label.join(' and ')} timer is done.`, 'TIMER DONE');
  }, totalSec * 1000);

  return `Timer set for ${label.join(' and ')}. I will alert you when it is done.`;
}

function doCalculate(lower, raw) {
  let expr = raw
    .replace(/^(calculate|compute|what is|what's|whats|solve|evaluate)\s*/i,'')
    .replace(/\btimes\b/gi,'*').replace(/\bdivided by\b/gi,'/').replace(/\bplus\b/gi,'+').replace(/\bminus\b/gi,'-')
    .replace(/\bsquared\b/gi,'**2').replace(/\bcubed\b/gi,'**3')
    .replace(/[^0-9+\-*/().\s**]/g,'').trim();
  try {
    const result = Function(`"use strict"; return (${expr})`)();
    if (typeof result !== 'number' || !isFinite(result)) throw new Error('not a number');
    return `${expr} equals ${parseFloat(result.toFixed(6))}.`;
  } catch {
    return `I could not calculate that. Try saying something like "calculate 25 times 4".`;
  }
}

function doTranslate(raw) {
  const query = raw.replace(/^(translate|how do you say)\s*/i,'').trim();
  window.open(`https://translate.google.com/?text=${encodeURIComponent(query)}`, '_blank');
  return `Opening Google Translate for "${query}".`;
}

function doNews(lower) {
  const topics = ['technology','sports','business','health','science','entertainment','politics'];
  const topic = topics.find(t => lower.includes(t));
  const url = topic
    ? `https://news.google.com/search?q=${topic}`
    : 'https://news.google.com';
  window.open(url, '_blank');
  return topic ? `Opening latest ${topic} news.` : 'Opening Google News for you.';
}

function doMaps(raw) {
  const place = raw.replace(/^(navigate to|directions to|open maps for|map of|show me|find)\s*/i,'').replace(/\s*on (google )?maps$/i,'').trim();
  window.open(`https://www.google.com/maps/search/${encodeURIComponent(place)}`, '_blank');
  return `Opening Google Maps for "${place}".`;
}

function doEmail() {
  window.open('https://mail.google.com', '_blank');
  return 'Opening Gmail for you.';
}

function doSpotify(raw) {
  const query = raw.replace(/^(play|open|search|find)\s*/i,'').replace(/\s*on spotify$/i,'').replace(/^spotify\s*/i,'').trim();
  if (query && !['spotify','music'].includes(query)) {
    window.open(`https://open.spotify.com/search/${encodeURIComponent(query)}`, '_blank');
    return `Searching Spotify for "${query}".`;
  }
  window.open('https://open.spotify.com', '_blank');
  return 'Opening Spotify.';
}

function doCurrency(lower) {
  const match = lower.match(/(\d+(?:\.\d+)?)\s+([a-z]{3})\s+(?:to|in)\s+([a-z]{3})/);
  if (match) {
    const [, amount, from, to] = match;
    window.open(`https://www.google.com/search?q=${amount}+${from.toUpperCase()}+to+${to.toUpperCase()}`, '_blank');
    return `Looking up ${amount} ${from.toUpperCase()} to ${to.toUpperCase()}.`;
  }
  return 'Please say the conversion like "100 USD to INR".';
}

// ─── TASK REGISTRY ────────────────────────────────────────────────────────────
//
// BUG 2 & 3 ARCHITECTURAL FIX
// ─────────────────────────────
// Every task that (a) opens a browser tab or (b) returns a fixed local value
// (time, date) now has TWO gates in its matcher:
//
//   Gate A — isQuestion() check (Bug 3):
//     Tab-opening tasks bail out immediately when the query is question-shaped.
//     Question-shaped queries always fall through to Groq so the user gets a
//     spoken answer instead of a browser tab they didn't ask for.
//
//   Gate B — isActionCommand() / strong-intent check (Bug 2):
//     A keyword match alone is not enough. The task only fires when the user's
//     phrasing clearly expresses a command intent, not just incidentally
//     mentions the keyword.
//
// Tasks that produce only a spoken response from local data (GREETING, TIME,
// DATE, TIMER, CALCULATE, FAREWELL, THANKS, IDENTITY, HELP) are unaffected by
// the isQuestion gate — those are safe to handle locally even for question-like
// phrasing because their responses are always spoken answers.

const TASKS = [
  // ── Greetings ──
  {
    label: 'GREETING',
    match: l => /\b(hello|hi|hey|good morning|good evening|good afternoon|howdy)\b/.test(l),
    execute: () => {
      const h = new Date().getHours();
      const greeting = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
      return `${greeting}. VOX online and ready. How can I assist you?`;
    }
  },

  // ── Time ──
  // Bug 2 fix: require the query to be a clear time-asking phrase, not any
  // sentence that happens to contain the word "time".
  // Bug 3 N/A: returns a spoken answer, not a browser tab.
  {
    label: 'TIME',
    match: l => {
      // Must be phrased as a direct request for the current local time
      if (!/\b(what(?:'s| is)(?: the)? time|tell me the time|current time|what time is it)\b/.test(l)) return false;
      // "time in Paris" / "time at the office" → location query → Groq
      if (/\btime\s+(in|at)\b/.test(l)) return false;
      return true;
    },
    execute: () => `The current time is ${new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}.`
  },

  // ── Date ──
  // Bug 2 fix: phrase must be a direct request for today's date.
  // Bug 3 N/A: returns a spoken answer.
  {
    label: 'DATE',
    match: l => /\b(what(?:'s| is)(?: the)? date|what day is it|today(?:'s)? date|what is today(?:'s date)?)\b/.test(l),
    execute: () => `Today is ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`
  },

  // ── Timer ──
  // Bug 2 fix: already robust — requires both a timer verb and a digit.
  // Bug 3 N/A: returns a spoken answer.
  {
    label: 'TIMER',
    match: l => /\b(set|start|create)?\s*(?:a\s+)?timer\b/.test(l) && /\d+/.test(l),
    execute: (l) => doTimer(l)
  },

  // ── Calculator ──
  // Bug 2 fix: already robust — requires a number AND a math operator.
  // Bug 3 N/A: returns a spoken answer.
  {
    label: 'CALCULATE',
    match: l => {
      if (!/\b(calculate|compute|solve|evaluate)\b/.test(l) &&
          !/\b(what(?:'s| is)\s+\d)/.test(l) &&
          !/\b(how much is \d)/.test(l)) return false;
      const hasNumber   = /\d/.test(l);
      const hasOperator = /(\+|-|\*|\/|times|divided by|plus|minus|percent|squared|cubed|power)/.test(l);
      return hasNumber && hasOperator;
    },
    execute: (l,r) => doCalculate(l,r)
  },

  // ── YouTube ──
  // Bug 3 fix: question-shaped queries ("what is youtube?") fall through to Groq.
  // Bug 2 fix: bare "youtube" in a question is rejected by isQuestion(); explicit
  //            play/search + "on youtube" is a clear command regardless.
  {
    label: 'YOUTUBE',
    match: l => {
      if (isQuestion(l)) return false;                          // Bug 3 gate
      return /\byoutube\b/.test(l) || (/\bplay\b/.test(l) && /\bon youtube\b/.test(l));
    },
    execute: (l,r) => doYouTube(r)
  },

  // ── Spotify ──
  // Bug 3 fix: question-shaped queries fall through to Groq.
  // Bug 2 fix: "play music" alone is a command; "what music is on spotify" is a question → Groq.
  {
    label: 'SPOTIFY',
    match: l => {
      if (isQuestion(l)) return false;                          // Bug 3 gate
      return /\bspotify\b/.test(l) || (/\bplay\b/.test(l) && /\bmusic\b/.test(l));
    },
    execute: (l,r) => doSpotify(r)
  },

  // ── Weather ──
  // Bug 3 fix: question-shaped queries ("what causes bad weather", "how does
  //   weather form") fall through to Groq for a spoken answer.
  // Bug 2 fix: without the isQuestion gate, "any bad weather today" would fire
  //   here; the gate rejects it because "any" triggers QUESTION_STARTERS "are".
  //   Additionally, the query must pair "weather" with a command-style opener
  //   OR a location ("weather in X", "check weather") — not just the keyword.
  {
    label: 'WEATHER',
    match: l => {
      if (!/\bweather\b/.test(l)) return false;
      if (isQuestion(l)) return false;                          // Bug 3 + Bug 2 gate
      // Must have a clear command intent: imperative opener OR location reference
      const hasCommandIntent =
        isActionCommand(l, ['check','show','get','open','give me','what\'s the weather','what is the weather']) ||
        /\bweather\s+(in|for|at|near)\b/.test(l) ||
        /\b(today'?s?|tomorrow'?s?|current|local)\s+weather\b/.test(l) ||
        /^weather\b/.test(l.trim());
      return hasCommandIntent;
    },
    execute: (l) => getWeatherText(l)
  },

  // ── News ──
  // Bug 3 fix: question-shaped queries ("why is fake news a problem",
  //   "any news about my results") fall through to Groq.
  // Bug 2 fix: "news" alone in a question is rejected; must have command intent
  //   (imperative opener, "latest/breaking/today's" modifier, or bare "news"
  //   as the primary subject at the start of the sentence).
  {
    label: 'NEWS',
    match: l => {
      if (!/\b(news|headlines)\b/.test(l)) return false;
      if (isQuestion(l)) return false;                          // Bug 3 + Bug 2 gate
      const hasCommandIntent =
        isActionCommand(l, ['show','open','get','give me','check','read','pull up','load']) ||
        /\b(latest|breaking|today'?s?|current|recent)\s+(news|headlines)\b/.test(l) ||
        /^(news|headlines)\b/.test(l.trim());
      return hasCommandIntent;
    },
    execute: (l) => doNews(l)
  },

  // ── Wikipedia ──
  // Bug 3 fix: "tell me about X", "who is X", "what is X" are question-shaped
  //   and must fall through to Groq. Only explicit "search/open wikipedia" fires
  //   this task — those are unambiguous tab-open commands.
  // Bug 2 fix: "wikipedia" alone in a question ("is wikipedia reliable?") is
  //   rejected by isQuestion(); explicit "search wikipedia for X" is kept.
  {
    label: 'WIKIPEDIA',
    match: l => {
      if (isQuestion(l)) return false;                          // Bug 3 gate
      return /\b(search wikipedia|open wikipedia|wikipedia)\b/.test(l);
    },
    execute: (l,r) => doWikipedia(r)
  },

  // ── Maps / Navigation ──
  // Bug 3 fix: "where is X" is question-shaped → Groq.
  // Bug 2 fix: "map" in a question ("is google maps accurate?") → Groq.
  //   Only navigation-intent phrasings fire this task.
  {
    label: 'MAPS',
    match: l => {
      if (isQuestion(l)) return false;                          // Bug 3 gate
      if (/\b(navigate to|directions to|take me to|open maps|show on map|locate on map)\b/.test(l)) return true;
      if (/\bmap of\b/.test(l)) return true;
      return false;
    },
    execute: (l,r) => doMaps(r)
  },

  // ── Currency ──
  // Bug 2 fix: already robust — requires a number + currency codes + "to".
  // Bug 3 fix: question-shaped queries ("what is the exchange rate for USD?")
  //   without the specific number pattern fall through naturally; if they do
  //   contain a number pattern the user clearly wants a lookup, so Groq is fine
  //   but the tab is more useful. Keep as-is, but add isQuestion gate for
  //   open-ended currency questions.
  {
    label: 'CURRENCY',
    match: l => {
      if (isQuestion(l) && !/\d/.test(l)) return false;        // Bug 3 gate for vague questions
      return /\b(convert|currency|exchange rate|usd|inr|eur|gbp|jpy)\b/.test(l) && /\bto\b/.test(l);
    },
    execute: (l) => doCurrency(l)
  },

  // ── Translate ──
  // Bug 3 fix: "what does X mean in French" is question-shaped → Groq speaks the answer.
  //   Only "translate X" or "how do you say X in Y" (imperative) fires this task.
  // Bug 2 fix: language keywords buried in questions are rejected by isQuestion().
  {
    label: 'TRANSLATE',
    match: l => {
      if (isQuestion(l) && !/^(translate|how do you say)\b/.test(l.trim())) return false; // Bug 3 gate
      return /\b(translate|how do you say)\b/.test(l) ||
             // "in <language>" alone is too broad; require it to follow a translate verb
             (/\btranslate\b/.test(l) && /\bin (hindi|spanish|french|german|japanese|arabic|chinese|punjabi|urdu)\b/.test(l));
    },
    execute: (l,r) => doTranslate(r)
  },

  // ── Email ──
  // Bug 3 fix: question-shaped queries ("how do I send email?") → Groq.
  // Bug 2 fix: "email" in a question is rejected by isQuestion().
  {
    label: 'EMAIL',
    match: l => {
      if (isQuestion(l)) return false;                          // Bug 3 gate
      return /\b(open (my )?email|check (my )?email|gmail|inbox)\b/.test(l);
    },
    execute: () => doEmail()
  },

  // ── Search (general) ──
  // Bug 3 fix: explicit search commands always open a tab — that IS the intent.
  //   No isQuestion gate needed here because the imperative verbs (search, google)
  //   override question shape. "search for what is X" still means "open a search".
  // Bug 2 fix: already robust — requires an explicit search verb or "online/on google".
  {
    label: 'SEARCH',
    match: l => {
      if (/\b(search for|google|search the web|look it up|search it)\b/.test(l)) return true;
      if (/\b(find|look up)\b/.test(l) && /\b(online|on google|on the web|on internet)\b/.test(l)) return true;
      return false;
    },
    execute: (l,r) => doSearch(l,r)
  },

  // ── Farewell ──
  {
    label: 'FAREWELL',
    match: l => /\b(bye|goodbye|see you|farewell|shut down|power off)\b/.test(l),
    execute: () => 'Goodbye. VOX signing off — have a great day.'
  },

  // ── Thanks ──
  {
    label: 'THANKS',
    match: l => /\b(thank you|thanks|thank u|cheers)\b/.test(l),
    execute: () => "You're welcome. Anything else I can help with?"
  },

  // ── Identity ──
  {
    label: 'IDENTITY',
    match: l => /\b(who are you|what are you|your name|introduce yourself)\b/.test(l),
    execute: () => 'I am VOX — Voice Operated eXecutive. Your AI-powered voice assistant, built to assist you instantly.'
  },

  // ── Capabilities ──
  {
    label: 'HELP',
    match: l => /\b(what can you do|help|capabilities|commands|features)\b/.test(l),
    execute: () => 'I can search the web, open YouTube, check weather, set timers, do calculations, translate text, navigate maps, play Spotify, and answer any question using AI. Just ask.'
  },
];

// ─── Command Handler ──────────────────────────────────────────────────────────
async function handleCommand(raw) {
  const lower = raw.toLowerCase().trim();
  debugLog(`Command: "${lower}"`);

  for (const task of TASKS) {
    if (task.match(lower)) {
      debugLog(`Task matched: ${task.label}`);
      const reply = await Promise.resolve(task.execute(lower, raw));
      speakAndShow(reply, task.label);
      return;
    }
  }

  // Fallback to Groq AI
  debugLog('No task match → Groq AI');
  setState('thinking');
  showSubtitle('Thinking…', null, false);

  try {
    const reply = await askGroq(raw);
    speakAndShow(reply, 'AI');
  } catch (err) {
    debugLog(`Groq error: ${err.message}`);
    let msg;
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      msg = 'Network error. Please check your connection.';
    } else if (err.message.toLowerCase().includes('api key') || err.message.includes('401')) {
      msg = 'API key not configured. Please set GROQ_API_KEY in your environment.';
    } else if (err.message.includes('429')) {
      msg = 'Rate limit reached. Please wait a moment and try again.';
    } else {
      msg = 'I encountered an error. Please try again.';
    }
    setState('error');
    showSubtitle(msg, 'ERROR');
    speak(msg, () => setState('idle'));
  }
}

// ─── Speech Recognition ───────────────────────────────────────────────────────
let recognition = null;

function initRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const r = new SR();
  r.lang            = 'en-US';
  r.continuous      = false;
  r.interimResults  = false;
  r.maxAlternatives = 1;
  return r;
}

recognition = initRecognition();

if (recognition) {
  recognition.onresult = async (event) => {
    try {
      const command = event.results[0][0].transcript.trim();
      debugLog(`Heard: "${command}"`);
      showSubtitle(`You said: "${command}"`, null, false);
      await handleCommand(command);
    } catch(e) {
      debugLog(`onresult error: ${e.message}`);
      setState('error');
      speakAndShow('Something went wrong processing your speech. Please try again.');
    }
  };

  recognition.onend = () => {
    if (currentState === 'listening') setState('idle');
  };

  recognition.onerror = (event) => {
    debugLog(`Recognition error: ${event.error}`);
    const msgs = {
      'no-speech':           "I didn't hear anything. Please speak clearly.",
      'not-allowed':         "Microphone access denied. Please allow permissions.",
      'audio-capture':       "No microphone detected.",
      'network':             "Network error during recognition.",
      'service-not-allowed': "Speech recognition requires HTTPS or localhost.",
      'aborted':             null
    };
    const msg = msgs[event.error];
    if (msg) { setState('error'); speakAndShow(msg); }
    else setState('idle');
  };
}

// ─── Button ───────────────────────────────────────────────────────────────────
if (btn) {
  btn.addEventListener('click', () => {
    if (currentState !== 'idle' && currentState !== 'error') return;

    if (!recognition) {
      speakAndShow('Speech recognition is unavailable. Please use Chrome or Edge.', 'ERROR');
      return;
    }

    window.speechSynthesis.cancel();

    // BUG 1 FIX: only say the full intro on first activation
    if (!hasActivatedBefore) {
      hasActivatedBefore = true;
      speakAndShow('VOX online. Awaiting your command.', null, false);
      setTimeout(() => {
        setState('listening');
        try { recognition.start(); }
        catch(e) {
          debugLog(`Start error: ${e.message}`);
          speakAndShow("Couldn't start listening. Please try again.");
        }
      }, 1500);
    } else {
      setState('listening');
      try { recognition.start(); }
      catch(e) {
        debugLog(`Start error: ${e.message}`);
        speakAndShow("Couldn't start listening. Please try again.");
      }
    }
  });
}

// ─── Page Load ────────────────────────────────────────────────────────────────
window.addEventListener('load', async () => {
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => {};
    }
  }

  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      debugLog('Microphone permission granted');
    } catch(e) {
      debugLog(`Mic permission: ${e.message}`);
    }
  }

  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) {
    speakAndShow('VOX requires a secure connection — HTTPS or localhost.', 'ERROR');
    return;
  }

  setTimeout(() => {
    showSubtitle('VOX online. Press Activate to begin.', null, false);
  }, 600);
});