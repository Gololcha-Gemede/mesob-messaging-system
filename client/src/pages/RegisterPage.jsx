import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import axios from 'axios';
import AuthPageLayout, { AuthInputRow } from '../components/AuthPageLayout';
import { ADMIN_REGISTER_SESSION_KEY } from '../utils/jwt';

export default function RegisterPage() {
  const location = useLocation();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState('staff');
  const [departmentId, setDepartmentId] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (location.state?.fromAdmin) {
      sessionStorage.setItem(ADMIN_REGISTER_SESSION_KEY, '1');
    }
  }, [location.state]);

  useEffect(() => {
    axios.get('/api/departments', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
      .then(res => {
        if (Array.isArray(res.data)) {
          setDepartments(res.data);
        } else if (res.data && Array.isArray(res.data.departments)) {
          setDepartments(res.data.departments);
        } else {
          setDepartments([]);
        }
      })
      .catch(() => setDepartments([]));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const body = new FormData();
      body.append('name', name);
      body.append('email', email);
      body.append('password', password);
      body.append('role', role);
      body.append('department_id', departmentId);
      if (profileImage) body.append('profile_image', profileImage);
      await axios.post('/api/users', body, { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });
      sessionStorage.removeItem(ADMIN_REGISTER_SESSION_KEY);
      setSuccess('User registered successfully!');
      setName(''); setEmail(''); setPassword(''); setRole('staff'); setDepartmentId(''); setProfileImage(null);
      setError('');
    } catch {
      setError('Registration failed.');
      setSuccess('');
    }
  };

  return (
    <AuthPageLayout
      title="Register user"
      subtitle="Create a staff or admin account"
      footerLink={{ to: '/admin', label: '← Back to admin' }}
    >
      <form className="auth-form" onSubmit={handleSubmit}>
        <AuthInputRow icon="user">
          <input
            className="auth-field"
            type="text"
            placeholder="Full name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </AuthInputRow>
        <AuthInputRow icon="email">
          <input
            className="auth-field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </AuthInputRow>
        <AuthInputRow icon="lock">
          <div className="auth-password-wrap">
            <input
              className="auth-field"
              type={showPassword ? 'text' : 'password'}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
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
        <AuthInputRow icon="list">
          <select className="auth-field auth-select" value={role} onChange={e => setRole(e.target.value)} required>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </AuthInputRow>
        <AuthInputRow icon="list">
          <select className="auth-field auth-select" value={departmentId} onChange={e => setDepartmentId(e.target.value)} required>
            <option value="">Select department</option>
            {Array.isArray(departments) && departments.length > 0 && departments.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </AuthInputRow>
        <label className="auth-file-field">
          <span>Profile picture</span>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setProfileImage(e.target.files?.[0] || null)}
          />
        </label>
        <button type="submit" className="auth-submit">
          Register
        </button>
        {success ? <div className="auth-success">{success}</div> : null}
        {error ? <div className="auth-error">{error}</div> : null}
      </form>
    </AuthPageLayout>
  );
}
