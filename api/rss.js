export default async function handler(req, res) {
  const FEED = 'https://girardmiller.substack.com/feed';
  try {
    const upstream = await fetch(FEED, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; InsightCenter/1.0)' },
    });
    if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
    const xml = await upstream.text();
    res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(xml);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
}
