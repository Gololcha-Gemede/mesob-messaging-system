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

function displayUser(name, id) {
  return name || (id ? `User #${id}` : 'Unassigned');
}

export default function TrackMessagePage() {
  const [reference, setReference] = useState('');
  const [subject, setSubject] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [messages, setMessages] = useState([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const token = sessionStorage.getItem('token');
  const isManager = token ? roleFromToken(token) === 'manager' : false;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessages([]);
    setSearched(false);

    const cleanReference = reference.trim();
    const cleanSubject = subject.trim();
    if (!cleanReference && !cleanSubject && !dateFrom && !dateTo) {
      setError('Enter a reference number, subject, or date filter.');
      return;
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setError('Start date must be before or equal to end date.');
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (cleanReference) params.set('reference', cleanReference);
      if (cleanSubject) params.set('subject', cleanSubject);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
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
          placeholder="Example: HRD/001/2026"
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

        <label htmlFor="track-date-from">From date</label>
        <input
          id="track-date-from"
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
        />

        <label htmlFor="track-date-to">To date</label>
        <input
          id="track-date-to"
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
        />

        <button type="submit" disabled={loading}>{loading ? 'Tracking...' : 'Track Message'}</button>
      </form>

      {error ? <div className="error">{error}</div> : null}

      {searched ? (
        <div className="detail-section">
          <h3>{messages.length ? `Results (${messages.length})` : 'No matching messages'}</h3>
          <ul className="message-list">
            {messages.map((msg) => {
              const isForwarded = Boolean(msg.parent_message_id);
              const sentAt = formatDate(msg.submitted_at || msg.created_at);
              const forwardedAt = formatDate(msg.forwarded_at || msg.submitted_at || msg.created_at);
              const forwardedBy = displayUser(msg.forwarded_by_name || msg.sender_name, msg.forwarded_by_id || msg.sender_id);
              const receiver = displayUser(msg.receiver_name, msg.receiver_id);
              return (
                <li key={msg.id} className="message-item">
                  <Link to={`/messages/${msg.id}`}>
                    <div className="message-item-title">{msg.subject || '(No subject)'}</div>
                    <div className="message-item-meta">
                      <span className="track-chain-step">{Number(msg.chain_depth || 0) + 1}</span>
                      <span>{msg.reference_number}</span>
                      <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                      <span>From {displayUser(msg.sender_name, msg.sender_id)}</span>
                      <span>To {receiver}</span>
                      {!isForwarded && sentAt ? <span>Sent {sentAt}</span> : null}
                      {isForwarded ? (
                        <span className="forward-chain-note">
                          Forwarded to {receiver} by {forwardedBy}{forwardedAt ? ` at ${forwardedAt}` : ''}
                        </span>
                      ) : null}
                      {isForwarded && msg.parent_reference_number ? (
                        <span>Original step {msg.parent_reference_number}</span>
                      ) : null}
                      {msg.forward_note ? <span>Note: {msg.forward_note}</span> : null}
                      {msg.read_at ? <span>Read {formatDate(msg.read_at)}</span> : <span>Unread</span>}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          {!isManager ? <p className="admin-panel-hint">Tracking shows chains where you are a sender or receiver, including forwarded recipients.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
