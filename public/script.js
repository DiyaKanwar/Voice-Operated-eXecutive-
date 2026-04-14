
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

// ─── State Machine ────────────────────────────────────────────────────────────
// idle | listening | thinking | speaking | error


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
  // Inject optional task badge
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

// ─── Claude API ───────────────────────────────────────────────────────────────
async function askClaude(message) {
  debugLog(`→ Claude: "${message}"`);
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Server error ${res.status}`);
  }
  const data = await res.json();
  if (!data.reply) throw new Error('Empty response');
  return data.reply;
}

// ─── TASK ENGINE ──────────────────────────────────────────────────────────────
// Each task: { match: fn(lower) => bool, execute: fn(lower, raw) => string | Promise<string>, label: string }
// Tasks run BEFORE Claude is called. First match wins.

function openUrl(url, spoken) {
  window.open(url, '_blank');
  return spoken;
}

function getWeatherText(lower) {
  // Extract city from "weather in London" or "weather London" or just "weather"
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
  // Strip command words to get the actual query
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
  // Extract math expression
  let expr = raw
    .replace(/^(calculate|compute|what is|what's|whats|solve|evaluate)\s*/i,'')
    .replace(/\btimes\b/gi,'*').replace(/\bdivided by\b/gi,'/').replace(/\bplus\b/gi,'+').replace(/\bminus\b/gi,'-')
    .replace(/\bsquared\b/gi,'**2').replace(/\bcubed\b/gi,'**3')
    .replace(/[^0-9+\-*/().\s**]/g,'').trim();
  try {
    // Safe eval using Function
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

// Task registry
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
  {
    label: 'TIME',
    match: l => /\b(what(?:'s| is)(?: the)? time|tell me the time|current time)\b/.test(l),
    execute: () => `The current time is ${new Date().toLocaleTimeString('en-US', {hour:'2-digit', minute:'2-digit'})}.`
  },
  // ── Date ──
  {
    label: 'DATE',
    match: l => /\b(what(?:'s| is)(?: the)? date|what day|today(?:'s| is)? date|what is today)\b/.test(l),
    execute: () => `Today is ${new Date().toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}.`
  },
  // ── Timer ──
  {
    label: 'TIMER',
    match: l => /\b(set|start|create)?\s*(?:a\s+)?timer\b/.test(l) && /\d+/.test(l),
    execute: (l) => doTimer(l)
  },
  // ── Calculator ──
  {
    label: 'CALCULATE',
    match: l => /\b(calculate|compute|what(?:'s| is)\s+[\d]|solve|evaluate)\b/.test(l) && /[\d+\-*/]/.test(l),
    execute: (l,r) => doCalculate(l,r)
  },
  // ── YouTube ──
  {
    label: 'YOUTUBE',
    match: l => /\byoutube\b/.test(l) || /\bplay\s+.+\b/.test(l),
    execute: (l,r) => doYouTube(r)
  },
  // ── Spotify ──
  {
    label: 'SPOTIFY',
    match: l => /\bspotify\b/.test(l) || (/\bplay\b/.test(l) && /\bmusic\b/.test(l)),
    execute: (l,r) => doSpotify(r)
  },
  // ── Weather ──
  {
    label: 'WEATHER',
    match: l => /\bweather\b/.test(l),
    execute: (l) => getWeatherText(l)
  },
  // ── News ──
  {
    label: 'NEWS',
    match: l => /\b(news|headlines|latest)\b/.test(l),
    execute: (l) => doNews(l)
  },
  // ── Wikipedia ──
  {
    label: 'WIKIPEDIA',
    match: l => /\b(wikipedia|wiki|tell me about|who is|what is)\b.{3,}/.test(l) && !/\bweather\b/.test(l),
    execute: (l,r) => doWikipedia(r)
  },
  // ── Maps / Navigation ──
  {
    label: 'MAPS',
    match: l => /\b(navigate|directions|map(s)?|where is|locate)\b/.test(l),
    execute: (l,r) => doMaps(r)
  },
  // ── Currency ──
  {
    label: 'CURRENCY',
    match: l => /\b(convert|currency|exchange rate|usd|inr|eur|gbp|jpy)\b/.test(l) && /\bto\b/.test(l),
    execute: (l) => doCurrency(l)
  },
  // ── Translate ──
  {
    label: 'TRANSLATE',
    match: l => /\b(translate|how do you say|in (hindi|spanish|french|german|japanese|arabic|chinese|punjabi|urdu))\b/.test(l),
    execute: (l,r) => doTranslate(r)
  },
  // ── Email ──
  {
    label: 'EMAIL',
    match: l => /\b(open (my )?email|check (my )?email|gmail|inbox)\b/.test(l),
    execute: () => doEmail()
  },
  // ── Search (general — must be near end so specific ones above take priority) ──
  {
    label: 'SEARCH',
    match: l => /\b(search|google|look up|find|look for)\b/.test(l),
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

  // 1. Try task engine first
  for (const task of TASKS) {
    if (task.match(lower)) {
      debugLog(`Task matched: ${task.label}`);
      const reply = await Promise.resolve(task.execute(lower, raw));
      speakAndShow(reply, task.label);
      return;
    }
  }

  // 2. Fallback to Claude AI
  debugLog('No task match → Claude AI');
  setState('thinking');
  showSubtitle('Thinking…', null, false);

  try {
    const reply = await askClaude(raw);
    speakAndShow(reply, 'AI');
  } catch (err) {
    debugLog(`Claude error: ${err.message}`);
    let msg;
    if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
      msg = 'Network error. Please check your connection.';
    } else if (err.message.toLowerCase().includes('api key') || err.message.includes('401')) {
    msg = 'API key not configured. Please set GROQ_API_KEY in your environment variables.';
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
  r.lang           = 'en-US';
  r.continuous     = false;
  r.interimResults = false;
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
    speakAndShow('VOX online. Awaiting your command.', null, false);

    setTimeout(() => {
      setState('listening');
      try { recognition.start(); }
      catch(e) {
        debugLog(`Start error: ${e.message}`);
        speakAndShow("Couldn't start listening. Please try again.");
      }
    }, 1500);
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
    speakAndShow('VOX online. All systems operational. Press Activate to begin.', null, false);
  }, 600);
});
