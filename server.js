// server.js
import 'dotenv/config';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ FIX: Proper async function, no broken Promise wrapper
async function handleApiChat(req, res) {
  let body = '';

  // ✅ FIX: Wrap in a proper Promise so we can await it
  await new Promise((resolve, reject) => {
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', resolve);
    req.on('error', reject);
  });

  try {
    let message = '';
    if (body) {
      const parsed = JSON.parse(body);
      message = parsed.message || '';
    }

    if (!message || !message.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Message is required' }));
      return;
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API key not configured' }));
      return;
    }

    // ✅ FIX: Added timeout so request doesn't hang forever
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let groqResponse;
    try {
      groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: 'You are VOX, a smart voice assistant. Keep replies short and natural. Maximum 2-3 sentences.'
            },
            {
              role: 'user',
              content: message
            }
          ],
          max_tokens: 150
        })
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!groqResponse.ok) {
      const errData = await groqResponse.text();
      console.error(`Groq error: ${groqResponse.status}`, errData);
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Groq API error: ${groqResponse.status}` }));
      return;
    }

    const data = await groqResponse.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (!reply) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Empty response from AI' }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ reply }));

  } catch (error) {
    console.error('handleApiChat error:', error.message);
    // ✅ FIX: Check if headers already sent before writing error
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error: ' + error.message }));
    }
  }
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // ✅ FIX: Added await so errors are caught properly
  if (req.url === '/api/chat' && req.method === 'POST') {
    await handleApiChat(req, res);
    return;
  }

  // ✅ FIX: Decode URI so filenames with spaces/special chars work
  const urlPath = decodeURIComponent(req.url.split('?')[0]);
  let filePath = path.join(__dirname, 'public', urlPath === '/' ? 'index.html' : urlPath);

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };

    res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' });
    res.end(fs.readFileSync(filePath));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✓ VOX running at http://localhost:${PORT}`);
  console.log(`✓ API at http://localhost:${PORT}/api/chat`);
  console.log(`✓ Groq Key: ${process.env.GROQ_API_KEY ? 'loaded ✓' : 'MISSING ✗'}`);
});