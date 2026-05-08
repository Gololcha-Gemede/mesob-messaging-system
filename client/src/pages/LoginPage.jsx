import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import AuthPageLayout, { AuthInputRow } from '../components/AuthPageLayout';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('/api/auth/login', { email, password });
      localStorage.setItem('token', res.data.token);
      navigate('/');
    } catch {
      setError('Invalid credentials');
    }
  };

  return (
    <AuthPageLayout
      title="Sign in"
      subtitle="Internal Message Management System"
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthInputRow icon="email">
          <input
            className="auth-field"
            type="email"
            placeholder="Email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
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
              required
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
        <button type="submit" className="auth-submit">
          Login
        </button>
        {error ? <div className="auth-error">{error}</div> : null}
      </form>
    </AuthPageLayout>
  );
}
