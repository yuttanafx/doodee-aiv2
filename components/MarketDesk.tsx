'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';
import NewsReport from '@/components/NewsReport';

// Market Desk: TradingView chart + AI chat (typed or spoken) + live video / news tabs.
// The AI answers through /api/ai/chat, which uses the MEMBER'S OWN API key (see lib/aiconf.ts). No key = no AI, so we guide them to sign up / add a key.
type Msg = { who: 'me' | 'ai'; text: string };
type Props = {
  pw: string;                                   // '' = visitor (not logged in)
  hasKey: boolean;                              // member has saved an AI API key
  onLogin?: (password: string) => Promise<void> | void;
  loginErr?: string;
  acctHeader?: string;                          // admin viewing another account
  news?: any;                                   // /api/state news block (events for the automatic news report)
};

const SYMBOLS: [string, string][] = [
  ['XAUUSD', 'OANDA:XAUUSD'], ['EURUSD', 'OANDA:EURUSD'], ['GBPUSD', 'OANDA:GBPUSD'], ['USDJPY', 'OANDA:USDJPY'],
  ['BTCUSD', 'BINANCE:BTCUSDT'], ['US30', 'OANDA:US30USD'], ['NAS100', 'OANDA:NAS100USD'], ['USOIL', 'TVC:USOIL'],
];
const TFS: [string, string][] = [['M5', '5'], ['M15', '15'], ['H1', '60'], ['H4', '240'], ['D', 'D']];
// Preset live channels (YouTube channel IDs, checked against public listings: Bloomberg Television, CNBC Television, Yahoo Finance, Reuters). They can be swapped at any time with the paste box below; a channel that is not live right now simply shows nothing.
const CHANNELS: [string, string][] = [
  ['Bloomberg', 'UCIALMKvObZNtJ6AmdCLP7Lg'], ['CNBC', 'UCrp_UI8XtuYfpiqluWLD7Lw'], ['Yahoo Finance', 'UCEAZeUIeJs0IjQiqTCdVSIg'], ['Reuters', 'UChqUTb7kYRX8-EiaN3XFrSQ'],
];
// Thai stock-news channels: resolved to a channel ID by /api/yt when clicked ('user:' = legacy YouTube username).
const TH_CHANNELS: [string, string][] = [['Money Channel', '@moneychannelthailandth'], ['SET', 'user:setgroupofficial'], ['TNN', 'user:tnn24official']];

// Turn anything a person pastes into an embeddable URL: YouTube (watch / live / youtu.be / channel), Twitch, Facebook, Vimeo, or a direct mp4/webm/m3u8 file.
export function toEmbed(raw: string): { kind: 'iframe' | 'video'; src: string } | null {
  const s = raw.trim(); if (!s) return null;
  let u: URL; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch { return null; }
  const h = u.hostname.replace(/^www\.|^m\./, '');
  if (h === 'youtu.be') return { kind: 'iframe', src: `https://www.youtube.com/embed/${u.pathname.slice(1)}?autoplay=1&mute=1` };
  if (h === 'youtube.com') {
    const v = u.searchParams.get('v'); if (v) return { kind: 'iframe', src: `https://www.youtube.com/embed/${v}?autoplay=1&mute=1` };
    const m = u.pathname.match(/^\/(live|embed|shorts)\/([\w-]+)/); if (m) return { kind: 'iframe', src: `https://www.youtube.com/embed/${m[2]}?autoplay=1&mute=1` };
    const c = u.pathname.match(/^\/channel\/([\w-]+)/); if (c) return { kind: 'iframe', src: `https://www.youtube.com/embed/live_stream?channel=${c[1]}&autoplay=1&mute=1` };
  }
  if (h === 'twitch.tv') { const ch = u.pathname.split('/').filter(Boolean)[0]; if (ch) return { kind: 'iframe', src: `https://player.twitch.tv/?channel=${ch}&parent=${location.hostname}&muted=true` }; }
  if (h === 'facebook.com' || h === 'fb.watch') return { kind: 'iframe', src: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(u.href)}&show_text=false&autoplay=true&mute=true` };
  if (h === 'vimeo.com') { const id = u.pathname.split('/').filter(Boolean)[0]; if (/^\d+$/.test(id)) return { kind: 'iframe', src: `https://player.vimeo.com/video/${id}?autoplay=1&muted=1` }; }
  if (/\.(mp4|webm|ogg)(\?|$)/i.test(u.pathname)) return { kind: 'video', src: u.href };
  return null; // .m3u8 and other private streams need a player library: not supported here
}

