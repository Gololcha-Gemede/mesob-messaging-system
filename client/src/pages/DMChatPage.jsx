import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { Link, useParams } from 'react-router-dom';

function formatTime(dateString) {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatSeen(seenAt) {
  if (!seenAt) return '';
  return `Seen ${formatTime(seenAt)}`;
}

function initials(name, email) {
  const source = String(name || email || '?').trim();
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || '?';
}

export default function DMChatPage() {
  const { otherUserId } = useParams();
  const token = sessionStorage.getItem('token');
  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const [thread, setThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [otherUser, setOtherUser] = useState(null);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  const applyThread = useCallback((data) => {
    setThread(data?.thread || null);
    setMessages(Array.isArray(data?.messages) ? data.messages : []);
    setOtherUser(data?.other_user || null);
  }, []);

  const loadThread = useCallback(async ({ showLoading = false } = {}) => {
    if (!otherUserId) return;
    try {
      if (showLoading) setLoading(true);
      setError('');
      const res = await axios.get(`/api/dm/${otherUserId}/messages`, { headers });
      applyThread(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || 'Unable to load chat.');
      setMessages([]);
      setOtherUser(null);
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [applyThread, headers, otherUserId]);

  const markRead = useCallback(async () => {
    if (!otherUserId) return;
    try {
      await axios.patch(`/api/dm/${otherUserId}/seen`, {}, { headers });
    } catch {
      // Best effort only.
    }
  }, [headers, otherUserId]);

  useEffect(() => {
    let ignore = false;
    async function run() {
      if (ignore) return;
      await loadThread({ showLoading: true });
      if (!ignore) await markRead();
    }
    run();
    return () => {
      ignore = true;
    };
  }, [loadThread, markRead]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      loadThread();
      markRead();
    }, 3000);
    return () => window.clearInterval(interval);
  }, [loadThread, markRead]);

  useEffect(() => {
    let ignore = false;
    const interval = window.setInterval(async () => {
      try {
        const res = await axios.get(`/api/dm/${otherUserId}/typing`, { headers });
        if (!ignore) setTyping(Boolean(res.data?.is_typing));
      } catch {
        if (!ignore) setTyping(false);
      }
    }, 1500);

    return () => {
      ignore = true;
      window.clearInterval(interval);
    };
  }, [headers, otherUserId]);

  const visibleMessages = useMemo(
    () => messages.filter((message) => String(message.content || message.raw_content || '').trim()),
    [messages]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visibleMessages.length]);

  const notifyTyping = useCallback(() => {
    if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    typingTimerRef.current = window.setTimeout(async () => {
      try {
        await axios.post(`/api/dm/${otherUserId}/typing`, { is_typing: true }, { headers });
      } catch {
        // Best effort only.
      }
    }, 180);
  }, [headers, otherUserId]);

  useEffect(() => {
    return () => {
      if (typingTimerRef.current) window.clearTimeout(typingTimerRef.current);
    };
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    try {
      setSending(true);
      setError('');
      await axios.post(`/api/dm/${otherUserId}/send`, { content: text }, { headers });
      await axios.post(`/api/dm/${otherUserId}/typing`, { is_typing: false }, { headers });
      setInput('');
      await loadThread();
      await markRead();
    } catch (e) {
      setError(e?.response?.data?.message || 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const myId = String(thread?.my_user_id || '');
  const displayName = otherUser?.name || 'Chat';

  return (
    <div className="dm-chat-container">
      <div className="dm-chat-header">
        <div className="dm-chat-person">
          <Link to="/dm" className="dm-back-link" aria-label="Back to chats">Back</Link>
          <span className="dm-avatar dm-avatar--large">{initials(otherUser?.name, otherUser?.email)}</span>
          <div>
            <h2>{displayName}</h2>
            <small>{typing ? <span className="typing-indicator">typing...</span> : otherUser?.email}</small>
          </div>
        </div>
        <div className="dm-chat-status">
          {thread?.other_seen_at ? <small>{formatSeen(thread.other_seen_at)}</small> : null}
        </div>
      </div>

      {error ? <div className="error banner-message">{error}</div> : null}
      {loading ? <div className="list-state">Loading chat...</div> : null}

      {!loading ? (
        <div className="dm-messages" aria-live="polite">
          {visibleMessages.length ? (
            visibleMessages.map((m) => {
              const mine = myId ? String(m.sender_id) === myId : false;
              return (
                <div key={m.id} className={mine ? 'dm-message dm-message--mine' : 'dm-message'}>
                  <div className="dm-message-bubble">
                    <div className="dm-message-content">{m.content || m.raw_content || ''}</div>
                    <div className="dm-message-meta">
                      <small>
                        {formatTime(m.created_at || m.sent_at || m.submitted_at)}
                        {mine ? (m.read_at ? ' - Seen' : ' - Delivered') : ''}
                      </small>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="dm-chat-empty">No messages yet. Start the conversation below.</div>
          )}
          <div ref={messagesEndRef} />
        </div>
      ) : null}

      <form
        className="dm-chat-input-row"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          rows="1"
          placeholder="Message"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            notifyTyping();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button type="submit" className="primary-btn" disabled={!input.trim() || sending}>
          {sending ? 'Sending...' : 'Send'}
        </button>
      </form>
    </div>
  );
}
