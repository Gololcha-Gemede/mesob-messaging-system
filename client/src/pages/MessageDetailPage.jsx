import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';
import RecipientPicker from '../components/RecipientPicker';
import LetterRenderer from '../components/LetterRenderer';
import { notify } from '../utils/notify';

function formatEventType(type) {
  return String(type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function MessageDetailPage() {
  const { id } = useParams();
  const [message, setMessage] = useState(null);
  const [history, setHistory] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [forwardTo, setForwardTo] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSubmittingDraft, setIsSubmittingDraft] = useState(false);
  const [isForwarding, setIsForwarding] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const token = sessionStorage.getItem('token');
  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);
  const visibleHistory = useMemo(() => {
    const forwardedChildren = new Set(
      history
        .filter((evt) => evt.event_type === 'forwarded' && evt.parent_message_id)
        .map((evt) => `${evt.parent_message_id}:${evt.actor_id || ''}:${evt.note || ''}`)
    );

    const filtered = history.filter((evt) => {
      if (evt.event_type !== 'forwarded' || evt.parent_message_id) return true;
      return !forwardedChildren.has(`${evt.message_id}:${evt.actor_id || ''}:${evt.note || ''}`);
    });

    // Show only the last 2 events (most recent by created_at, then id fallback).
    return [...filtered]
      .sort((a, b) => {
        const at = new Date(a.created_at || 0).getTime();
        const bt = new Date(b.created_at || 0).getTime();
        if (bt !== at) return bt - at;
        return (b.id || 0) - (a.id || 0);
      })
      .slice(0, 2);
  }, [history]);


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
      axios.get('/api/users/recipients', { headers: authHeaders })
    ]).then(([messageRes, historyRes, recipientsRes]) => {
      if (ignore) return;
      setMessage(messageRes.data);
      setHistory(Array.isArray(historyRes.data) ? historyRes.data : []);
      setRecipients(Array.isArray(recipientsRes.data) ? recipientsRes.data : []);
      setError('');
      axios.patch(`/api/messages/${id}/read`, {}, { headers: authHeaders }).catch(() => {});
    }).catch((err) => {
      if (ignore) return;
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Message not found');
    }).finally(() => {
      if (!ignore) setLoading(false);
    });
    return () => {
      ignore = true;
    };
  }, [authHeaders, id]);

  const handleSubmitDraft = async () => {
    try {
      setIsSubmittingDraft(true);
      await axios.post(`/api/messages/${id}/submit`, {}, { headers: authHeaders });
      setFeedback('Draft submitted.');
      setError('');
      await Promise.all([loadMessage(), loadHistory()]);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Could not submit draft.');
    } finally {
      setIsSubmittingDraft(false);
    }
  };

  const handleForward = async () => {
    try {
      if (forwardTo.length === 0) {
        setError('Please select at least one receiver.');
        return;
      }
      setIsForwarding(true);
      await axios.post(
        `/api/messages/${id}/forward`,
        { new_receiver_ids: forwardTo, new_receiver_id: forwardTo[0] || '' },
        { headers: authHeaders }
      );
      setFeedback('Message forwarded.');
      notify({ type: 'success', title: 'Message Sent confirmation', message: 'Message was forwarded successfully.' });
      setError('');
      setForwardTo([]);
      await Promise.all([loadMessage(), loadHistory()]);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Could not forward message.');
      notify({ type: 'error', title: 'System alert', message: apiMessage || 'Could not forward message.' });
    } finally {
      setIsForwarding(false);
    }
  };

  const handleAttachmentDownload = async () => {
    try {
      setIsDownloading(true);
      setError('');
      const res = await axios.get(`/api/messages/${message.id}/attachment`, {
        headers: authHeaders,
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = String(message.file_path || 'attachment').split(/[\\/]/).pop() || 'attachment';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not download attachment.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePdfDownload = async () => {
    try {
      setIsDownloadingPdf(true);
      setError('');
      const res = await axios.get(`/api/messages/${message.id}/pdf`, {
        headers: authHeaders,
        responseType: 'blob'
      });
      const url = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${message.reference_number || `message-${message.id}`}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      await loadMessage();
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not download PDF.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const handlePrintLetter = async () => {
    try {
      await axios.post(`/api/messages/${message.id}/print`, {}, { headers: authHeaders });
      await loadHistory();
    } catch {
      // Printing should still be available if tracking fails transiently.
    }
    window.print();
  };

  if (error && !message) return <div className="message-detail-container"><div className="error banner-message">{error}</div></div>;
  if (loading || !message) return <div className="message-detail-container"><div className="list-state">Loading message...</div></div>;

  return (
    <div className="message-detail-container">
      <h2>{message.subject}</h2>
      <div className="detail-grid">
        <div><strong>From:</strong> {message.sender_name || message.sender_id}</div>
        <div><strong>To:</strong> {message.receiver_name || message.receiver_id}</div>
        <div><strong>Reference:</strong> {message.reference_number}</div>
        <div><strong>Status:</strong> <span className={`status-pill status-${message.status}`}>{message.status}</span></div>
        {message.template_type && <div><strong>Template:</strong> {String(message.template_type).replace(/_/g, ' ')}</div>}
        {message.due_date && <div><strong>Due date:</strong> {String(message.due_date).slice(0, 10)}</div>}
      </div>
      <div className="document-action-row">
        <button type="button" className="attachment-link-button" onClick={handlePdfDownload} disabled={isDownloadingPdf}>
          {isDownloadingPdf ? 'Downloading PDF...' : 'Download PDF'}
        </button>
        <button type="button" className="secondary-btn print-letter-btn" onClick={handlePrintLetter}>
          Print Letter
        </button>
        {message.file_path && (
          <button type="button" className="secondary-btn" onClick={handleAttachmentDownload} disabled={isDownloading}>
            {isDownloading ? 'Downloading...' : 'Download Attachment'}
          </button>
        )}
      </div>
      <section className="message-document-wrap" aria-label="Formatted letter">
<LetterRenderer html={message.formatted_content} fallback={message.raw_content || message.content} />
      </section>

      {message.status === 'draft' && (
        <div className="detail-section">
          <button onClick={handleSubmitDraft} disabled={isSubmittingDraft}>
            {isSubmittingDraft ? 'Submitting...' : 'Submit Draft'}
          </button>
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
        <button className="forward-btn" onClick={handleForward} disabled={isForwarding}>
          {isForwarding ? 'Forwarding...' : 'Forward'}
        </button>
      </div>

      {feedback && <div className="success">{feedback}</div>}
      {error && <div className="error">{error}</div>}

      <div className="detail-section">
        <h3>History</h3>
        <ul className="history-list">
          {visibleHistory.map((evt) => (
            <li key={evt.id}>
              <strong>{formatEventType(evt.event_type)}</strong>
              {' '}by {evt.actor_name || `User ${evt.actor_id || '-'}`} at {new Date(evt.created_at).toLocaleString()}
              {evt.event_type === 'forwarded' && evt.parent_message_id ? ` to ${evt.receiver_name || `User ${evt.receiver_id || '-'}`}` : ''}
              {evt.reference_number ? ` - ${evt.reference_number}` : ''}
              {evt.note ? ` (${evt.note})` : ''}
            </li>
          ))}
          {!visibleHistory.length ? <li>No history recorded yet.</li> : null}
        </ul>
      </div>
    </div>
  );
}
