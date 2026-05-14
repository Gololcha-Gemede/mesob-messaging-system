import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function SentPage() {
  const [messages, setMessages] = useState([]);
  const [filterBy, setFilterBy] = useState('subject');
  const [filterValue, setFilterValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (filterValue.trim()) params.set(filterBy, filterValue.trim());
      const qs = params.toString();
      setLoading(true);
      setError('');
      axios
        .get(`/api/messages/sent${qs ? `?${qs}` : ''}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
        })
        .then((res) => {
          if (ignore) return;
          setMessages(Array.isArray(res.data) ? res.data : []);
        })
        .catch((err) => {
          if (ignore) return;
          setMessages([]);
          setError(err?.response?.data?.message || 'Unable to load sent messages.');
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [filterBy, filterValue]);

  return (
    <div className="sent-container">
      <h2>Sent Messages</h2>
      <div className="message-filters" role="search" aria-label="Filter sent messages">
        <select
          className="message-filter-select"
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value)}
          aria-label="Filter sent messages by"
        >
          <option value="subject">Subject</option>
          <option value="reference">Reference number</option>
        </select>
        <input
          className="message-filter-input"
          type="search"
          placeholder={`Filter by ${filterBy === 'subject' ? 'subject' : 'reference number'}`}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          autoComplete="off"
        />
      </div>
      {error ? <div className="error banner-message">{error}</div> : null}
      {loading ? <div className="list-state">Loading sent messages...</div> : null}
      <ul className="message-list">
        {!loading && messages.map((msg) => (
          <li key={msg.id} className="message-item">
            <Link to={`/messages/${msg.id}`}>
              <div className="message-item-title">{msg.subject || '(No subject)'}</div>
              <div className="message-item-meta">
                <span>{msg.reference_number}</span>
                <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                <span className="message-state message-state--sent">Sent</span>
                {msg.read_at ? <span className="message-state message-state--read">Read</span> : <span className="message-state message-state--delivered">Delivered</span>}
                {msg.file_path ? <span className="attachment-indicator">Attachment</span> : null}
                {msg.due_date ? <span className="priority-label">Priority</span> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && !messages.length ? (
        <div className="empty-state">No sent messages found.</div>
      ) : null}
    </div>
  );
}
