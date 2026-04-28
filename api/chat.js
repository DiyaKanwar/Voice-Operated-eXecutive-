import 'dotenv/config';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(500).json({ error: 'Use POST /api/chat endpoint' });
}
