import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const DEEP_NAVY = '#071B5A';
const DEEP_NAVY_2 = '#0A1F66';
const GOLD = '#F6B800';
const GOLD_2 = '#F4B51A';

function IconMail() {
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

function IconShield() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-5" />
    </svg>
  );
}

function IconFingerprintCircuit() {
  return (
    <svg width="96" height="96" viewBox="0 0 96 96" fill="none" aria-hidden>
      <defs>
        <linearGradient id="gGold" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor={GOLD} />
          <stop offset="1" stopColor={GOLD_2} />
        </linearGradient>
        <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <g filter="url(#glow)" stroke="url(#gGold)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity="0.95">
        <path d="M28 56c0-10.5 8.5-19 19-19 10.5 0 19 8.5 19 19" />
        <path d="M35 56c0-6.5 5.5-12 12-12s12 5.5 12 12" />
        <path d="M42 56c0-2.5 2-5 5-5s5 2.5 5 5" />
        <circle cx="47" cy="56" r="4" />

        <path d="M47 16v8" />
        <path d="M47 72v8" />
        <path d="M16 47h8" />
        <path d="M72 47h8" />

        <path d="M26 30l6 6" />
        <path d="M68 66l6 6" />
        <path d="M68 30l-6 6" />
        <path d="M28 66l6-6" />

        <path d="M17 60l6-2" />
        <path d="M79 38l-6 2" />
        <path d="M60 79l-2-6" />
        <path d="M38 17l2 6" />

        <path d="M33 46h-10" />
        <path d="M73 50H63" />
        <path d="M47 33V23" />
        <path d="M47 73V63" />

        <circle cx="23" cy="47" r="2" fill="url(#gGold)" />
        <circle cx="73" cy="47" r="2" fill="url(#gGold)" />
        <circle cx="47" cy="23" r="2" fill="url(#gGold)" />
        <circle cx="47" cy="73" r="2" fill="url(#gGold)" />
      </g>
    </svg>
  );
}

function ParticleField() {
  // lightweight, no external deps
  const dots = useMemo(() => {
    const count = 22;
    return Array.from({ length: count }).map((_, i) => {
      const left = Math.random() * 100;
      const top = Math.random() * 100;
      const size = 2 + Math.random() * 3;
      const delay = Math.random() * 3;
      const duration = 6 + Math.random() * 6;
      const alpha = 0.25 + Math.random() * 0.35;
      return { id: i, left, top, size, delay, duration, alpha };
    });
  }, []);

  return (
    <div aria-hidden className="login-particles">
      {dots.map((d) => (
        <span
          key={d.id}
          className="login-particle"
          style={{
            left: `${d.left}%`,
            top: `${d.top}%`,
            width: d.size,
            height: d.size,
            opacity: d.alpha,
            animationDelay: `${d.delay}s`,
            animationDuration: `${d.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function LoginPageNew() {
  const navigate = useNavigate();
  const emailRef = useRef(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    emailRef.current?.focus?.();
  }, []);

  const passwordHint = useMemo(() => {
    if (!password) return '';
    if (password.length < 8) return 'Use at least 8 characters.';
    return '';
  }, [password]);

  const isCapsLockOn = (e) => Boolean(e?.getModifierState && e.getModifierState('CapsLock'));

  const storeToken = (token) => {
    // keep compatibility with app
    if (rememberMe) {
      localStorage.setItem('token', token);
      sessionStorage.removeItem('token');
    } else {
      sessionStorage.setItem('token', token);
      localStorage.removeItem('token');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);

    try {
      const res = await axios.post('/api/auth/login', { email, password });
      storeToken(res.data.token);
      navigate('/');
    } catch (err) {
      setError(err?.response?.data?.message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-root">
      <ParticleField />

      <div className="login-bg" aria-hidden />
      <div className="login-overlay" aria-hidden />

      <div className="login-shell">
        <div className="login-card" role="region" aria-label="Sign in">
          <div className="login-card-glow" aria-hidden />

          <div className="login-grid">
            {/* Left: branding */}
            <section className="login-left" aria-label="Organization">
              <div className="login-emblem">
                <div className="login-emblem-ring" aria-hidden />
                <div className="login-emblem-inner">
                  <div className="login-emblem-icon" aria-hidden>
                    <IconFingerprintCircuit />
                  </div>
                </div>
              </div>

              <div className="login-left-brand">
                <div className="login-left-brand-title">Internal Message Management</div>
                <div className="login-left-brand-sub">• MESOB</div>
              </div>
            </section>

            {/* Right: form */}
            <section className="login-right" aria-label="Sign in form">
              <div className="login-right-inner">
                <header className="login-header">
                  <h1 className="login-title">Sign in</h1>
                  <p className="login-subtitle">Internal Message Management System</p>
                </header>

                <form className="login-form" onSubmit={handleSubmit}>
                  <div className="field">
                    <label className="sr-only" htmlFor="email">Email</label>
                    <div className="field-icon">
                      <IconMail />
                    </div>
                    <input
                      ref={emailRef}
                      id="email"
                      type="email"
                      placeholder="Email"
                      value={email}
                      autoComplete="username"
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label className="sr-only" htmlFor="password">Password</label>
                    <div className="field-icon">
                      <IconLock />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Password"
                      value={password}
                      autoComplete="current-password"
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyUp={(e) => setCapsLockOn(isCapsLockOn(e))}
                      required
                    />

                    <button
                      type="button"
                      className="field-eye"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      title={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  <div className="login-row">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                      />
                      <span>Remember me</span>
                    </label>

                    <a
                      className="forgot"
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setError('Forgot password is not available yet.');
                      }}
                    >
                      Forgot password?
                    </a>
                  </div>

                  {capsLockOn ? <div className="caps">Caps Lock is ON</div> : null}
                  {passwordHint ? <div className="hint">{passwordHint}</div> : null}

                  {error ? <div className="error" role="alert">{error}</div> : null}

                  <button type="submit" className="sign-btn" disabled={submitting}>
                    <span className="sign-btn-icon" aria-hidden>
                      <IconLock />
                    </span>
                    <span className="sign-btn-text">{submitting ? 'Signing in…' : 'Sign in'}</span>
                    <span className="sign-btn-shine" aria-hidden />
                  </button>

                  <div className="secure">
                    <span className="secure-icon" aria-hidden><IconShield /></span>
                    <span>Secure authentication • Encrypted session</span>
                  </div>
                </form>
              </div>
            </section>
          </div>
        </div>
      </div>

      <style>{`
        /* --- LoginPageNew modernization (polish only; branding & logic preserved) --- */
        @import url('https://
