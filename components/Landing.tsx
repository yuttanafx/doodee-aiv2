'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LangBtn, useLang } from '@/lib/i18n';
import MarketDesk from '@/components/MarketDesk';
import { PHASE_AT, SCENE_MS, drawScene, phaseOf, readColors } from '@/lib/heroScene';

// Landing page shown before login. The login card (and "forgot password") is passed in as children so the sign-in logic stays in page.tsx.
// EA download: direct-download link of the file on Google Drive. Set NEXT_PUBLIC_EA_DOWNLOAD_URL to point somewhere else.
const DRIVE_ID = '1VhUUQAXOBPcE7enmEdpT0FhYM6bKIe1o';
const EA_URL = process.env.NEXT_PUBLIC_EA_DOWNLOAD_URL || `https://drive.google.com/uc?export=download&id=${DRIVE_ID}`;
const EA_VIEW = `https://drive.google.com/file/d/${DRIVE_ID}/view?usp=sharing`;

const Icon = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);
const TG_URL = 'https://t.me/Hub_signal_propfirmSp_bot';
const LINE_URL = 'https://lin.ee/W3nixLK';
const LINE_ICON = 'M21 11.5C21 7.4 16.97 4 12 4S3 7.4 3 11.5c0 3.6 3.2 6.6 7.5 7.4l-.3 2.1 4.3-2.6C18.7 17.5 21 14.8 21 11.5Z';
const PLANE = 'M21.5 3.5 2.8 10.7c-.9.4-.9 1.2 0 1.5l4.6 1.4 1.8 5.5c.2.6.9.7 1.3.3l2.6-2.4 4.7 3.5c.7.5 1.4.2 1.6-.7l3.1-15.2c.2-1-.4-1.5-1-1.1ZM8 13.4l9.6-6-7.4 7.2-.3 3.2L8 13.4Z';

// Same animation loop as before, now shared by the demo stage and the laptop in the hero.
function useScene(cv: React.RefObject<HTMLCanvasElement>, onPhase?: (p: number) => void) {
  useEffect(() => {
    const el = cv.current!, ctx = el.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = 0, w = 0, h = 0, clock = reduce ? PHASE_AT[4] + 2600 : 0, last = performance.now(), lastPhase = -1, frames = 0, onScreen = true;
    let col = readColors();
    const paint = () => {
      const p = phaseOf(clock); if (p !== lastPhase) { lastPhase = p; onPhase?.(p); }
      if (frames++ % 120 === 0) col = readColors();     // follows the day / night switch
      drawScene(ctx, w, h, clock, col);
    };
    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2), r = el.getBoundingClientRect();
      w = r.width; h = r.height; el.width = Math.round(w * dpr); el.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); paint();
    };
    const tick = (now: number) => {
      const dt = Math.max(0, Math.min(now - last, 80)); last = now;      // a long pause (hidden tab) must not skip the story; the first rAF timestamp can be older than `last`, which made the clock negative and stopped the loop
      clock = (clock + dt) % SCENE_MS; paint();
      raf = requestAnimationFrame(tick);
    };
    const start = () => { if (reduce || raf || !onScreen || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(tick); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const ro = new ResizeObserver(size); ro.observe(el);
    const io = new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; onScreen ? start() : stop(); }); io.observe(el);
    const vis = () => (document.hidden ? stop() : start());
    document.addEventListener('visibilitychange', vis);
    size(); start();
    return () => { stop(); ro.disconnect(); io.disconnect(); document.removeEventListener('visibilitychange', vis); };
  }, []);   // eslint-disable-line react-hooks/exhaustive-deps
}

