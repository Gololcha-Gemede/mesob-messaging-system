import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function InboxPage() {
  const [messages, setMessages] = useState([]);
  const [filterBy, setFilterBy] = useState('subject');
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (filterValue.trim()) params.set(filterBy, filterValue.trim());
      if (statusFilter) params.set('status', statusFilter);
      const qs = params.toString();
      setLoading(true);
      setError('');
      axios
        .get(`/api/messages/inbox${qs ? `?${qs}` : ''}`, {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` }
        })
        .then((res) => {
          if (ignore) return;
          setMessages(Array.isArray(res.data) ? res.data : []);
          setPage(1);
        })
        .catch((err) => {
          if (ignore) return;
          setMessages([]);
          setError(err?.response?.data?.message || 'Unable to load inbox messages.');
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [filterBy, filterValue, statusFilter]);

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(messages.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleMessages = useMemo(
    () => messages.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [messages, currentPage]
  );

  return (
    <div className="inbox-container">
      <h2>Inbox</h2>

      <div className="inbox-filters-panel">
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
          <select
            className="status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="">All Status</option>
            <option value="delivered">Delivered</option>
            <option value="read">Read</option>
            <option value="unread">Unread</option>
          </select>
        </div>
      </div>

      {error ? <div className="error banner-message">{error}</div> : null}
      {loading ? <div className="list-state">Loading messages...</div> : null}

      {!loading && messages.length > 0 && (
        <div className="inbox-section">
          <h3 className="inbox-section-title">Messages ({messages.length})</h3>
          <ul className="message-list">
            {visibleMessages.map((msg, index) => (
              <li
                key={msg.id}
                className="message-item message-item--inbox"
                style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
              >
                <Link to={`/messages/${msg.id}`} className="message-item-row">
                  <div className="message-item-content">
                    <div className="message-item-title">{msg.subject || '(No subject)'}</div>
                    <div className="message-item-meta">
                      <span className="message-ref">{msg.reference_number}</span>
                      <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                      {!msg.read_at ? <span className="message-state message-state--unread">Unread</span> : null}
                      {msg.file_path ? <span className="attachment-indicator">📎</span> : null}
                      <span className="message-date">{formatDate(msg.created_at)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <div className="pagination-row">
              <button type="button" className="secondary-btn" disabled={currentPage <= 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>Previous</button>
              <span>Page {currentPage} of {totalPages}</span>
              <button type="button" className="secondary-btn" disabled={currentPage >= totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>Next</button>
            </div>
          ) : null}
        </div>
      )}

      {!loading && !messages.length ? (
        <div className="empty-state">📭 No inbox messages found.</div>
      ) : null}
    </div>
  );
}
