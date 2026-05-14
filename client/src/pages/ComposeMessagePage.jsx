import { useMemo, useState, useEffect } from 'react';
import axios from 'axios';
import RecipientPicker from '../components/RecipientPicker';
import LetterRenderer from '../components/LetterRenderer';
import { notify } from '../utils/notify';
import { LETTER_TEMPLATES, buildClientLetterPreview } from '../utils/letterPreview';

const emptyLetterFields = {
  senderNameTitle: '',
  receiverNameTitle: '',
  salutation: '',
  closingText: '',
  signatureSection: '',
  date: new Date().toISOString().slice(0, 10)
};

export default function ComposeMessagePage() {
  const [users, setUsers] = useState([]);
  const [templateType, setTemplateType] = useState('official_letter');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [sendName, setSendName] = useState('');
  const [receivers, setReceivers] = useState([]);

  const [file, setFile] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [serverPreviewHtml, setServerPreviewHtml] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isFormalLetter, setIsFormalLetter] = useState(false);
  const [letterFields, setLetterFields] = useState(emptyLetterFields);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('submit');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const letterPreviewRef = useRef(null);
  const letterSourceRef = useRef(null);

  useEffect(() => {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    axios.get('/api/users/recipients', { headers })
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

  const firstRecipientName = useMemo(() => {
    const selected = users.find((user) => Number(user.id) === Number(receivers[0]));
    if (receivers.length > 1) return `${selected?.name || 'Recipient'} + ${receivers.length - 1}`;
    return selected?.name || 'Recipient';
  }, [receivers, users]);

  const livePreviewHtml = useMemo(() => buildClientLetterPreview({
    templateType,
    recipientName: firstRecipientName,
    subject,
    content,
    file
  }), [content, file, firstRecipientName, subject, templateType]);

  const resetForm = () => {
    setSubject('');
    setContent('');
    setReceivers([]);
    setFile(null);
    setServerPreviewHtml('');
    setPreviewOpen(false);
    setFileInputKey((key) => key + 1);
  };

  const validateForSubmit = () => {
    if (receivers.length === 0) {
      setError('Please select at least one receiver.');
      return false;
    }
    if (!subject.trim()) {
      setError('Please enter a subject before sending.');
      return false;
    }
    return true;
  };

  const requestPreview = async () => {
    setSuccess('');
    setError('');
    if (!validateForSubmit()) return;

    setPreviewing(true);
    try {
      const res = await axios.post('/api/messages/preview', {
        receiver_ids: receivers,
        receiver_id: receivers[0] || '',
        subject,
        content,
        template_type: templateType,
        sender_name: sendName,
        attachment_name: file?.name || '',
        attachment_mime: file?.type || '',
        attachment_size: file?.size || 0
      }, {
        headers: { Authorization: `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token')}` }
      });
      setServerPreviewHtml(res.data?.formatted_content || livePreviewHtml);
      setPreviewOpen(true);
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || 'Unable to generate letter preview.');
      notify({ type: 'error', title: 'System alert', message: apiMessage || 'Preview could not be generated.' });
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async (action = 'submit') => {
    setSuccess('');
    setError('');

    if (action === 'submit' && !validateForSubmit()) return;

  const sendMessage = async (action = 'submit', letterHtml = '') => {
    setSubmitting(true);
    const formData = new FormData();
    formData.append('receiver_ids', JSON.stringify(receivers));
    formData.append('receiver_id', receivers[0] || '');
    formData.append('subject', subject);
    formData.append('content', content);
    formData.append('template_type', templateType);
    formData.append('sender_name', sendName);
    formData.append('action', action);


    try {
      const token = sessionStorage.getItem('token') || localStorage.getItem('token');
      if (token) {
        const b64 = token.split('.')[1];
        const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(json);
        if (payload?.department_id) formData.append('department_id', payload.department_id);
      }
    } catch {}


    if (file) formData.append('file', file);
    try {
      await axios.post('/api/messages', formData, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('token') || localStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSuccess(action === 'draft' ? 'Draft saved.' : 'Official letter sent.');
      notify({
        type: 'success',
        title: action === 'draft' ? 'Draft Saved notification' : 'Message Sent confirmation',
        message: action === 'draft' ? 'Your message draft was saved.' : 'Your formatted letter was sent successfully.'
      });
      resetForm();
    } catch (err) {
      const apiMessage = err?.response?.data?.message;
      setError(apiMessage || (action === 'draft' ? 'Failed to save draft.' : 'Failed to send message.'));
      notify({ type: 'error', title: 'System alert', message: apiMessage || 'The message action could not be completed.' });
    } finally {
      setSubmitting(false);
    }
  };

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

    if (isFormalLetter && action === 'submit') {
      setPendingAction(action);
      setPreviewOpen(true);
      return;
    }

    await sendMessage(action);
  };

  return (
    <div className="compose-container compose-container--document">
      <div className="page-title-row">
        <div>
          <h2>Compose Message</h2>
          <p className="admin-panel-hint">Official internal correspondence</p>
        </div>
        <span className="autosave-indicator">Document mode</span>
      </div>

      <div className="compose-document-layout">
        <form className="compose-document-form" onSubmit={(e) => {
          e.preventDefault();
          requestPreview();
        }}>
          {loadingRecipients ? <div className="list-state">Loading recipients...</div> : null}

          <label className="compose-field">
            <span>Template</span>
            <select value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
              {LETTER_TEMPLATES.map((template) => (
                <option key={template.value} value={template.value}>{template.label}</option>
              ))}
            </select>
          </label>

          <label className="compose-field">
            <span>Recipients</span>
            <RecipientPicker users={users} selectedIds={receivers} onChange={setReceivers} />
          </label>

          <label className="compose-field">
            <span>Subject</span>
            <input type="text" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </label>

          <label className="compose-field">
            <span>Send as name (optional)</span>
            <input
              type="text"
              placeholder="Type the sender display name"
              value={sendName}
              onChange={(e) => setSendName(e.target.value)}
            />
          </label>

          <label className="compose-field">
            <span>Normal text (optional)</span>
            <textarea placeholder="Write normal text here (will be sent as message content)" value={content} onChange={(e) => setContent(e.target.value)} />
          </label>

          <div className="compose-hint">Tip: Choose a template above to format your message. If you select template “Official Letter”, your normal text will be inserted into the letter body.</div>





          <label className="compose-file-drop">
            <span>Attachment</span>
            <input key={fileInputKey} type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
          </label>

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

          <div className="button-row compose-action-row">
            <button type="submit" disabled={submitting || previewing || loadingRecipients}>
              {previewing ? 'Preparing Preview...' : 'Preview Letter'}
            </button>
            <button type="button" className="secondary-btn" onClick={() => handleSubmit('draft')} disabled={submitting || previewing}>
              {submitting ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
          {success && <div className="success">{success}</div>}
          {error && <div className="error">{error}</div>}
        </form>

        <aside className="compose-preview-pane" aria-label="Live letter preview">
          <div className="panel-title-row">
            <h3>Live Preview</h3>
            <span className="status-pill status-delivered">{LETTER_TEMPLATES.find((item) => item.value === templateType)?.label}</span>
          </div>
          <LetterRenderer html={livePreviewHtml} />
        </aside>
      </div>

      {previewOpen ? (
        <div className="modal-backdrop letter-preview-backdrop">
          <div className="letter-preview-modal" role="dialog" aria-modal="true" aria-labelledby="letter-preview-title">
            <div className="panel-title-row">
              <h3 id="letter-preview-title">Preview Letter</h3>
              <button type="button" className="secondary-btn letter-modal-close" onClick={() => setPreviewOpen(false)}>Edit</button>
            </div>
            <div className="letter-preview-scroll">
              <LetterRenderer html={serverPreviewHtml || livePreviewHtml} />
            </div>
            <div className="confirm-modal-actions letter-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setPreviewOpen(false)}>Return to Compose</button>
              <button type="button" onClick={() => handleSubmit('submit')} disabled={submitting}>
                {submitting ? 'Sending...' : 'Confirm Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
