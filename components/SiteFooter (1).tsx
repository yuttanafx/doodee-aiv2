'use client';
import { useLang } from '@/lib/i18n';

// Site-wide footer: copyright line + a button that re-opens the PDPA consent popup.
export default function SiteFooter() {
  const { t } = useLang();
  return (
    <footer className="site-foot mute">
      <div className="site-foot-links">
        <button type="button" className="site-foot-btn" onClick={() => window.dispatchEvent(new Event('pdpa-open'))}>{t('ตั้งค่าความเป็นส่วนตัว (PDPA)', 'Privacy settings (PDPA)')}</button>
      </div>
      <div style={{ fontSize: 13 }}>© {new Date().getFullYear()} Pichai Fintech · MT5 Signal Hub</div>
    </footer>
  );
}
