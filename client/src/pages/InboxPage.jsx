import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { useSSE } from '../hooks/useSSE';
import PaginationRow from '../components/PaginationRow';
import { authHeaders } from '../utils/api';
import { formatMessageListDate } from '../utils/dateFormat';

export default function InboxPage() {
  const [messages, setMessages] = useState([]);
  const [filterBy, setFilterBy] = useState('subject');
  const [filterValue, setFilterValue] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const token = sessionStorage.getItem('token');

  const fetchInbox = useCallback(() => {
    const params = new URLSearchParams();
    if (filterValue.trim()) params.set(filterBy, filterValue.trim());
    if (statusFilter) params.set('status', statusFilter);
    const qs = params.toString();
    setError('');
    axios
      .get(`/api/messages/inbox${qs ? `?${qs}` : ''}`, {
        headers: authHeaders(token)
      })
      .then((res) => {
        setMessages(Array.isArray(res.data) ? res.data : []);
        setPage(1);
      })
      .catch((err) => {
        setMessages([]);
        setError(err?.response?.data?.message || 'Unable to load inbox messages.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token, filterBy, filterValue, statusFilter]);

  useSSE(token, {
    onNewMessage: () => {
      fetchInbox();
    }
  });

  useEffect(() => {
    let ignore = false;
    const t = setTimeout(() => {
      if (ignore) return;
      setLoading(true);
      fetchInbox();
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [fetchInbox]);

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
                      {msg.read_at ? (
                        <span className="message-state message-state--read">Read</span>
                      ) : (
                        <span className="message-state message-state--unread">Unread</span>
                      )}
                      {msg.is_formal_letter ? <span className="letter-indicator">Formal Letter</span> : null}
                      {msg.file_path ? <span className="attachment-indicator">Attachment</span> : null}
                      {msg.due_date ? <span className="priority-label">Priority</span> : null}
                      <span className="message-date">{formatMessageListDate(msg.created_at)}</span>
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {totalPages > 1 ? (
            <PaginationRow currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
          ) : null}
        </div>
      )}

      {!loading && !messages.length ? (
        <div className="empty-state">No inbox messages found.</div>
      ) : null}
    </div>
  );
}
