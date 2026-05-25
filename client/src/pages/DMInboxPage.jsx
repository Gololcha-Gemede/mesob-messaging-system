import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';

function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date();
  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function initials(name, email) {
  const source = String(name || email || '?').trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

export default function DMInboxPage() {
  const token = sessionStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [threads, setThreads] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        setLoading(true);
        setError('');
        const [threadsRes, usersRes] = await Promise.all([
          axios.get('/api/dm/threads', { headers }),
          axios.get('/api/users/recipients', { headers })
        ]);
        if (ignore) return;
        setThreads(Array.isArray(threadsRes.data) ? threadsRes.data : []);
        setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      } catch (e) {
        if (ignore) return;
        setError(e?.response?.data?.message || 'Unable to load direct messages.');
        setThreads([]);
        setUsers([]);
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, [headers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const name = String(u.name || '').toLowerCase();
      const email = String(u.email || '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [search, users]);

  return (
    <div className="dm-inbox-container">
      <div className="page-title-row">
        <div>
          <h2>Chat</h2>
          <p className="admin-panel-hint">Direct conversations with people in your organization.</p>
        </div>
      </div>

      {error ? <div className="error banner-message">{error}</div> : null}

      <div className="dm-inbox-shell">
        <section className="dm-inbox-threads">
          <div className="dm-panel-heading">
            <div>
              <h3>Conversations</h3>
              <span>{threads.length} total</span>
            </div>
          </div>

          {loading ? <div className="list-state">Loading conversations...</div> : null}

          {!loading && threads.length ? (
            <ul className="dm-thread-list">
              {threads.map((t) => (
                <li key={t.thread_key} className="dm-thread-item">
                  <Link to={`/dm/${t.other_user_id}`}>
                    <span className="dm-avatar">{initials(t.other_user_name, t.other_user_id)}</span>
                    <span className="dm-thread-body">
                      <span className="dm-thread-top">
                        <strong>{t.other_user_name || `User ${t.other_user_id}`}</strong>
                        <small>{formatDate(t.last_message_at)}</small>
                      </span>
                      <span className="dm-thread-preview">
                        {t.last_message_text ? t.last_message_text : <em>No messages yet.</em>}
                      </span>
                      <span className="dm-thread-meta">
                        {t.unread_count ? <span className="dm-unread-pill">{t.unread_count}</span> : null}
                        {t.last_delivered_at ? <span>Delivered</span> : null}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && !threads.length ? <div className="empty-state">No conversations yet.</div> : null}
        </section>

        <section className="dm-inbox-compose">
          <div className="dm-panel-heading">
            <div>
              <h3>New chat</h3>
              <span>Find a user and start messaging.</span>
            </div>
          </div>
          <input
            type="search"
            placeholder="Search users by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="dm-user-picker">
            {filteredUsers.length ? (
              filteredUsers.slice(0, 12).map((u) => (
                <button
                  type="button"
                  key={u.id}
                  className={selectedUserId === String(u.id) ? 'dm-user-btn dm-user-btn--active' : 'dm-user-btn'}
                  onClick={() => setSelectedUserId(String(u.id))}
                >
                  <span className="dm-avatar">{initials(u.name, u.email)}</span>
                  <span>
                    <span className="dm-user-name">{u.name}</span>
                    <small>{u.email}</small>
                  </span>
                </button>
              ))
            ) : (
              <div className="empty-state">No users found.</div>
            )}
          </div>

          {selectedUserId ? (
            <Link className="dm-open-chat-btn" to={`/dm/${selectedUserId}`}>
              Open chat
            </Link>
          ) : (
            <div className="admin-panel-hint">Pick a user to open a chat.</div>
          )}
        </section>
      </div>
    </div>
  );
}
