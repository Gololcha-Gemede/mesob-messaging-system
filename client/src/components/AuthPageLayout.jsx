import { Link } from 'react-router-dom';

const QMS_LOGO = '/mesoblogo.webp';

function IconEmail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}

function IconLock() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function IconUser() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconList() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

export function AuthInputRow({ icon = 'user', children, className = '' }) {
  const Icon = icon === 'email' ? IconEmail : icon === 'lock' ? IconLock : icon === 'list' ? IconList : IconUser;
  return (
    <div className={`auth-input-row ${className}`.trim()}>
      <span className="auth-input-icon" aria-hidden>
        <Icon />
      </span>
      {children}
    </div>
  );
}

/**
 * Layout matched to QMS MESOB login (http://10.10.41.70/login): fullscreen photo + overlay, blue two-column card.
 */
export default function AuthPageLayout({ title, subtitle, children, footerLink, className = '' }) {
  return (
    <div className={['auth-fullscreen', className].filter(Boolean).join(' ')}>
      <div className="auth-panel" role="region" aria-label={title}>
        <div className="auth-panel-brand">
          <div className="auth-panel-logo-wrap" aria-hidden="true">
            <img
              className="auth-panel-logo"
              src={QMS_LOGO}
              alt=""
              width={200}
              height={200}
              onError={(e) => {
                e.currentTarget.closest('.auth-panel-logo-wrap')?.style.setProperty('display', 'none');
              }}
            />
          </div>
          <p className="auth-panel-tagline">Internal Message Management - MESOB</p>
        </div>
        <div className="auth-panel-form">
          <h1 className="auth-title">{title}</h1>
          {subtitle ? <p className="auth-subtitle">{subtitle}</p> : null}
          {children}
          {footerLink ? (
            <p className="auth-footer-link">
              <Link to={footerLink.to}>{footerLink.label}</Link>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
