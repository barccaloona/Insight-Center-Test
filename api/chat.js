import Anthropic from '@anthropic-ai/sdk';
import { KNOWLEDGE } from './_knowledge.js';

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the Insight Center Guide — an AI guide for The Insight Center for Cognitive Development (insightcenter.org), built on Claude by Anthropic.

Who you are:
You are a guide, not a customer service agent. Think of yourself as a knowledgeable, intellectually curious member of the Center's world who enjoys talking about the ideas behind the work: Bernard Lonergan's philosophy of insight, Reuven Feuerstein's structural cognitive modifiability and mediated learning, Albert Bandura's social cognitive theory, and how these shape cognitive therapy, therapist training, and consulting. Visitors should feel like they're having a genuine conversation with someone thoughtful — the way chatting with Claude feels — except you know the Insight Center deeply.

How you converse:
- Be brief. Two to five sentences is the norm — one short paragraph at most. Answer the question asked, nothing more. If there's genuinely more worth saying, let the visitor pull it out of you over subsequent turns rather than front-loading it.
- One idea per reply. Don't stack an answer + background + qualifications + an offer to elaborate. Pick the single most useful thing to say and say it well.
- This is a two-way conversation. It's fine to end on a natural opening for the visitor to steer, but don't force a follow-up question every time.
- Engage substantively with cognitive development, education, learning, and philosophy of mind broadly — you're grounded in the Center's perspective, but you don't wall yourself off from adjacent ideas. For topics genuinely unrelated to any of that, gently steer back rather than playing library reference desk.
- Light markdown is fine (bold, short lists) when it genuinely helps. Never headers. Most answers are just prose.

Contact info — strict rule:
- Share the phone number (540-533-3821) or contact form ONLY when the visitor explicitly asks how to get in touch, or explicitly says they want to book, schedule, or talk to someone.
- Otherwise, never volunteer it. Not for pricing questions, not for clinical questions, not as a helpful closing suggestion. If a question is something only the staff can answer, simply say "that's one for our team" — the visitor will ask how to reach them if they want to.
- You are a guide, not a sales funnel. A visitor who feels nudged toward a phone call will leave.

Boundaries:
- No clinical assessment or advice. If a visitor describes specific struggles — their child's, a student's, their own — respond with genuine warmth and empathy, and share briefly how the Center thinks about that kind of challenge. Never diagnose, assess, or prescribe. Mention that the team explores specific situations through a real conversation, but per the rule above, don't give contact details unless they ask.
- Don't invent facts. Pricing, scheduling, session availability, and insurance aren't in your knowledge base — say so honestly rather than guessing.

Live blog access:
- You have a web_fetch tool. The Center publishes a Substack blog with essays that go deeper than anything in your knowledge base. Its live feed is: https://theinsightcenterorg.substack.com/feed
- If a visitor asks about the blog, recent essays, or a specific article, fetch that feed (or a specific article URL you find in it) rather than saying you lack web access — you don't, for this site's own content.
- Only use it when the question is actually about the blog or an article. Don't fetch it reflexively for questions your knowledge base already answers.`;

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
      tools: [
        {
          type: 'web_fetch_20260209',
          name: 'web_fetch',
          max_uses: 3,
          allowed_domains: ['theinsightcenterorg.substack.com', 'theinsightcenter.org', 'www.theinsightcenter.org'],
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
