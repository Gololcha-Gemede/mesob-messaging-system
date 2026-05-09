import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import { notify } from '../utils/notify';

function formatDate(value) {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

export default function DraftsPage() {
  const [messages, setMessages] = useState([]);
  const [filterValue, setFilterValue] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const loadDrafts = useCallback(() => {
    let ignore = false;
    const t = setTimeout(() => {
      const params = new URLSearchParams();
      if (filterValue.trim()) params.set('subject', filterValue.trim());
      const qs = params.toString();
      setLoading(true);
      setError('');
      axios
        .get(`/api/messages/drafts${qs ? `?${qs}` : ''}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
        .then((res) => {
          if (ignore) return;
          setMessages(Array.isArray(res.data) ? res.data : []);
          setSelectedIds([]);
        })
        .catch((err) => {
          if (ignore) return;
          setMessages([]);
          setError(err?.response?.data?.message || 'Unable to load drafts.');
        })
        .finally(() => {
          if (!ignore) setLoading(false);
        });
    }, 300);
    return () => {
      ignore = true;
      clearTimeout(t);
    };
  }, [filterValue]);

  useEffect(() => {
    return loadDrafts();
  }, [loadDrafts]);

  const toggleSelected = (id) => {
    setSelectedIds((ids) => ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]);
  };

  const deleteDrafts = async (ids) => {
    if (!ids.length) return;
    setDeleting(true);
    setError('');
    try {
      await axios.delete('/api/messages/drafts', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        data: { ids }
      });
      setMessages((items) => items.filter((msg) => !ids.includes(msg.id)));
      setSelectedIds((items) => items.filter((id) => !ids.includes(id)));
      notify({
        type: 'success',
        title: ids.length > 1 ? 'Drafts deleted' : 'Draft deleted',
        message: `${ids.length} draft${ids.length > 1 ? 's were' : ' was'} removed.`
      });
    } catch (err) {
      setError(err?.response?.data?.message || 'Unable to delete draft messages.');
      notify({ type: 'error', title: 'Message Deleted notification', message: 'Draft deletion could not be completed.' });
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="drafts-container">
      <div className="page-title-row">
        <div>
          <h2>Drafts</h2>
          <p className="admin-panel-hint">Resume, review, or remove saved message drafts.</p>
        </div>
        <span className="autosave-indicator">Autosave ready</span>
      </div>
      <div className="message-filters" role="search" aria-label="Filter drafts">
        <input
          className="message-filter-input"
          type="search"
          placeholder="Filter by subject"
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          autoComplete="off"
        />
        <button
          type="button"
          className="danger-btn danger-btn--soft bulk-delete-btn"
          disabled={!selectedIds.length || deleting}
          onClick={() => deleteDrafts(selectedIds)}
        >
          {deleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
        </button>
      </div>
      {error ? <div className="error banner-message">{error}</div> : null}
      {loading ? <div className="list-state">Loading drafts...</div> : null}
      <ul className="message-list">
        {!loading && messages.map((msg) => (
          <li key={msg.id} className="message-item draft-message-item">
            <label className="draft-select">
              <input
                type="checkbox"
                checked={selectedIds.includes(msg.id)}
                onChange={() => toggleSelected(msg.id)}
                aria-label={`Select draft ${msg.subject || msg.id}`}
              />
            </label>
            <Link to={`/messages/${msg.id}`} className="draft-message-link">
              <div>
                <div className="message-item-title">{msg.subject || '(No subject)'}</div>
                <div className="message-item-meta">
                  <span className={`status-pill status-${msg.status}`}>{msg.status}</span>
                  <span>Last Edited {formatDate(msg.created_at || msg.submitted_at)}</span>
                  {msg.file_path ? <span className="attachment-indicator">Attachment</span> : null}
                </div>
              </div>
            </Link>
            <button
              type="button"
              className="admin-row-btn danger-btn danger-btn--soft draft-delete-btn"
              disabled={deleting}
              onClick={() => deleteDrafts([msg.id])}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
      {!loading && !messages.length ? (
        <div className="empty-state">No drafts found.</div>
      ) : null}
    </div>
  );
}
