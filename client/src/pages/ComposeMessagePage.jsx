import { useState, useEffect } from 'react';
import axios from 'axios';
import RecipientPicker from '../components/RecipientPicker';
import { notify } from '../utils/notify';

export default function ComposeMessagePage() {
  const [users, setUsers] = useState([]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [file, setFile] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    axios.get('/api/users/recipients', {
      headers
    })
      .then((res) => {
        setUsers(Array.isArray(res.data) ? res.data : []);
        setError('');
      })
      .catch(() => {
        setUsers([]);
        setError('Unable to load receivers.');
      })
      .finally(() => {
        setLoadingRecipients(false);
      });
  }, []);

  const handleSubmit = async (e, action = 'submit') => {
    e.preventDefault();
    setSuccess('');
    setError('');

    if (action === 'submit' && receivers.length === 0) {
      setError('Please select at least one receiver.');
      return;
    }

    if (action === 'submit' && !subject.trim()) {
      setError('Please enter a subject before sending.');
      return;
    }

    setSubmitting(true);
    const formData = new FormData();
    formData.append('receiver_ids', JSON.stringify(receivers));
    formData.append('receiver_id', receivers[0] || '');
    formData.append('subject', subject);
    formData.append('content', content);
    formData.append('action', action);
    if (file) formData.append('file', file);
    try {
      await axios.post('/api/messages', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSuccess(action === 'draft' ? 'Draft saved.' : 'Message submitted.');
      notify({
        type: 'success',
        title: action === 'draft' ? 'Draft Saved notification' : 'Message Sent confirmation',
        message: action === 'draft' ? 'Your message draft was saved.' : 'Your message was sent successfully.'
      });
      setSubject('');
      setContent('');
      setReceivers([]);
      setFile(null);
      setFileInputKey((key) => key + 1);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || (action === 'draft' ? 'Failed to save draft.' : 'Failed to send message.'));
      notify({ type: 'error', title: 'System alert', message: apiMessage || 'The message action could not be completed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="compose-container">
      <h2>Compose Message</h2>
      <form onSubmit={(e) => handleSubmit(e, 'submit')}>
        {loadingRecipients ? <div className="list-state">Loading recipients...</div> : null}
        <RecipientPicker users={users} selectedIds={receivers} onChange={setReceivers} />
        <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required />
        <textarea placeholder="Content" value={content} onChange={e => setContent(e.target.value)} />
        <input key={fileInputKey} type="file" onChange={e => setFile(e.target.files[0] || null)} />
        {file ? (
          <div className="attachment-preview">
            <span>{file.name}</span>
            <button
              type="button"
              className="attachment-remove"
              onClick={() => {
                setFile(null);
                setFileInputKey((key) => key + 1);
              }}
              aria-label="Remove attachment"
            >
              x
            </button>
          </div>
        ) : null}
        <div className="button-row">
          <button type="submit" disabled={submitting || loadingRecipients}>
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
          <button type="button" className="secondary-btn" onClick={(e) => handleSubmit(e, 'draft')} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Draft'}
          </button>
        </div>
        {success && <div className="success">{success}</div>}
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
