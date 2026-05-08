import { useState, useEffect } from 'react';
import axios from 'axios';
import RecipientPicker from '../components/RecipientPicker';

export default function ComposeMessagePage() {
  const [users, setUsers] = useState([]);
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [file, setFile] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

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

    const formData = new FormData();
    formData.append('receiver_ids', JSON.stringify(receivers));
    formData.append('receiver_id', receivers[0] || '');
    formData.append('subject', subject);
    formData.append('content', content);
    formData.append('action', action);
    if (dueDate) formData.append('due_date', dueDate);
    if (file) formData.append('file', file);
    try {
      await axios.post('/api/messages', formData, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSuccess(action === 'draft' ? 'Draft saved.' : 'Message submitted.');
      setSubject('');
      setContent('');
      setReceivers([]);
      setDueDate('');
      setFile(null);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || (action === 'draft' ? 'Failed to save draft.' : 'Failed to send message.'));
    }
  };

  return (
    <div className="compose-container">
      <h2>Compose Message</h2>
      <form onSubmit={(e) => handleSubmit(e, 'submit')}>
        <RecipientPicker users={users} selectedIds={receivers} onChange={setReceivers} />
        <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required />
        <textarea placeholder="Content" value={content} onChange={e => setContent(e.target.value)} />
        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        <input type="file" onChange={e => setFile(e.target.files[0])} />
        <div className="button-row">
          <button type="submit">Submit</button>
          <button type="button" className="secondary-btn" onClick={(e) => handleSubmit(e, 'draft')}>Save Draft</button>
        </div>
        {success && <div className="success">{success}</div>}
        {error && <div className="error">{error}</div>}
      </form>
    </div>
  );
}