function HeroStage() {
  const { t } = useLang();
  const cv = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState(0);
  useScene(cv, setPhase);

  return (
    <div className="lp-stage" data-p={phase}>
      <div className="lp-chart" role="img" aria-label={t("ตัวอย่างจำลอง: กราฟแท่งเทียนเคลื่อนที่ในกรอบแคบ แล้วทะลุแนวต้านขึ้นเป็นเทรนด์ AI ยืนยัน และเทเลแกรมส่งแผนซื้อให้กดสั่ง","Simulated demo: candles move in a tight range, break resistance into an uptrend, AI confirms, and Telegram sends a buy plan to tap.")}>
        <div className="lp-chart-head">
          <b>XAUUSD</b><span className="mute">H1</span>
          <span className="lp-tag lp-regime"><i className="side">{t("ไซด์เวย์","Sideways")}</i><i className="up">{t("เทรนขึ้น","Uptrend")}</i></span>
          <span className="lp-tag lp-ai"><i className="lp-orb" /><i className="think">{t("AI กำลังวิเคราะห์","AI analyzing")}</i><i className="done">{t("AI: เทรนขึ้น 86% → Trend Follow","AI: uptrend 86% → Trend Follow")}</i></span>
        </div>
        <canvas ref={cv} className="lp-canvas" />
      </div>

      <div className="lp-chat" aria-hidden="true">
        <div className="lp-chat-head">
          <span className="lp-tg"><Icon d={PLANE} size={18} /></span>
          <div><b>SR Breakout Bot</b><span>{t("บอท","Bot")}</span></div>
        </div>
        <div className="lp-chat-body">
          <div className="lp-msg lp-wait">{t("รอสัญญาณจาก EA…","Waiting for signal from EA…")}</div>
          <div className="lp-msg lp-m1">🔄 <b>{t("สภาพตลาดเปลี่ยน","Market regime changed")}</b><br />{t("XAUUSD H1: ไซด์เวย์ → ","XAUUSD H1: sideways → ")}<b>{t("เทรนขึ้น","Uptrend")}</b><br />{t("AI มั่นใจ 86%","AI confidence 86%")}</div>
          <div className="lp-msg lp-m2">
            🎯 <b>XAUUSD H1</b>{t(" · ราคา "," · price ")}<b>2,652.40</b><br />
            {t("แนวรับ","Support")} 2,646.80 · SL 2,646.10<br />
            <div className="lp-btns">
              <span>🟢 BUY TP1 · 1:1.0</span><span className="tp2">🟢 BUY TP2 · 1:2.0</span><span>🟢 BUY TP3 · 1:3.0</span>
            </div>
          </div>
          <div className="lp-msg lp-m3">✅ <b>{t("เปิดออเดอร์สำเร็จ","Order opened")}</b><br />BUY XAUUSD 0.01 lot<br />SL 2,646.10 · TP 2,665.00</div>
        </div>
      </div>
    </div>
  );
}

// Sample (simulated) figures for the hero ticker / panels. Not live market data; the page says so under the panels.
const TICKER = [
  { s: 'XAUUSD', p: '2,418.50', c: '+12.30 (+0.51%)', up: true, ic: '🥇' },
  { s: 'BTCUSD', p: '107,850.20', c: '+1,245.30 (+1.17%)', up: true, ic: '₿' },
  { s: 'EURUSD', p: '1.1635', c: '+0.0031 (+0.27%)', up: true, ic: '€' },
  { s: 'USDJPY', p: '154.72', c: '−0.18 (−0.12%)', up: false, ic: '$' },
];
const SIGNALS = [
  { side: 'BUY', sym: 'XAUUSD', price: '2,418.50', time: '10:32' },
  { side: 'SELL', sym: 'EURUSD', price: '1.1635', time: '10:28' },
  { side: 'BUY', sym: 'GBPUSD', price: '1.3330', time: '10:25' },
  { side: 'SELL', sym: 'USDJPY', price: '154.72', time: '10:20' },
  { side: 'BUY', sym: 'BTCUSD', price: '107,835', time: '10:15' },
];
const CALENDAR = [
  { time: '14:30', cur: 'USD', ev: 'Core Retail Sales m/m', imp: 'High' },
  { time: '15:00', cur: 'USD', ev: 'Fed Chair Powell Speaks', imp: 'High' },
  { time: '17:00', cur: 'EUR', ev: 'ECB President Lagarde Speaks', imp: 'Med' },
  { time: '19:30', cur: 'USD', ev: 'Crude Oil Inventories', imp: 'Med' },
  { time: '20:00', cur: 'USD', ev: 'FOMC Member Daly Speaks', imp: 'Low' },
];

