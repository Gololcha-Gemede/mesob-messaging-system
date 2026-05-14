import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthPageLayout, { AuthInputRow } from '../components/AuthPageLayout';

function isCapsLockOn(e) {
  // e.getModifierState works in modern browsers; fallback to false.
  return Boolean(e?.getModifierState && e.getModifierState('CapsLock'));
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [shake, setShake] = useState(false);

  const navigate = useNavigate();
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus?.();
  }, []);

  useEffect(() => {

    if (!error) return;
    // keep focus on the email field so the user can fix input quickly
    emailRef.current?.focus?.();
  }, [error]);

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(false), 520);
    return () => window.clearTimeout(t);
  }, [shake]);

  const storeToken = (token) => {
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

    setSubmitting(true);
    setError('');
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      storeToken(res.data.token);
      navigate('/');
    } catch (err) {
      const serverMessage = err?.response?.data?.message;
      setError(serverMessage || 'Invalid credentials');
      setShake(true);
    } finally {
      setSubmitting(false);
    }
  };


  const passwordFeedback = useMemo(() => {
    if (!password) return '';
    if (password.length < 8) return 'Password should be at least 8 characters.';
    return '';
  }, [password]);

  return (
    <AuthPageLayout title="Sign in" subtitle="Internal Message Management System">
      <form className={`auth-form ${shake ? 'auth-form--shake' : ''}`} onSubmit={handleSubmit}>
        <AuthInputRow icon="email">
          <input
            ref={emailRef}
            className="auth-field"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            aria-label="Email"
          />
        </AuthInputRow>

        <AuthInputRow icon="lock">
          <div className="auth-password-wrap">
            <input
              className="auth-field"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyUp={(e) => setCapsLockOn(isCapsLockOn(e))}
              required
              aria-label="Password"
            />
            <button
              type="button"
              className="auth-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                <circle cx="12" cy="12" r="3" />
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
            className="auth-link"
            onClick={() => {
              setError('Forgot password is not available yet.');
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
        {passwordFeedback ? <div className="auth-hint">{passwordFeedback}</div> : null}


        <button type="submit" className="auth-submit" disabled={submitting}>
          {submitting ? (
            <span className="auth-submit-spinner" aria-hidden />
          ) : null}
          {submitting ? 'Signing in...' : 'Sign in'}
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

