import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PaginationRow from '../components/PaginationRow';
import { api, authHeaders } from '../utils/api';
import { formatMessageListDate } from '../utils/dateFormat';

export default function SentPage() {
  const [messages, setMessages] = useState([]);
  const [filterBy, setFilterBy] = useState('subject');
  const [filterValue, setFilterValue] = useState('');
  const [page, setPage] = useState(1);
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
      api
        .get(`/api/messages/sent${qs ? `?${qs}` : ''}`, {
          headers: authHeaders()
        })
        .then((res) => {
          if (ignore) return;
          setMessages(Array.isArray(res.data) ? res.data : []);
          setPage(1);
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

  const pageSize = 8;
  const totalPages = Math.max(1, Math.ceil(messages.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const visibleMessages = useMemo(
    () => messages.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [messages, currentPage]
  );

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
        {!loading && visibleMessages.map((msg, index) => (
          <li
            key={msg.id}
            className="message-item message-item--sent"
            style={{ animationDelay: `${Math.min(index, 12) * 0.04}s` }}
          >
            <Link to={`/messages/${msg.id}`} className="message-item-row">
              <div className="message-item-content">
                <div className="message-item-title">{msg.subject || '(No subject)'}</div>
                <div className="message-item-meta">
                  <span className="message-ref">{msg.reference_number}</span>
                  <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                  <span className="message-state message-state--sent">Sent</span>
                  {msg.read_at ? (
                    <span className="message-state message-state--read">Read</span>
                  ) : (
                    <span className="message-state message-state--delivered">Delivered</span>
                  )}
                  {msg.is_formal_letter ? <span className="letter-indicator">Formal Letter</span> : null}
                  {msg.file_path ? <span className="attachment-indicator">Attachment</span> : null}
                  {msg.due_date ? <span className="priority-label">Priority</span> : null}
                  <span className="message-date">{formatMessageListDate(msg.submitted_at || msg.created_at)}</span>
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {!loading && totalPages > 1 ? (
        <PaginationRow currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
      ) : null}
      {!loading && !messages.length ? (
        <div className="empty-state">No sent messages found.</div>
      ) : null}
    </div>
  );
}
