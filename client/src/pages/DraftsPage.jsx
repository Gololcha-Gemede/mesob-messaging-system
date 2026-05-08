import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function DraftsPage() {
  const [messages, setMessages] = useState([]);
  const [filterValue, setFilterValue] = useState('');

  const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (filterValue.trim()) params.set('subject', filterValue.trim());
      const qs = params.toString();
      axios
        .get(`/api/messages/drafts${qs ? `?${qs}` : ''}`, authHeaders)
        .then((res) => setMessages(res.data))
        .catch(() => setMessages([]));
    }, 300);
    return () => clearTimeout(t);
  }, [filterValue]);

  return (
    <div className="drafts-container">
      <h2>Drafts</h2>
      <div className="message-filters" role="search" aria-label="Filter drafts">
        <input
          className="message-filter-input"
          type="search"
          placeholder="Filter by subject"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          autoComplete="off"
        />
      </div>
      <ul className="message-list">
        {messages.map((msg) => (
          <li key={msg.id} className="message-item">
            <Link to={`/messages/${msg.id}`}>
              <div className="message-item-title">{msg.subject || '(No subject)'}</div>
              <div className="message-item-meta">
                <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
