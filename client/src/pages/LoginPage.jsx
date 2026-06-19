import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthPageLayout, { AuthInputRow } from '../components/AuthPageLayout';
import { LOGIN_ENTRANCE_KEY } from '../utils/jwt';

function isCapsLockOn(e) {
  return Boolean(e?.getModifierState && e.getModifierState('CapsLock'));
}

const REMEMBERED_EMAIL_KEY = 'imms_remembered_email';

export default function LoginPage() {
  const [email, setEmail] = useState(() => localStorage.getItem(REMEMBERED_EMAIL_KEY) || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => Boolean(localStorage.getItem(REMEMBERED_EMAIL_KEY)));
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  const navigate = useNavigate();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    const existingToken = sessionStorage.getItem('token');
    if (existingToken) {
      navigate('/', { replace: true });
      return;
    }
    emailRef.current?.focus?.();
  }, [navigate]);

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(false), 520);
    return () => window.clearTimeout(t);
  }, [shake]);

  const storeToken = (token) => {
    sessionStorage.setItem('token', token);
    localStorage.removeItem('token');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      emailRef.current?.focus();
      return;
    }

    if (!password) {
      setError('Please enter your password.');
      passwordRef.current?.focus();
      return;
    }

    setError('');
    setSubmitting(true);

    try {
      const res = await axios.post('/api/auth/login', { email: cleanEmail, password });
      if (rememberMe) {
        localStorage.setItem(REMEMBERED_EMAIL_KEY, cleanEmail);
      } else {
        localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      }
      storeToken(res.data.token);
      setLoginSuccess(true);
      sessionStorage.setItem(LOGIN_ENTRANCE_KEY, '1');
      window.setTimeout(() => navigate('/'), 720);
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      setError(serverMessage || 'Invalid credentials');
      setShake(true);
      emailRef.current?.focus?.();
      setSubmitting(false);
    }
  };

  return (
    <AuthPageLayout
      title="Sign in"
      subtitle="Internal Message Management A-Mesob | Lideta Center"
      className={loginSuccess ? 'auth-fullscreen--success' : ''}
    >
      {loginSuccess ? (
        <div className="auth-login-success" role="status" aria-live="polite">
          <span className="auth-login-success-icon" aria-hidden>✓</span>
          <strong>Welcome back</strong>
          <span>Opening your workspace...</span>
        </div>
      ) : null}
      <form className={`auth-form ${shake ? 'auth-form--shake' : ''} ${loginSuccess ? 'auth-form--hidden' : ''}`} onSubmit={handleSubmit}>
        <AuthInputRow icon="email">
          <input
            ref={emailRef}
            className="auth-field"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (error) setError('');
            }}
            required
            aria-label="Email"
            autoCapitalize="none"
            spellCheck="false"
          />
          {email ? (
            <button
              type="button"
              className="auth-field-clear"
              onClick={() => {
                setEmail('');
                localStorage.removeItem(REMEMBERED_EMAIL_KEY);
                emailRef.current?.focus();
              }}
              aria-label="Clear email"
              title="Clear email"
            >
              x
            </button>
          ) : null}
        </AuthInputRow>

        <AuthInputRow icon="lock">
          <div className="auth-password-wrap">
            <input
              ref={passwordRef}
              className="auth-field"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              onKeyUp={(e) => setCapsLockOn(isCapsLockOn(e))}
              onBlur={() => setCapsLockOn(false)}
              required
              aria-label="Password"
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
                {showPassword ? <path d="M3 3l18 18" /> : null}
              </svg>
            </button>
          </div>
        </AuthInputRow>

        <div className="auth-subrow">
          <label className="auth-remember">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
          <button
            type="button"
            className="auth-help-link"
            onClick={() => {
              setError('Please contact your system administrator to reset your password.');
              setShake(true);
            }}
          >
            Forgot password?
          </button>
        </div>

        {capsLockOn ? (
          <div className="auth-caps" role="status" aria-live="polite">
            Caps Lock is ON
          </div>
        ) : null}

        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting && <span className="auth-submit-spinner" aria-hidden />}
          <span>{submitting ? 'Signing in...' : 'Sign in'}</span>
        </button>

        {error ? (
          <div className="auth-error" role="alert">
            {error}
          </div>
        ) : null}
      </form>
    </AuthPageLayout>
  );
}
