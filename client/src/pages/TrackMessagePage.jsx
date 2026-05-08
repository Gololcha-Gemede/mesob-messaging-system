import { useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { roleFromToken } from '../utils/jwt';

function formatDate(value) {
  if (!value) return '';
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString();
  } catch {
    return '';
  }
}

export default function TrackMessagePage() {
  const [reference, setReference] = useState('');
  const [subject, setSubject] = useState('');
  const [messages, setMessages] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const isAdmin = roleFromToken(token) === 'admin';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessages([]);
    setSearched(false);

    const cleanReference = reference.trim();
    const cleanSubject = subject.trim();
    if (!cleanReference && !cleanSubject) {
      setError('Enter a reference number or subject.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cleanReference) params.set('reference', cleanReference);
      if (cleanSubject) params.set('subject', cleanSubject);
      const res = await axios.get(`/api/messages/track?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(Array.isArray(res.data) ? res.data : []);
      setSearched(true);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not track message.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="track-container">
      <h2>Track Message</h2>
      <form className="track-form" onSubmit={handleSubmit}>
        <label htmlFor="track-reference">Reference number</label>
        <input
          id="track-reference"
          type="search"
          placeholder="Example: HR-2026-0001"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          autoComplete="off"
        />

        <label htmlFor="track-subject">Subject</label>
        <input
          id="track-subject"
          type="search"
          placeholder="Message subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          autoComplete="off"
        />

        <button type="submit" disabled={loading}>{loading ? 'Tracking...' : 'Track Message'}</button>
      </form>

      {error ? <div className="error">{error}</div> : null}

      {searched ? (
        <div className="detail-section">
          <h3>{messages.length ? `Results (${messages.length})` : 'No matching messages'}</h3>
          <ul className="message-list">
            {messages.map((msg) => (
              <li key={msg.id} className="message-item">
                <Link to={`/messages/${msg.id}`}>
                  <div className="message-item-title">{msg.subject || '(No subject)'}</div>
                  <div className="message-item-meta">
                    <span>{msg.reference_number}</span>
                    <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                    <span>From {msg.sender_name || `User #${msg.sender_id}`}</span>
                    <span>To {msg.receiver_name || `User #${msg.receiver_id}`}</span>
                    {formatDate(msg.submitted_at || msg.created_at) ? <span>{formatDate(msg.submitted_at || msg.created_at)}</span> : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {!isAdmin ? <p className="admin-panel-hint">Staff tracking only shows messages you sent.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