// Mounts one TradingView embed widget (they all work the same way: a <script> whose text is the JSON config).
function TV({ src, config, height }: { src: string; config: Record<string, any>; height: number | string }) {
  const box = useRef<HTMLDivElement>(null);
  const cfg = JSON.stringify(config);
  useEffect(() => {
    const el = box.current; if (!el) return;
    el.innerHTML = '';
    const inner = document.createElement('div'); inner.className = 'tradingview-widget-container__widget'; inner.style.height = '100%'; inner.style.width = '100%';
    const s = document.createElement('script'); s.src = `https://s3.tradingview.com/external-embedding/${src}.js`; s.async = true; s.innerHTML = cfg;
    el.append(inner, s);
    return () => { el.innerHTML = ''; };
  }, [src, cfg]);
  return <div className="tradingview-widget-container" ref={box} style={{ height, width: '100%' }} />;
}

const liveSrc = (id: string) => `https://www.youtube.com/embed/live_stream?channel=${id}&autoplay=1&mute=1`;
async function resolveChannel(ref: string): Promise<string | null> {
  try { const r = await fetch('/api/yt?h=' + encodeURIComponent(ref)); const j = await r.json(); return r.ok ? String(j.id) : null; } catch { return null; }
}
// a pasted youtube.com/@name, /user/name or /c/name link -> a handle reference for the resolver
function handleOf(raw: string): string | null {
  try { const u = new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : 'https://' + raw.trim()); if (u.hostname.replace(/^www\.|^m\./, '') !== 'youtube.com') return null;
    const a = u.pathname.match(/^\/(@[\w.\-]+)/); if (a) return a[1]; const b = u.pathname.match(/^\/(?:user|c)\/([\w.\-]+)/); return b ? 'user:' + b[1] : null; } catch { return null; }
}

