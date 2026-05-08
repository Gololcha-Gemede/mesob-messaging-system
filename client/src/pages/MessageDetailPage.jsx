import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import RecipientPicker from '../components/RecipientPicker';

export default function MessageDetailPage() {
  const { id } = useParams();
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [forwardTo, setForwardTo] = useState([]);
  const [forwardNote, setForwardNote] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const token = localStorage.getItem('token');
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const currentRole = (() => {
    try {
      const payload = JSON.parse(atob((token || '').split('.')[1] || ''));
      return payload?.role || '';
    } catch {
      return '';
    }
  })();

  const loadMessage = useCallback(async () => {
    const res = await axios.get(`/api/messages/${id}`, { headers: authHeaders });
    setMessage(res.data);
  }, [authHeaders, id]);

  const loadHistory = useCallback(async () => {
    const res = await axios.get(`/api/messages/${id}/history`, { headers: authHeaders });
    setHistory(Array.isArray(res.data) ? res.data : []);
  }, [authHeaders, id]);

  useEffect(() => {
    let ignore = false;
    Promise.all([
      axios.get(`/api/messages/${id}`, { headers: authHeaders }),
      axios.get(`/api/messages/${id}/history`, { headers: authHeaders }),
      axios.get('/api/users/recipients', { headers: authHeaders }),
      axios.patch(`/api/messages/${id}/read`, {}, { headers: authHeaders })
    ]).then(([messageRes, historyRes, recipientsRes]) => {
      if (ignore) return;
      setMessage(messageRes.data);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setRecipients(Array.isArray(recipientsRes.data) ? recipientsRes.data : []);
    }).catch((err) => {
      if (ignore) return;
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Message not found');
    });
    return () => {
      ignore = true;
    };
  }, [authHeaders, id]);

  const handleSubmitDraft = async () => {
    try {
      await axios.post(`/api/messages/${id}/submit`, {}, { headers: authHeaders });
      setFeedback('Draft submitted.');
      setError('');
      await Promise.all([loadMessage(), loadHistory()]);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Could not submit draft.');
    }
  };

  const handleForward = async () => {
    try {
      if (forwardTo.length === 0) {
        setError('Please select at least one receiver.');
        return;
      }
      await axios.post(
        `/api/messages/${id}/forward`,
        { new_receiver_ids: forwardTo, new_receiver_id: forwardTo[0] || '', note: forwardNote },
        { headers: authHeaders }
      );
      setFeedback('Message forwarded.');
      setError('');
      setForwardTo([]);
      setForwardNote('');
      await Promise.all([loadMessage(), loadHistory()]);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Could not forward message.');
    }
  };

  if (error && !message) return <div>{error}</div>;
  if (!message) return <div>Loading...</div>;

  return (
    <div className="message-detail-container">
      <h2>{message.subject}</h2>
      <div className="detail-grid">
        <div><strong>From:</strong> {message.sender_name || message.sender_id}</div>
        <div><strong>To:</strong> {message.receiver_name || message.receiver_id}</div>
        <div><strong>Reference:</strong> {message.reference_number}</div>
        <div><strong>Status:</strong> <span className={`status-pill status-${message.status}`}>{message.status}</span></div>
        {message.due_date && <div><strong>Due date:</strong> {String(message.due_date).slice(0, 10)}</div>}
      </div>
      <p className="message-content">{message.content}</p>
      {message.file_path && (
        <a className="attachment-link" href={`/api/messages/${message.id}/attachment`} target="_blank" rel="noopener noreferrer">
          Download Attachment
        </a>
      )}

      {message.status === 'draft' && (
        <div className="detail-section">
          <button onClick={handleSubmitDraft}>Submit Draft</button>
        </div>
      )}

      <div className="detail-section">
        <h3>Forward</h3>
        <RecipientPicker
          users={recipients}
          selectedIds={forwardTo}
          onChange={setForwardTo}
          placeholder="Search recipients by username"
        />
        <input
          type="text"
          placeholder="Forward note"
          value={forwardNote}
          onChange={(e) => setForwardNote(e.target.value)}
        />
        <button className="forward-btn" onClick={handleForward}>Forward</button>
      </div>

      {feedback && <div className="success">{feedback}</div>}
      {error && <div className="error">{error}</div>}

      <div className="detail-section">
        <h3>History</h3>
        <ul className="history-list">
          {history.map((evt) => (
            <li key={evt.id}>
              {evt.event_type} by {evt.actor_name || `User ${evt.actor_id || '-'}`} at {new Date(evt.created_at).toLocaleString()}
              {evt.note ? ` (${evt.note})` : ''}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
