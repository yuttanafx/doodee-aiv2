'use client';
import { useEffect, useRef, useState } from 'react';
import { useLang } from '@/lib/i18n';

// Automatic news report, shown under the live video.
// The free part (title, Thai time, forecast vs previous, affected markets, general tendency) is built from fixed rules, no AI.
// The AI summary is optional: a button per event (or "auto" if switched on), and it runs on the MEMBER'S OWN key through /api/ai/chat.
// Events that have already been released can be removed with the X button; the choice is remembered on this device only.
type Ev = { title: string; cur: string; ts: number; impact: 'High' | 'Medium'; forecast?: string; previous?: string };
type Props = { news: any; pw: string; canAsk: boolean; acctHeader?: string; speakOn: boolean; speak: (text: string) => void };

const keyOf = (e: Ev) => `${e.cur}|${e.title}|${e.ts}`;
const LEAD = 15 * 60_000; // start the report this long before the event
const CUR = new Set(['USD', 'EUR', 'GBP', 'JPY', 'CHF', 'CAD', 'AUD', 'NZD', 'CNY']);
const clock = (ts: number) => new Date(ts).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

// same idea as currenciesOf() on the server: which currencies move this symbol
function cursOf(symbol: string): string[] {
  const s = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const metal = s.match(/^(XAU|XAG|XPT|XPD)([A-Z]{3})?/);
  if (metal) return metal[2] && CUR.has(metal[2]) && metal[2] !== 'USD' ? ['USD', metal[2]] : ['USD'];
  const fx = s.match(/^([A-Z]{3})([A-Z]{3})/);
  if (fx && CUR.has(fx[1]) && CUR.has(fx[2])) return [fx[1], fx[2]];
  return ['USD'];
}

const MARKETS: Record<string, [string, string]> = {
  USD: ['ทอง/เงิน, คู่เงินที่มี USD, ดัชนีสหรัฐ (US30/NAS100), น้ำมัน, คริปโต', 'Gold/silver, USD pairs, US indices, oil, crypto'],
  EUR: ['คู่เงินที่มี EUR, ดัชนียุโรป (DAX)', 'EUR pairs, European indices'],
  GBP: ['คู่เงินที่มี GBP, ดัชนี FTSE', 'GBP pairs, FTSE'],
  JPY: ['คู่เงินที่มี JPY, ดัชนี Nikkei', 'JPY pairs, Nikkei'],
  CHF: ['คู่เงินที่มี CHF', 'CHF pairs'],
  CAD: ['คู่เงินที่มี CAD, น้ำมัน', 'CAD pairs, oil'],
  AUD: ['คู่เงินที่มี AUD, โลหะ/สินค้าโภคภัณฑ์', 'AUD pairs, metals/commodities'],
  NZD: ['คู่เงินที่มี NZD', 'NZD pairs'],
  CNY: ['ตลาดเอเชีย, ทองแดง/สินค้าโภคภัณฑ์', 'Asian markets, copper/commodities'],
};
const INVERSE = /unemploy|jobless|claims|ว่างงาน/i; // for these a HIGHER number is bad news for the currency

const rel = (ts: number, now: number, t: (a: string, b: string) => string) => {
  const m = Math.round((ts - now) / 60000);
  if (m > 0) return m < 60 ? t(`อีก ${m} นาที`, `in ${m} min`) : t(`อีก ${Math.floor(m / 60)} ชม. ${m % 60} นาที`, `in ${Math.floor(m / 60)} h ${m % 60} min`);
  const a = -m;
  return a < 1 ? t('เพิ่งออก', 'just released') : a < 60 ? t(`ออกแล้ว ${a} นาทีที่แล้ว`, `${a} min ago`) : t(`ออกแล้ว ${Math.floor(a / 60)} ชม. ที่แล้ว`, `${Math.floor(a / 60)} h ago`);
};