export default function MarketDesk({ pw, hasKey, onLogin, loginErr, acctHeader, news }: Props) {
  const { t, lang } = useLang();
  const [sym, setSym] = useState(SYMBOLS[0]);
  const [tf, setTf] = useState('60');
  const [theme, setTheme] = useState('dark');
  const [tab, setTab] = useState<'video' | 'news' | 'cal'>('video');
  const [chan, setChan] = useState(CHANNELS[0][1]);
  const [custom, setCustom] = useState('');
  const [embed, setEmbed] = useState<{ kind: 'iframe' | 'video'; src: string } | null>(null);
  const [urlErr, setUrlErr] = useState('');
  const [vBusy, setVBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speakOn, setSpeakOn] = useState(false);
  const [draftPw, setDraftPw] = useState('');
  const recRef = useRef<any>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => { // follow the site's day / night switch
    const f = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark');
    f(); const mo = new MutationObserver(f); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => mo.disconnect();
  }, []);
  useEffect(() => { try { const s = localStorage.getItem('deskvideo'); if (s) { setCustom(s); setEmbed(toEmbed(s)); } } catch {} }, []);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [msgs, busy]);
  useEffect(() => () => { try { recRef.current?.stop(); speechSynthesis.cancel(); } catch {} }, []);

  const tvLang = lang === 'th' ? 'th_TH' : 'en';
  const canAsk = !!pw && hasKey;

  const speak = (text: string) => { try { const u = new SpeechSynthesisUtterance(text); u.lang = lang === 'th' ? 'th-TH' : 'en-US'; speechSynthesis.cancel(); speechSynthesis.speak(u); } catch {} };

  const ask = async (text: string) => {
    const question = text.trim(); if (!question || busy || !canAsk) return;
    // the chart the person is looking at is part of the question, so "analyse this" works without retyping the pair
    const framed = `[${sym[0]} ${TFS.find((x) => x[1] === tf)?.[0] ?? tf}] ${question}`;
    setMsgs((m) => [...m, { who: 'me', text: question }]); setQ(''); setBusy(true);
    try {
      const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': pw, ...(acctHeader ? { 'x-acct': acctHeader } : {}) }, body: JSON.stringify({ message: framed }) });
      const j = await r.json().catch(() => ({}));
      const out = r.ok ? String(j.text ?? '') : r.status === 402 ? String(j.error ?? t('แพ็กเกจหมดอายุ', 'Your plan has expired')) : String(j.error ?? t('เรียก AI ไม่สำเร็จ', 'AI request failed'));
      setMsgs((m) => [...m, { who: 'ai', text: out }]); if (speakOn && r.ok) speak(out);
    } catch { setMsgs((m) => [...m, { who: 'ai', text: t('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'Cannot reach the server') }]); }
    setBusy(false);
  };

  const mic = () => {
    if (listening) { try { recRef.current?.stop(); } catch {} setListening(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setMsgs((m) => [...m, { who: 'ai', text: t('เบราว์เซอร์นี้ไม่รองรับการฟังเสียง ลองใช้ Chrome หรือ Edge หรือพิมพ์ถามแทน', 'This browser has no speech input. Try Chrome or Edge, or type your question.') }]); return; }
    const r = new SR(); r.lang = lang === 'th' ? 'th-TH' : 'en-US'; r.interimResults = false;
    r.onresult = (e: any) => { setSpeakOn(true); ask(e.results[0][0].transcript); };
    r.onerror = () => { setListening(false); setMsgs((m) => [...m, { who: 'ai', text: t('ไม่ได้รับเสียงจากไมค์ ตรวจสอบสิทธิ์ไมโครโฟนของเบราว์เซอร์', 'No audio from the microphone. Check the browser permission.') }]); };
    r.onend = () => setListening(false);
    recRef.current = r; setListening(true); r.start();
  };

  const applyUrl = async () => {
    setUrlErr('');
    let e = toEmbed(custom);
    if (!e) { const h = handleOf(custom); if (h) { setVBusy(true); const id = await resolveChannel(h); setVBusy(false); if (id) e = { kind: 'iframe', src: liveSrc(id) }; } }
    if (!e) { setUrlErr(t('ลิงก์นี้ฝังไม่ได้ ใช้ลิงก์ YouTube / Twitch / Facebook / Vimeo หรือไฟล์ .mp4', 'Cannot embed this link. Use a YouTube / Twitch / Facebook / Vimeo link or an .mp4 file.')); return; }
    setEmbed(e); try { localStorage.setItem('deskvideo', custom.trim()); } catch {}
  };
  const pickThai = async (name: string, ref: string) => {
    setUrlErr(''); setVBusy(true); const id = await resolveChannel(ref); setVBusy(false);
    if (!id) { setUrlErr(t(`หาช่อง ${name} ไม่เจอ ลองวางลิงก์ไลฟ์ของช่องนี้ในช่องด้านล่างแทน`, `Could not find ${name}. Paste its live link below instead.`)); return; }
    setCustom(''); setEmbed({ kind: 'iframe', src: liveSrc(id) });
  };
  const clearUrl = () => { setEmbed(null); setCustom(''); setUrlErr(''); try { localStorage.removeItem('deskvideo'); } catch {} };

  const chartCfg = {
    autosize: true, symbol: sym[1], interval: tf, timezone: 'Asia/Bangkok', theme, style: '1', locale: tvLang,
    allow_symbol_change: true, hide_side_toolbar: false, support_host: 'https://www.tradingview.com',
    backgroundColor: theme === 'dark' ? 'rgba(14,17,22,1)' : 'rgba(255,255,255,1)',
  };
  const ideas = [
    t('วิเคราะห์ตลาดตอนนี้', 'Analyse the market now'), t('แนะนำกลยุทธ์ที่เหมาะกับสภาพตลาดนี้', 'Suggest a strategy for this regime'),
    t('ข่าวไหนกระทบคู่นี้วันนี้', 'Which news moves this pair today'), t('แนวรับแนวต้านสำคัญ', 'Key support and resistance'),
  ];

  const gate = !pw ? (
    <div className="desk-gate">
      <b>{t('สมาชิกเท่านั้น', 'Members only')}</b>
      <p className="mute">{t('AI ใช้ API key ของสมาชิกเอง เข้าสู่ระบบ หรือสมัครสมาชิกแล้วใส่ API key ก่อนใช้งาน', 'The AI runs on each member\u2019s own API key. Log in, or sign up and add your key first.')}</p>
      {onLogin && <div className="row">
        <input type="password" aria-label={t('รหัสผ่าน', 'Password')} placeholder={t('รหัสผ่านสมาชิก', 'Member password')} value={draftPw} onChange={(e) => setDraftPw(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draftPw.trim()) onLogin(draftPw); }} style={{ flex: '1 1 150px' }} />
        <button className="btn main" disabled={!draftPw.trim()} onClick={() => onLogin(draftPw)}>{t('เข้าสู่ระบบ', 'Log in')}</button>
      </div>}
      {loginErr && <div className="err" role="alert">{loginErr}</div>}
      <a className="btn" href="#login">{t('สมาชิกใหม่? สมัครที่นี่', 'New here? Sign up')}</a>
    </div>
  ) : !hasKey ? (
    <div className="desk-gate">
      <b>{t('ยังไม่ได้ใส่ API key', 'No API key yet')}</b>
      <p className="mute">{t('ใส่ API key ของ Claude / GPT / Gemini ในส่วน "ผู้ให้บริการ AI" ของแดชบอร์ดก่อน แล้วกลับมาถามได้เลย (ค่าโทเคนคิดกับ key ของคุณเอง)', 'Add your Claude / GPT / Gemini key under "AI provider" in the dashboard, then ask away (tokens are billed to your own key).')}</p>
      <a className="btn main" href="#sec-provider">{t('ไปใส่ API key', 'Add API key')}</a>
    </div>
  ) : null;

  return (
    <div className="desk">
      <div className="desk-chart card">
        <div className="row desk-bar">
          <div className="row" role="tablist" aria-label={t('คู่เงิน', 'Symbol')}>{SYMBOLS.map((s) => <button key={s[0]} role="tab" aria-selected={sym[0] === s[0]} className={'btn desk-pill' + (sym[0] === s[0] ? ' main' : '')} onClick={() => setSym(s)}>{s[0]}</button>)}</div>
          <div className="row" role="tablist" aria-label={t('ไทม์เฟรม', 'Timeframe')}>{TFS.map((x) => <button key={x[1]} role="tab" aria-selected={tf === x[1]} className={'btn desk-pill' + (tf === x[1] ? ' main' : '')} onClick={() => setTf(x[1])}>{x[0]}</button>)}</div>
        </div>
        <div className="desk-tv"><TV src="embed-widget-advanced-chart" config={chartCfg} height="100%" /></div>
        <div className="mute desk-note">{t('กราฟจาก TradingView ข้อมูลอาจหน่วงตามผู้ให้บริการ', 'Chart by TradingView. Data may be delayed by the provider.')}</div>
      </div>

      <div className="desk-ai card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>{t('ถาม AI: ตลาดและกลยุทธ์', 'Ask AI: market & strategy')}</h2>
          <label className="row desk-speak"><input type="checkbox" checked={speakOn} onChange={(e) => { setSpeakOn(e.target.checked); if (!e.target.checked) { try { speechSynthesis.cancel(); } catch {} } }} /><span className="sub">{t('อ่านคำตอบ', 'Read aloud')}</span></label>
        </div>
        {gate}
        {!gate && <>
          <div className="desk-log" ref={logRef} aria-live="polite">
            {!msgs.length && <div className="mute">{t(`กำลังดู ${sym[0]} — พิมพ์หรือกดไมค์เพื่อถาม`, `Viewing ${sym[0]} — type or tap the mic to ask`)}</div>}
            {msgs.map((m, i) => <div key={i} className={'bubble ' + (m.who === 'ai' ? 'ai' : 'me')} style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>)}
            {busy && <div className="bubble ai mute">{t('กำลังวิเคราะห์…', 'Analysing…')}</div>}
          </div>
          <div className="row desk-ideas">{ideas.map((i) => <button key={i} className="btn desk-pill" disabled={busy} onClick={() => ask(i)}>{i}</button>)}</div>
          <div className="row">
            <input aria-label={t('คำถาม', 'Question')} style={{ flex: '1 1 160px' }} maxLength={500} value={q} placeholder={t('ถามเรื่องตลาด กลยุทธ์ ข่าว…', 'Ask about the market, strategy, news…')} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask(q); }} />
            <button className={'btn desk-mic' + (listening ? ' main' : '')} aria-pressed={listening} aria-label={listening ? t('หยุดฟัง', 'Stop listening') : t('พูดถามด้วยไมค์', 'Ask by voice')} onClick={mic}>{listening ? '■' : '🎤'}</button>
            <button className="btn main" disabled={busy || !q.trim()} onClick={() => ask(q)}>{t('ส่ง', 'Send')}</button>
          </div>
        </>}
        <div className="mute desk-note">{t('AI ให้ข้อมูลประกอบการตัดสินใจ ไม่ใช่คำแนะนำการลงทุน', 'AI output is information, not investment advice.')}</div>
      </div>

      <div className="desk-media card">
        <div className="row" role="tablist" aria-label={t('สื่อข่าว', 'News media')}>
          {([['video', t('วิดีโอข่าวสด', 'Live video')], ['news', t('พาดหัวข่าว', 'Headlines')], ['cal', t('ปฏิทินเศรษฐกิจ', 'Calendar')]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={'btn desk-pill' + (tab === k ? ' main' : '')} onClick={() => setTab(k)}>{l}</button>)}
        </div>
        {tab === 'video' && <>
          <div className="row">
            {CHANNELS.map(([n, id]) => <button key={id} className={'btn desk-pill' + (!embed && chan === id ? ' main' : '')} onClick={() => { clearUrl(); setChan(id); }}>{n}</button>)}
          </div>
          <div className="row">
            <span className="sub">{t('ข่าวหุ้นไทย', 'Thai stocks')}</span>
            {TH_CHANNELS.map(([n, ref]) => <button key={ref} className="btn desk-pill" disabled={vBusy} onClick={() => pickThai(n, ref)}>{n}</button>)}
            {vBusy && <span className="mute">{t('กำลังเชื่อมต่อ…', 'Connecting…')}</span>}
          </div>
          <div className="desk-video">
            {embed?.kind === 'video'
              ? <video src={embed.src} controls autoPlay muted playsInline style={{ width: '100%', height: '100%' }} />
              : <iframe title={t('วิดีโอข่าว', 'News video')} src={embed?.src ?? liveSrc(chan)} allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />}
          </div>
          <div className="row">
            <input aria-label={t('ลิงก์วิดีโอ', 'Video link')} style={{ flex: '1 1 200px' }} value={custom} placeholder={t('วางลิงก์ YouTube Live / @ชื่อช่อง / Twitch / Facebook / .mp4', 'Paste a YouTube Live / @channel / Twitch / Facebook / .mp4 link')} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') applyUrl(); }} />
            <button className="btn main" disabled={vBusy} onClick={applyUrl}>{t('เชื่อมต่อ', 'Connect')}</button>
            {embed && <button className="btn" onClick={clearUrl}>{t('ล้าง', 'Clear')}</button>}
          </div>
          {urlErr && <div className="err" role="alert">{urlErr}</div>}
          <div className="mute desk-note">{t('ช่องที่ไม่ได้ถ่ายสดอยู่ตอนนี้จะไม่แสดงภาพ วางลิงก์ไลฟ์ของช่องที่ต้องการแทนได้ ระบบจำลิงก์ไว้ในเครื่องคุณ', 'A channel that is not live right now shows nothing. Paste any live link instead; it is remembered on this device only.')}</div>
        </>}
        {tab === 'news' && <div className="desk-tv desk-tall"><TV src="embed-widget-timeline" config={{ feedMode: 'all_symbols', isTransparent: true, displayMode: 'regular', width: '100%', height: '100%', colorTheme: theme, locale: tvLang }} height="100%" /></div>}
        {tab === 'cal' && <div className="desk-tv desk-tall"><TV src="embed-widget-events" config={{ isTransparent: true, width: '100%', height: '100%', colorTheme: theme, locale: tvLang, importanceFilter: '0,1', countryFilter: 'us,eu,gb,jp,cn,th' }} height="100%" /></div>}
        {news && <NewsReport news={news} pw={pw} canAsk={canAsk} acctHeader={acctHeader} speakOn={speakOn} speak={speak} />}
      </div>
    </div>
  );
}
