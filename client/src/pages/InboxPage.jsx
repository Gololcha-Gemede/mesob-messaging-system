import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

export default function InboxPage() {
  const [messages, setMessages] = useState([]);
  const [filterBy, setFilterBy] = useState('subject');
  const [filterValue, setFilterValue] = useState('');

  const authHeaders = { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } };

  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (filterValue.trim()) params.set(filterBy, filterValue.trim());
      const qs = params.toString();
      axios
        .get(`/api/messages/inbox${qs ? `?${qs}` : ''}`, authHeaders)
        .then((res) => setMessages(res.data))
        .catch(() => setMessages([]));
    }, 300);
    return () => clearTimeout(t);
  }, [filterBy, filterValue]);

  return (
    <div className="inbox-container">
      <h2>Inbox</h2>
      <div className="message-filters" role="search" aria-label="Filter inbox">
        <select
          className="message-filter-select"
          value={filterBy}
          onChange={(e) => setFilterBy(e.target.value)}
          aria-label="Filter inbox by"
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
      <ul className="message-list">
        {messages.map((msg) => (
          <li key={msg.id} className="message-item">
            <Link to={`/messages/${msg.id}`}>
              <div className="message-item-title">{msg.subject || '(No subject)'}</div>
              <div className="message-item-meta">
                <span>{msg.reference_number}</span>
                <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                {['submitted', 'received', 'in_review'].includes(msg.status) && <b> *</b>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
