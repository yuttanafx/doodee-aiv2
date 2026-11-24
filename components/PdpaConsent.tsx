'use client';
import { useEffect, useState } from 'react';
import { useLang } from '@/lib/i18n';

// PDPA notice: shown once, the answer is remembered on this device only (localStorage 'pdpa').
// The site stores only what it needs to work (login password in this browser, theme, language, remembered video link).
// NOTE: this is a plain notice, not legal advice. Have the wording reviewed before relying on it.
export default function PdpaConsent() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (!localStorage.getItem('pdpa')) setOpen(true); } catch {}
    const f = () => setOpen(true);
    window.addEventListener('pdpa-open', f);
    return () => window.removeEventListener('pdpa-open', f);
  }, []);
  const answer = (v: 'yes' | 'no') => { try { localStorage.setItem('pdpa', v); } catch {} setOpen(false); };
  if (!open) return null;
  return (
    <div className="pdpa-back" role="dialog" aria-modal="true" aria-labelledby="pdpa-h">
      <div className="pdpa card" style={{ display: 'grid', gap: 12 }}>
        <h2 id="pdpa-h" className="pdpa-h">{t('ความเป็นส่วนตัวของคุณ', 'Your privacy')}</h2>
        <div className="pdpa-body">
          <p>{t('เว็บนี้เก็บข้อมูลที่จำเป็นต่อการใช้งานไว้ในเบราว์เซอร์ของคุณ เช่น รหัสผ่านที่ใช้เข้าสู่ระบบ ธีม ภาษา และลิงก์วิดีโอที่จำไว้ ข้อมูลบัญชีและการตั้งค่าเทรดเก็บบนเซิร์ฟเวอร์ของผู้ให้บริการเพื่อให้ระบบทำงาน', 'This site keeps the data it needs to work in your browser: your login password, theme, language and the video link you saved. Account and trading settings are stored on the provider\u2019s server so the system can run.')}</p>
          <p>{t('API key ของ AI ถูกเข้ารหัสก่อนเก็บ และใช้เรียก AI ตามที่คุณสั่งเท่านั้น', 'Your AI API keys are encrypted before storage and used only to call the AI when you ask.')}</p>
        </div>
        <div className="pdpa-act">
          <button className="btn main" onClick={() => answer('yes')}>{t('รับทราบและยอมรับ', 'Accept')}</button>
          <button className="btn" onClick={() => answer('no')}>{t('ปิด', 'Close')}</button>
        </div>
      </div>
    </div>
  );
}
