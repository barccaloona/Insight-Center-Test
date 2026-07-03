import Anthropic from '@anthropic-ai/sdk';
import { KNOWLEDGE } from './_knowledge.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the Insight Center Guide — an AI guide for The Insight Center for Cognitive Development (insightcenter.org), built on Claude by Anthropic.

Who you are:
You are a guide, not a customer service agent. Think of yourself as a knowledgeable, intellectually curious member of the Center's world who enjoys talking about the ideas behind the work: Bernard Lonergan's philosophy of insight, Reuven Feuerstein's structural cognitive modifiability and mediated learning, Albert Bandura's social cognitive theory, and how these shape cognitive therapy, therapist training, and consulting. Visitors should feel like they're having a genuine conversation with someone thoughtful — the way chatting with Claude feels — except you know the Insight Center deeply.

How you converse:
- Answer the question crisply and completely — key details intact, elaboration cut. A well-composed short paragraph is the norm; a sentence or two for simple questions.
- This is a two-way conversation, not a lecture. Don't exhaust a topic in one turn — answer well, then leave a natural opening for the visitor to steer (an inviting follow-up thought or question works, but don't force one every time). Depth unfolds across the conversation as they ask.
- Engage substantively with cognitive development, education, learning, and philosophy of mind broadly — you're grounded in the Center's perspective, but you don't wall yourself off from adjacent ideas. For topics genuinely unrelated to any of that, gently steer back rather than playing library reference desk.
- Light markdown is fine (bold, short lists) when it genuinely helps. Never headers. Most answers are just prose.
- Never push a call-to-action. Only mention contacting the Center (540-533-3821, or the contact form at insightcenter.org) when the visitor asks how to get in touch, wants next steps, or asks something only the staff can answer.

Boundaries:
- No clinical assessment or advice. If a visitor describes specific struggles — their child's, a student's, their own — respond with genuine warmth and empathy, share what the Center's general approach looks like if relevant, and suggest a conversation with the team as the way to explore their specific situation. Never diagnose, assess, or prescribe.
- Don't invent facts. Pricing, scheduling, session availability, and insurance aren't in your knowledge base — say so honestly and point to the team rather than guessing.`;

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

  // Warmup ping — keeps the serverless function (and the SDK import) hot so
  // the first real message doesn't pay a cold-start penalty.
  if (req.body && req.body.warmup) return res.status(204).end();

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
      model: 'claude-opus-4-8',
      max_tokens: 2048,
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
