import { useRef, useState, useEffect } from 'react';
import axios from 'axios';
import RecipientPicker from '../components/RecipientPicker';
import FormalLetterTemplate from '../components/FormalLetterTemplate';
import { notify } from '../utils/notify';

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
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [receivers, setReceivers] = useState([]);
  const [file, setFile] = useState(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isFormalLetter, setIsFormalLetter] = useState(false);
  const [letterFields, setLetterFields] = useState(emptyLetterFields);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState('submit');
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const letterPreviewRef = useRef(null);
  const letterSourceRef = useRef(null);

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

  const updateLetterField = (field, value) => {
    setLetterFields((fields) => ({ ...fields, [field]: value }));
  };

  const buildLetterHtml = () => (
    isFormalLetter && letterSourceRef.current ? letterSourceRef.current.outerHTML : ''
  );

  const downloadLetterPdf = async () => {
    if (!letterPreviewRef.current) return;
    setDownloadingPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      await html2pdf()
        .set({
          margin: 0.35,
          filename: `${(subject || 'formal-letter').replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '') || 'formal-letter'}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
        })
        .from(letterPreviewRef.current)
        .save();
    } catch {
      setError('Unable to download the formal letter PDF.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const resetForm = () => {
    setSubject('');
    setContent('');
    setReceivers([]);
    setFile(null);
    setFileInputKey((key) => key + 1);
    setIsFormalLetter(false);
    setLetterFields(emptyLetterFields);
    setPreviewOpen(false);
    setPendingAction('submit');
  };

  const sendMessage = async (action = 'submit', letterHtml = '') => {
    setSubmitting(true);
    const formData = new FormData();
    formData.append('receiver_ids', JSON.stringify(receivers));
    formData.append('receiver_id', receivers[0] || '');
    formData.append('subject', subject);
    formData.append('content', content);
    formData.append('action', action);
    formData.append('is_formal_letter', isFormalLetter ? '1' : '0');
    if (isFormalLetter) {
      formData.append('letter_html', letterHtml || buildLetterHtml());
      formData.append('pdf_path', '');
    }
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
      resetForm();
      setPreviewOpen(false);
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
    <div className="compose-container">
      <h2>Compose Message</h2>
      <form onSubmit={(e) => handleSubmit(e, 'submit')}>
        {loadingRecipients ? <div className="list-state">Loading recipients...</div> : null}
        <RecipientPicker users={users} selectedIds={receivers} onChange={setReceivers} />
        <input type="text" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} required />
        <textarea placeholder="Content" value={content} onChange={e => setContent(e.target.value)} />
        <label className="formal-toggle">
          <input
            type="checkbox"
            checked={isFormalLetter}
            onChange={(e) => setIsFormalLetter(e.target.checked)}
          />
          <span>Convert to Formal Letter</span>
        </label>
        {isFormalLetter ? (
          <div className="formal-fields">
            <input type="text" placeholder="Sender name/title" value={letterFields.senderNameTitle} onChange={(e) => updateLetterField('senderNameTitle', e.target.value)} />
            <input type="text" placeholder="Receiver name/title" value={letterFields.receiverNameTitle} onChange={(e) => updateLetterField('receiverNameTitle', e.target.value)} />
            <input type="text" placeholder="Salutation" value={letterFields.salutation} onChange={(e) => updateLetterField('salutation', e.target.value)} />
            <input type="text" placeholder="Closing text" value={letterFields.closingText} onChange={(e) => updateLetterField('closingText', e.target.value)} />
            <textarea className="formal-signature-input" placeholder="Signature section" value={letterFields.signatureSection} onChange={(e) => updateLetterField('signatureSection', e.target.value)} />
            <input type="date" value={letterFields.date} onChange={(e) => updateLetterField('date', e.target.value)} />
            <button type="button" className="secondary-btn" onClick={() => setPreviewOpen(true)}>
              Preview Formal Letter
            </button>
          </div>
        ) : null}
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
          <button type="button" className="secondary-btn" onClick={resetForm} disabled={submitting}>
            Cancel
          </button>
        </div>
        {success && <div className="success">{success}</div>}
        {error && <div className="error">{error}</div>}
      </form>
      {isFormalLetter ? (
        <div className="letter-html-source" aria-hidden="true">
          <FormalLetterTemplate
            ref={letterSourceRef}
            subject={subject}
            body={content}
            referenceNumber="__SYSTEM_REFERENCE_NUMBER__"
            senderNameTitle={letterFields.senderNameTitle}
            receiverNameTitle={letterFields.receiverNameTitle}
            salutation={letterFields.salutation}
            closingText={letterFields.closingText}
            signatureSection={letterFields.signatureSection}
            date={letterFields.date}
          />
        </div>
      ) : null}
      {previewOpen ? (
        <div className="modal-backdrop">
          <div className="letter-preview-modal">
            <div className="panel-title-row">
              <h3>Formal Letter Preview</h3>
              <button type="button" className="secondary-btn letter-preview-close" onClick={() => setPreviewOpen(false)}>Edit</button>
            </div>
            <div className="letter-preview-scroll">
              <FormalLetterTemplate
                ref={letterPreviewRef}
                subject={subject}
                body={content}
                referenceNumber=""
                senderNameTitle={letterFields.senderNameTitle}
                receiverNameTitle={letterFields.receiverNameTitle}
                salutation={letterFields.salutation}
                closingText={letterFields.closingText}
                signatureSection={letterFields.signatureSection}
                date={letterFields.date}
              />
            </div>
            <div className="letter-preview-actions">
              <button type="button" className="secondary-btn" onClick={() => setPreviewOpen(false)}>Edit</button>
              <button type="button" className="secondary-btn" onClick={resetForm} disabled={submitting}>Cancel</button>
              <button type="button" className="secondary-btn" onClick={downloadLetterPdf} disabled={downloadingPdf}>
                {downloadingPdf ? 'Preparing PDF...' : 'Download PDF'}
              </button>
              <button type="button" onClick={() => sendMessage(pendingAction, buildLetterHtml())} disabled={submitting}>
                {submitting ? 'Sending...' : 'Confirm & Send'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