// Laptop in the hero: the same simulated candle scene, drawn on a dark screen.
function LaptopHero() {
  const cv = useRef<HTMLCanvasElement>(null);
  useScene(cv);
  return (
    <div className="lp2-laptop" aria-hidden="true">
      <div className="lp2-screen">
        <canvas ref={cv} className="lp2-screen-cv" />
        <div className="lp2-quote"><span>XAUUSD</span><b>2,418.50</b><em>+12.30 (+0.51%)</em></div>
        <div className="lp2-tfs">{['M1', 'M5', 'M15', 'H1', 'H4', 'D1'].map((x) => <i key={x} className={x === 'H1' ? 'on' : ''}>{x}</i>)}</div>
      </div>
      <div className="lp2-base" />
    </div>
  );
}

export default function Landing({ themeBtn, children, onLogin, loginErr }: { themeBtn: ReactNode; children: ReactNode; onLogin?: (pw: string) => Promise<void> | void; loginErr?: string }) {
  const { t } = useLang();
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(location.origin), []);

  // scroll-reveal: elements with .rv fade and rise in when they enter the viewport
  useEffect(() => {
    document.documentElement.classList.add('js');
    const els = Array.from(document.querySelectorAll('.rv'));
    if (!('IntersectionObserver' in window)) { els.forEach((e) => e.classList.add('in')); return; }
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, []);

  const steps = [
    { t: t("EA สแกนทุกคู่เงิน","EA scans every pair"), d: t("ทุกคู่ในตะกร้าถูกวัด ADX, ATR, EMA และกรอบราคา แล้วโหวตว่าเป็นเทรนขึ้น เทรนลง ไซด์เวย์ หรือผันผวน","Every pair in your basket is measured by ADX, ATR, EMA and price range, then voted as uptrend, downtrend, sideways or volatile"), icon: 'M4 20V10M10 20V4M16 20v-7M22 20V8' },
    { t: t("AI วิเคราะห์และเลือกกลยุทธ์","AI analyzes and picks a strategy"), d: t("คู่ที่คุณเลือกถูกส่งให้ AI ในคำขอเดียว ได้ผลจำแนกสภาพตลาด เหตุผลสั้น ๆ และกลยุทธ์ที่เข้ากับสภาพนั้น (ตั้งได้ว่าสภาพไหนใช้กลยุทธ์ใด)","Your selected pairs go to the AI in a single request. You get the market regime, a short rationale and a matching strategy (you can set which strategy each regime uses)"), icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1' },
    { t: t("กดสั่งในเทเลแกรม","Tap to order in Telegram"), d: t("เลือกคู่ ดูแนวรับต้านกับ SL และ TP1–3 พร้อม RR ของแต่ละระดับ กดยืนยันแล้ว EA เปิดไม้ให้","Pick a pair, review support/resistance, SL and TP1–3 with each level's RR, confirm, and the EA opens the trade"), icon: PLANE },
  ];
  const feats = [
    { h: 'AI Analysis', d: t("วิเคราะห์หลายรูปแบบ ตัดสินใจอย่างชาญฉลาด","Multi-pattern analysis, smart decisions"), icon: 'M4 20V10M10 20V4M16 20v-7M22 20V8', href: '#demo-sec' },
    { h: 'MT5 EA', d: t("เทรดอัตโนมัติ 24/7 พร้อมบริหารความเสี่ยง","Auto trade 24/7 with risk management"), icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M7 7h10v10H7z', href: '#get-started' },
    { h: 'Telegram Control', d: t("รับสัญญาณและควบคุมการเทรด","Receive signals, control trading"), icon: PLANE, href: '#telegram' },
    { h: 'Multi-Asset', d: t("Forex / ทอง / คริปโต / ดัชนี","Forex / Gold / Crypto / Indices"), icon: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5', href: '#desk' },
    { h: 'Market News', d: t("ปฏิทินเศรษฐกิจและวิเคราะห์ตลาด","Economic calendar, market analysis"), icon: 'M4 5h13v14H4zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5', href: '#desk' },
    { h: 'Risk Management', d: t("ตั้งลิมิตขาดทุนรายวัน ปกป้องเงินทุน","Set daily loss limit, protect capital"), icon: 'M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Zm-3 9 2.5 2.5L16 9.5', href: '#safe-sec' },
  ];
  const points = [
    [t("แยกไม้ออโต้กับไม้ที่กดเอง","Auto trades and manual trades kept apart"), t("ไม้ที่สั่งจากเทเลแกรมใช้ Magic Number คนละชุดกับไม้ออโต้ กริดและ Recovery จึงไม่แตะไม้ที่คุณกดเอง","Trades placed from Telegram use a different Magic Number from auto trades, so grid and Recovery never touch the ones you open yourself")],
    [t("หยุดก่อนชนกฎของ Prop Firm","Stops before breaking prop firm rules"), t("ชน Daily Loss หรือ Max Drawdown แล้ว EA หยุดเปิดไม้ใหม่ ทั้งไม้ออโต้และไม้จากเทเลแกรม และกำหนดเพดาน lot ต่อไม้ได้","When Daily Loss or Max Drawdown is hit, the EA stops opening new trades, both auto and Telegram, and you can cap lot size per trade")],
    [t("หลายบัญชีในเว็บเดียว","Multiple accounts on one site"), t("ผู้ดูแลออกรหัสผ่านและ EA key แยกรายบัญชี สมาชิกใช้ API key ของ AI ของตัวเอง ไม่ปนกัน","The admin issues passwords and EA keys per account; members use their own AI API keys, never mixed")],
    [t("พักระบบได้ทุกเมื่อ","Pause anytime"), t("กดหยุดส่งคำสั่งทั้งหมดจากหน้าเว็บหรือเทเลแกรมได้ทันที ไม้ที่เปิดอยู่ยังเป็นของคุณ","Stop all orders from the web or Telegram instantly. Open trades stay yours")],
  ];

  return (
    <div className="lp">
      <header className="lp2-nav">
        <a className="lp2-brand" href="#top"><span className="lp2-logo" aria-hidden="true"><i /><i /><i /></span><span><b>Pichai Fintech</b><small>MT5 Signal Hub</small></span></a>
        <nav className="lp2-links" aria-label="Main">
          <a className="on" href="#top">{t("หน้าแรก","Home")}</a>
          <a href="#platform">{t("แพลตฟอร์ม","Platform")}</a>
          <a href="#signals">{t("สัญญาณ AI","AI Signals")}</a>
          <a href="#get-started">MT5 EA</a>
          <a href="#telegram">Telegram</a>
          <a href="#desk">{t("ข่าวตลาด","Market News")}</a>
          <a href="#login">{t("สมาชิก","Member")}</a>
        </nav>
        <div className="lp2-actions"><LangBtn />{themeBtn}<a className="btn lp-line-btn lp-nav-line" href={LINE_URL} target="_blank" rel="noopener noreferrer">{t("ติดต่อเรา","Contact us")}</a><a className="btn lp2-login-btn" href="#login">{t("เข้าสู่ระบบ / สมัคร","Login / Sign Up")}</a></div>
      </header>

      <section className="lp2-hero" id="top">
        <div className="lp2-copy">
          <h1 className="lp2-h1">Pichai Fintech<em>AI Trading Intelligence Platform</em></h1>
          <p className="lp2-tag"><span>{t("เทรดฉลาดขึ้น","Smarter Trading")}</span><i />{t("ประสิทธิภาพสูงขึ้น","Higher Performance")}<i />{t("กำไรมากขึ้น","Greater Profit")}</p>
          <p className="lp-lead">{t("AI อ่านว่าแต่ละคู่เงินกำลังเทรนขึ้น เทรนลง หรือไซด์เวย์ แล้วเลือกกลยุทธ์ที่รองรับ เซิร์ฟเวอร์ตรวจเงื่อนไขของกลยุทธ์ก่อนทุกครั้ง AI ไม่ได้สั่งเทรนเอง คุณกดสั่งพร้อมแผน SL/TP/RR ได้จากเทเลแกรม","AI reads whether each pair is trending up, down or sideways, then picks a supported strategy. The server checks the strategy's conditions every time. The AI never trades on its own: you tap to order, with an SL/TP/RR plan, from Telegram.")}</p>
          <div className="row">
            <a className="btn main lp-cta lp2-cta" href={EA_URL} rel="noopener"><Icon d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" size={20} />{t("เริ่มเทรดเลย (ดาวน์โหลด EA)","Start Trading Now")}</a>
            <a className="btn lp-cta lp2-ghost" href="#how"><Icon d="M8 5v14l11-7z" size={18} />{t("ดูเพิ่มเติม","Learn More")}</a>
          </div>
          <div className="mute">{t("สำหรับ MetaTrader 5 · เชื่อมกับเว็บด้วยรหัสจากผู้ดูแล","For MetaTrader 5 · connect to the site with a code from your admin")}</div>
        </div>
        <LaptopHero />
      </section>

      <section className="lp2-ticker" aria-label={t("ตัวอย่างราคา (จำลอง)","Sample prices (simulated)")}>
        {TICKER.map((x) => (
          <div key={x.s} className="lp2-tick"><span className="lp2-tick-ic" aria-hidden="true">{x.ic}</span><b>{x.s}</b><span>{x.p}</span><em className={x.up ? 'up' : 'dn'}>{x.c}</em></div>
        ))}
      </section>

      <section className="lp2-feats" id="platform" aria-label={t("ฟีเจอร์","Features")}>
        {feats.map((f, i) => (
          <a key={f.h} href={f.href} className="lp2-feat rv" style={{ transitionDelay: `${i * 60}ms` }}>
            <span className="lp2-feat-ic"><Icon d={f.icon} size={30} /></span>
            <b>{f.h}</b><span>{f.d}</span>
            <i className="lp2-go" aria-hidden="true">→</i>
          </a>
        ))}
      </section>

      <section className="lp2-panels" id="signals" aria-label={t("สัญญาณ ปฏิทินเศรษฐกิจ และเทเลแกรม","Signals, economic calendar and Telegram")}>
        <div className="lp2-panel rv">
          <div className="lp2-panel-h"><span>{t("สัญญาณล่าสุด","Latest Signals")}</span><a href="#login">{t("ดูทั้งหมด","View All")} →</a></div>
          <div className="tblwrap"><table className="lp2-tbl">
            <thead><tr><th>{t("สัญญาณ","Signal")}</th><th>{t("สัญลักษณ์","Symbol")}</th><th>{t("ทิศทาง","Direction")}</th><th>{t("ราคา","Price")}</th><th>{t("เวลา","Time")}</th></tr></thead>
            <tbody>{SIGNALS.map((x) => (
              <tr key={x.sym}><td className={x.side === 'BUY' ? 'up' : 'dn'}><b>{x.side}</b></td><td>{x.sym}</td><td className={x.side === 'BUY' ? 'up' : 'dn'}>{x.side === 'BUY' ? '▲' : '▼'}</td><td>{x.price}</td><td>{x.time}</td></tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="lp2-panel rv" style={{ transitionDelay: '80ms' }}>
          <div className="lp2-panel-h"><span>{t("ปฏิทินเศรษฐกิจ","Economic Calendar")}</span><a href="#desk">{t("ดูทั้งหมด","View All")} →</a></div>
          <div className="tblwrap"><table className="lp2-tbl">
            <thead><tr><th>{t("เวลา","Time")}</th><th>{t("สกุลเงิน","Currency")}</th><th>{t("เหตุการณ์","Event")}</th><th>{t("ผลกระทบ","Impact")}</th></tr></thead>
            <tbody>{CALENDAR.map((x) => (
              <tr key={x.ev}><td>{x.time}</td><td>{x.cur}</td><td>{x.ev}</td><td><span className={`lp2-imp ${x.imp.toLowerCase()}`}>{x.imp}</span></td></tr>
            ))}</tbody>
          </table></div>
        </div>

        <div className="lp2-panel lp2-tgp rv" id="telegram" style={{ transitionDelay: '160ms' }}>
          <div className="lp2-panel-h"><span><Icon d={PLANE} size={18} /> {t("ควบคุมการเทรดผ่านเทเลแกรม","Telegram Trade Control")}</span></div>
          <div className="lp2-tg-body">
            <div className="lp2-tg-ok">✓ {t("เชื่อมต่อแล้ว","Connected")}</div>
            <div className="lp2-tg-order"><b className="up">BUY XAUUSD</b><span>Lot: 0.01 | SL: 2,406.00 | TP: 2,442.00</span></div>
            <a className="btn lp-cta lp-tg-btn lp2-tg-cta" href={TG_URL} target="_blank" rel="noopener noreferrer"><Icon d={PLANE} size={18} />{t("เปิดบอทเทเลแกรม","Open Telegram bot")}</a>
          </div>
        </div>
        <div className="mute lp-note lp2-note">{t("ราคา สัญญาณ และข้อความในแผงนี้เป็นตัวอย่างจำลอง ไม่ใช่ข้อมูลตลาดจริง","Prices, signals and messages in these panels are simulated examples, not real market data.")}</div>
      </section>

      <section className="lp-sec lp2-loginsec" id="login" aria-label={t("สมาชิก","Member")}>
        <h2 className="lp-h2 rv">{t("สมาชิก: เข้าสู่ระบบ / สมัครใช้งาน","Member: log in / sign up")}</h2>
        <div className="lp-login lp-login-hero lp2-login">{children}</div>
      </section>

      <section className="lp-sec" id="desk" aria-labelledby="desk-h">
        <h2 id="desk-h" className="lp-h2 rv">{t("กราฟสด ถาม AI และข่าวออนไลน์ ในหน้าเดียว","Live chart, AI Q&A and online news in one place")}</h2>
        <MarketDesk pw="" hasKey={false} onLogin={onLogin} loginErr={loginErr} />
      </section>

      <section className="lp-sec" id="demo-sec" aria-labelledby="demo">
        <h2 id="demo" className="lp-h2 rv">{t("ดูการทำงานจริงแบบจำลอง","See it in action (simulated)")}</h2>
        <HeroStage />
        <div className="mute lp-note">{t("ภาพตัวอย่างจำลอง ราคาและข้อความไม่ใช่ข้อมูลตลาดจริง","Simulated demo. Prices and messages are not real market data.")}</div>
      </section>

      <section className="lp-sec" id="how" aria-labelledby="how-h">
        <h2 id="how-h" className="lp-h2 rv">{t("จากกราฟถึงออเดอร์ ใน 3 ขั้น","From chart to order in 3 steps")}</h2>
        <ol className="lp-steps">
          {steps.map((s, i) => (
            <li key={s.t} className="rv" style={{ transitionDelay: `${i * 120}ms` }}>
              <span className="lp-step-ic"><Icon d={s.icon} /><em>{i + 1}</em></span>
              <h3>{s.t}</h3>
              <p>{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="lp-sec lp-split" id="safe-sec" aria-labelledby="safe">
        <div>
          <h2 id="safe" className="lp-h2 rv">{t("ควบคุมความเสี่ยงได้ในตัว","Built-in risk control")}</h2>
          <div className="lp-ai-row rv">
            <div className="orb-wrap idle lp-mini-orb" aria-hidden="true"><div className="orb-glow" /><div className="orb-core" /></div>
            <p className="mute">{t("AI ช่วยอ่านสภาพตลาด แต่ไม่ได้สั่งเทรนเอง ทุกออเดอร์ผ่านด่านตรวจของ EA ก่อนเปิดเสมอ","The AI helps read the market but never trades on its own. Every order passes the EA's checks before it opens.")}</p>
          </div>
        </div>
        <ul className="lp-points">
          {points.map(([h, d], i) => <li key={h} className="rv" style={{ transitionDelay: `${i * 100}ms` }}><h3>{h}</h3><p>{d}</p></li>)}
        </ul>
      </section>

      <section className="lp-sec lp-get" id="get-started" aria-labelledby="get">
        <div className="lp-dl rv">
          <h2 id="get" className="lp-h2">{t("เริ่มใช้งาน","Get started")}</h2>
          <a className="btn main lp-cta" href={EA_URL} rel="noopener"><Icon d="M12 4v11m0 0-4-4m4 4 4-4M5 20h14" size={20} />{t("ดาวน์โหลด EA","Download EA")}</a>
          <a className="btn lp-cta lp-tg-btn" href={TG_URL} target="_blank" rel="noopener noreferrer"><Icon d={PLANE} size={20} />{t("เปิดบอทเทเลแกรม","Open Telegram bot")}</a>
          <a className="mute" href={EA_VIEW} target="_blank" rel="noopener noreferrer">{t("ดาวน์โหลดไม่ได้? เปิดไฟล์บน Google Drive","Can't download? Open the file on Google Drive")}</a>
          <ol className="lp-install">
            <li>{t("วางไฟล์ลงในโฟลเดอร์ ","Place the file in the folder ")}<code>MQL5/Experts</code>{t(" แล้วคอมไพล์ใน MetaEditor"," and compile it in MetaEditor")}</li>
            <li>{t("ใน MT5 ไปที่ Tools › Options › Expert Advisors เลือก Allow WebRequest แล้วเพิ่ม https://docs.google.com และ","In MT5 go to Tools › Options › Expert Advisors, tick Allow WebRequest and add ")}<code>{origin || t("ลิงก์เว็บนี้","this site's link")}</code></li>
            <li>{t("ใส่ ","Set ")}<code>Hub_Url</code>{t(" เป็นลิงก์เดียวกัน และ "," to the same link, and ")}<code>Hub_EAKey</code>{t(" ตามที่ผู้ดูแลออกให้"," as issued by your admin")}</li>
          </ol>
        </div>
      </section>

      <section className="lp-sec lp-contact rv" id="contact" aria-labelledby="contact-h">
        <img className="lp-promo-img" src="/mts-capital-futures.jpg" alt="MTS Capital เทรด Futures อย่างมั่นใจ มีใบอนุญาตจาก กลต. Meta Trader 5" width={494} height={619} loading="lazy" decoding="async" />
        <div className="lp-contact-txt">
          <h2 id="contact-h" className="lp-h2">{t("ติดต่อเรา","Contact us")}</h2>
          <p className="mute">{t("มีคำถามหรืออยากสมัครใช้งาน ทักไลน์ OA ได้เลย","Questions or want to sign up? Message us on LINE OA.")}</p>
          <a className="btn lp-cta lp-line-btn" href={LINE_URL} target="_blank" rel="noopener noreferrer"><Icon d={LINE_ICON} size={20} />{t("ติดต่อเรา ผ่าน LINE OA","Contact us on LINE OA")}</a>
        </div>
      </section>

      <footer className="lp-foot mute"><div className="lp2-foot-brand">Pichai Fintech · MT5 Signal Hub</div>{t("การเทรดมีความเสี่ยง ผลในอดีตและภาพตัวอย่างไม่รับประกันผลในอนาคต ควรทดสอบกับบัญชีทดลองก่อนใช้เงินจริง","Trading involves risk. Past results and demo visuals do not guarantee future results. Test on a demo account before using real money.")}</footer>
    </div>
  );
}
