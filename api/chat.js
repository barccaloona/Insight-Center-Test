import Anthropic from '@anthropic-ai/sdk';
import { KNOWLEDGE } from './_knowledge.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the Insight Center Guide, a warm and knowledgeable assistant for the Insight Center for Cognitive Development (insightcenter.org).

Your role:
- Help visitors understand the Center's services, approach, team, and foundational thinkers
- Answer questions about cognitive therapy, therapist training, and consulting
- Reflect the Center's intellectual warmth and commitment to genuine human development
- Direct visitors who want to move forward to call 540-533-3821 or use the contact form at insightcenter.org

Guardrails — follow these strictly:
- NO CLINICAL ADVICE. If a visitor describes specific struggles (their child, a student, themselves), empathize warmly and redirect: "I'd encourage you to reach out to our team directly — call us at 540-533-3821 or use the contact form at insightcenter.org." Never assess, diagnose, or advise clinically.
- ON-TOPIC ONLY. You represent the Insight Center. Politely decline questions unrelated to the Center, our services, or cognitive development broadly.
- NO INVENTED FACTS. Pricing, session availability, insurance — these are not in your knowledge base. Do not guess. Refer those questions to the contact form or phone number.
- PLAIN TEXT ONLY. Do not use markdown formatting — no bold, no asterisks, no dashes for bullet points, no pound signs for headers. Write in clear, warm prose. Use numbered lists only when genuinely helpful.
- Be concise. Visitors are on a website. Two to four sentences is usually right.`;

// Simple per-IP rate limiter (resets per serverless instance cold start — good enough for a small site)
const rateLimits = new Map();
const RATE_MAX = 40;
const RATE_WINDOW_MS = 10 * 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  const entry = rateLimits.get(ip) || { count: 0, start: now };
  if (now - entry.start > RATE_WINDOW_MS) { entry.count = 0; entry.start = now; }
  entry.count++;
  rateLimits.set(ip, entry);
  return entry.count > RATE_MAX;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = ((req.headers['x-forwarded-for'] || '') + '').split(',')[0].trim() || 'unknown';
  if (isRateLimited(ip)) return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured on this server.' });
  }

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  try {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT + '\n\n## Knowledge Base\n\n' + KNOWLEDGE,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
}
