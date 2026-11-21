export const dynamic = 'force-dynamic';

// Public helper: turns a YouTube @handle (or legacy /user/ name) into the channel ID that the live-stream embed needs.
// Fixed host + strict name check, so it cannot be pointed at any other site. Results are cached in memory for a day.
const cache = new Map<string, { id: string; ts: number }>();
const DAY = 24 * 3600_000;

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get('h') || '').trim();
  const m = raw.match(/^(user:)?(@?[\w.\-]{2,60})$/);
  if (!m) return Response.json({ error: 'ชื่อช่องไม่ถูกต้อง' }, { status: 400 });
  const key = raw.toLowerCase(), hit = cache.get(key);
  if (hit && Date.now() - hit.ts < DAY) return Response.json({ id: hit.id });
  const path = m[1] ? `user/${m[2].replace('@', '')}` : m[2].startsWith('@') ? m[2] : '@' + m[2];
  try {
    const r = await fetch(`https://www.youtube.com/${path}`, {
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SignalHub/1.0)', 'accept-language': 'en', cookie: 'CONSENT=YES+1; SOCS=CAI' },
      signal: AbortSignal.timeout(8000), cache: 'no-store',
    });
    if (!r.ok) return Response.json({ error: 'ไม่พบช่องนี้' }, { status: 404 });
    const html = await r.text();
    const id = html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ?? html.match(/"channelId":"(UC[\w-]{22})"/)?.[1];
    if (!id) return Response.json({ error: 'หารหัสช่องไม่เจอ' }, { status: 404 });
    cache.set(key, { id, ts: Date.now() });
    return Response.json({ id });
  } catch { return Response.json({ error: 'เชื่อมต่อ YouTube ไม่ได้' }, { status: 502 }); }
}