export default function NewsReport({ news, pw, canAsk, acctHeader, speakOn, speak }: Props) {
  const { t, lang } = useLang();
  const [now, setNow] = useState(() => Date.now());
  const [gone, setGone] = useState<string[]>([]);
  const [autoAi, setAutoAi] = useState(false);
  const [ai, setAi] = useState<Record<string, { busy?: boolean; text?: string }>>({});
  const announced = useRef<Set<string> | null>(null);

  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  useEffect(() => { try { setGone(JSON.parse(localStorage.getItem('newsgone') || '[]')); setAutoAi(localStorage.getItem('newsautoai') === '1'); } catch {} }, []);

  const symbols: string[] = ((news?.groups ?? []) as any[]).map((g) => g.symbol);
  const events: Ev[] = (news?.reports ?? []) as Ev[];
  const items = events.filter((e) => !gone.includes(keyOf(e)));
  const upcoming = items.filter((e) => e.ts > now).sort((a, b) => a.ts - b.ts);
  const released = items.filter((e) => e.ts <= now).sort((a, b) => b.ts - a.ts);

  const remove = (e: Ev) => setGone((g) => { const n = [...g, keyOf(e)].slice(-200); try { localStorage.setItem('newsgone', JSON.stringify(n)); } catch {} return n; });
  const removeReleased = () => setGone((g) => { const n = [...g, ...released.map(keyOf)].slice(-200); try { localStorage.setItem('newsgone', JSON.stringify(n)); } catch {} return n; });
  const toggleAuto = (v: boolean) => { setAutoAi(v); try { localStorage.setItem('newsautoai', v ? '1' : '0'); } catch {} };

  const mine = (e: Ev) => symbols.filter((s) => cursOf(s).includes(e.cur));

  const summarize = async (e: Ev, isReleased: boolean, voice: boolean) => {
    const k = keyOf(e); if (!canAsk || ai[k]?.busy) return;
    setAi((p) => ({ ...p, [k]: { busy: true } }));
    const msg = `สรุปข่าวแรง ${e.cur} ${e.title} เวลา ${clock(e.ts)} น. (คาดการณ์ ${e.forecast ?? '-'} ก่อนหน้า ${e.previous ?? '-'}) ` +
      (isReleased ? 'ประกาศไปแล้ว ค้นตัวเลขจริงมาเทียบกับค่าคาดการณ์ ' : 'ยังไม่ประกาศ ') +
      `ส่งผลต่อ ${mine(e).join(', ') || 'ตลาดหลัก'} อย่างไร ทิศทางที่เป็นไปได้และความเสี่ยง ไม่ใช่คำสั่งซื้อขาย ตอบสั้น`;
    try {
      const r = await fetch('/api/ai/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-key': pw, ...(acctHeader ? { 'x-acct': acctHeader } : {}) }, body: JSON.stringify({ message: msg }) });
      const j = await r.json().catch(() => ({}));
      const out = r.ok ? String(j.text ?? '') : String(j.error ?? t('เรียก AI ไม่สำเร็จ', 'AI request failed'));
      setAi((p) => ({ ...p, [k]: { text: out } })); if (voice && speakOn && r.ok) speak(out);
    } catch { setAi((p) => ({ ...p, [k]: { text: t('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้', 'Cannot reach the server') } })); }
  };

  // Heads-up when a strong event comes within LEAD minutes while the page is open (never reads out old news on page load).
  useEffect(() => {
    if (!events.length) return;
    if (announced.current === null) { announced.current = new Set(events.filter((e) => e.ts - now <= LEAD).map(keyOf)); return; }
    for (const e of events) {
      const k = keyOf(e), left = e.ts - now;
      if (left <= 0 || left > LEAD || announced.current.has(k) || gone.includes(k)) continue;
      announced.current.add(k);
      const m = Math.max(1, Math.round(left / 60000)), mk = mine(e);
      if (speakOn) speak(lang === 'th' ? `ข่าวแรง ${e.cur} ${e.title} จะออกในอีก ${m} นาที${mk.length ? ' เกี่ยวข้องกับ ' + mk.join(' ') : ''}` : `High-impact ${e.cur} ${e.title} in ${m} minutes${mk.length ? ', affects ' + mk.join(' ') : ''}`);
      if (autoAi && canAsk) summarize(e, false, false);
    }
  }, [now, events, autoAi, speakOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const card = (e: Ev) => {
    const k = keyOf(e), isReleased = e.ts <= now, mk = mine(e), a = ai[k];
    const inv = INVERSE.test(e.title), mkt = MARKETS[e.cur] ?? ['ตลาดที่เกี่ยวข้อง', 'related markets'];
    const hi = inv ? t('ต่ำกว่าคาด', 'below forecast') : t('สูงกว่าคาด', 'above forecast'), lo = inv ? t('สูงกว่าคาด', 'above forecast') : t('ต่ำกว่าคาด', 'below forecast');
    const usd = e.cur === 'USD';
    return (
      <div key={k} style={{ border: '1px solid var(--line)', borderRadius: 10, padding: '10px 12px', display: 'grid', gap: 6, opacity: isReleased ? 0.92 : 1 }}>
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div><span className={'chip ' + (e.impact === 'High' ? 'no' : 'ok')}>{e.cur}</span> <b>{e.title}</b>
            <div className="mute" style={{ fontSize: 13 }}>{clock(e.ts)} {t('น. (เวลาไทย)', '(Thai time)')} · {rel(e.ts, now, t)}</div></div>
          {isReleased && <button className="btn" aria-label={t(`ลบข่าว ${e.title}`, `Remove ${e.title}`)} title={t('ลบข่าวนี้', 'Remove')} onClick={() => remove(e)}>✕</button>}
        </div>
        <div style={{ fontSize: 14 }}>{t('ค่าคาดการณ์', 'Forecast')} <b>{e.forecast ?? '-'}</b> · {t('ค่าก่อนหน้า', 'Previous')} <b>{e.previous ?? '-'}</b>{isReleased && <span className="mute"> · {t('ตัวเลขจริง: ปฏิทินฟรีไม่มีข้อมูลนี้', 'Actual: not in the free calendar')}</span>}</div>
        <div style={{ fontSize: 14 }}>{t('ตลาดที่ได้รับผล:', 'Markets affected:')} {t(mkt[0], mkt[1])}{mk.length ? <> · <b>{t('ที่คุณเทรด', 'You trade')}: {mk.join(', ')}</b></> : null}</div>
        <div className="mute" style={{ fontSize: 13 }}>
          {t(`แนวโน้มทั่วไป: ถ้าตัวเลข${hi} ${e.cur} มักแข็งค่า${usd ? ' ทองมักถูกกดดัน' : ''} · ถ้า${lo} มักตรงข้าม (เป็นมุมมอง ไม่ใช่คำสั่งซื้อขาย)`, `General tendency: ${hi} usually firms ${e.cur}${usd ? ' and pressures gold' : ''}; ${lo} the opposite. A view, not a trade signal.`)}
        </div>
        {a?.text && <div className="bubble ai" style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{a.text}</div>}
        {canAsk && <div className="row"><button className="btn desk-pill" disabled={!!a?.busy} onClick={() => summarize(e, isReleased, true)}>{a?.busy ? t('AI กำลังสรุป…', 'AI summarising…') : a?.text ? t('ให้ AI สรุปใหม่', 'Summarise again') : isReleased ? t('ให้ AI ค้นผลและสรุป', 'AI: find result & summarise') : t('ให้ AI สรุปล่วงหน้า', 'AI: pre-news summary')}</button></div>}
      </div>
    );
  };

  return (
    <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, display: 'grid', gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2>{t('รายงานข่าวแรงอัตโนมัติ', 'Auto news report')}</h2>
        <div className="row">
          {canAsk && <label className="row desk-speak"><input type="checkbox" checked={autoAi} onChange={(e) => toggleAuto(e.target.checked)} /><span className="sub">{t('ให้ AI สรุปอัตโนมัติก่อนข่าว (คิดกับ key ของคุณ)', 'Auto AI summary before news (uses your key)')}</span></label>}
          {!!released.length && <button className="btn" onClick={removeReleased}>{t('ลบข่าวที่ออกแล้วทั้งหมด', 'Remove all released')}</button>}
        </div>
      </div>
      {!events.length && <div className="mute">{news?.status === 'error' ? t('ดึงปฏิทินข่าวไม่สำเร็จ', 'Could not load the news calendar') : t('ไม่มีข่าวแรงของสกุลเงินที่เทรดในช่วง 24 ชั่วโมงที่ผ่านมาและข้างหน้า', 'No high-impact news for your currencies in the last / next 24 hours')}</div>}
      {!!events.length && !items.length && <div className="mute">{t('ลบข่าวทั้งหมดแล้ว', 'All news removed')}</div>}
      {upcoming.map(card)}
      {!!released.length && <div className="sub">{t('ข่าวที่ออกแล้ว', 'Already released')}</div>}
      {released.map(card)}
      <div className="mute desk-note">{t('ส่วนที่ไม่ใช่ AI สร้างจากปฏิทินและกฎตายตัว ฟรี ส่วนสรุป AI ใช้ API key ของคุณ ผลค้นตัวเลขจริงใช้ได้เฉพาะ Gemini / OpenAI และอาจช้าหรือผิดได้ ไม่ใช่คำแนะนำการลงทุน', 'Everything except the AI summary comes from the calendar and fixed rules (free). The AI summary uses your own key; live result lookup works only with Gemini / OpenAI and can be slow or wrong. Not investment advice.')}</div>
    </div>
  );
}
