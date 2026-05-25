import { useMemo, useState, useEffect, useRef } from 'react';
import axios from 'axios';
import RecipientPicker from '../components/RecipientPicker';
import LetterRenderer from '../components/LetterRenderer';
import { notify } from '../utils/notify';
import { LETTER_TEMPLATES, buildClientLetterPreview } from '../utils/letterPreview';
import { roleFromToken } from '../utils/jwt';

const EMPTY_DRAFT = {
  templateType: 'official_letter',
  subject: '',
  content: '',
  sendName: '',
  receivers: [],
  raw: null,
};

const loadSavedDraft = () => {
  try {
    const raw = localStorage.getItem('compose_draft');
    if (!raw) return EMPTY_DRAFT;
    const draft = JSON.parse(raw);
    return {
      templateType: draft.templateType || EMPTY_DRAFT.templateType,
      subject: draft.subject || '',
      content: draft.content || '',
      sendName: draft.sendName || '',
      receivers: Array.isArray(draft.receivers) ? draft.receivers : [],
      raw,
    };
  } catch (err) {
    console.error('Failed to restore draft:', err);
    return EMPTY_DRAFT;
  }
};

const normalizeEditorHtml = (html) => {
  const raw = String(html ?? '');

  // Normalize editor empty markers into ''
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed === '<br>' || trimmed === '<div><br></div>') return '';

  // Remove trivial empty block nodes
  const looksOnlyEmptyNodes = raw
    .replace(/<(br|div|p)[^>]*>/gi, '')
    .replace(/<\/?(br|div|p)[^>]*>/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, '')
    .length === 0;
  if (looksOnlyEmptyNodes) return '';

  // 1) Strip editor wrapper spans that commonly appear with default styles.
  //    We keep spans if they carry meaningful styling.
  let cleaned = raw
    .replace(/<span\s+[^>]*font-weight:\s*normal;?[^>]*>/gi, '<span>')
    .replace(/<\/span>/gi, '</span>');

  // If a span is empty wrapper for “normal”, drop it but keep its children.
  cleaned = cleaned
    .replace(/<span>\s*([\s\S]*?)\s*<\/span>/gi, '<span>$1</span>')
    // remove spans that only exist for normal weight. (best-effort)
    .replace(/<span\s*style\s*=\s*"[^"]*font-weight\s*:\s*normal;?[^"]*"\s*>([\s\S]*?)<\/span>/gi, '$1')
    .replace(/<span\s*style\s*=\s*'[^']*font-weight\s*:\s*normal;?[^']*'\s*>([\s\S]*?)<\/span>/gi, '$1');

  // 2) remove common empty div wrapper
  cleaned = cleaned
    .replace(/<div><br><\/div>/gi, '')
    // normalize <br> variants to single <br>
    .replace(/<br\s*\/?>(\s*)/gi, '<br>')
    // normalize nbsp
    .replace(/\u00a0/g, ' ')
    .trim();

  return cleaned;
};

const formatAutosaveLabel = (status, savedAt) => {
  if (status === 'saving') return 'Saving...';
  if (!savedAt) return 'Draft not saved yet';

  const seconds = Math.max(0, Math.round((Date.now() - savedAt.getTime()) / 1000));
  if (status === 'saved' || seconds < 5) return 'Saved just now';
  if (seconds < 60) return `Auto-saved ${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  return `Auto-saved ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
};

const stripHtmlForSuggestion = (html) =>
  String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export default function ComposeMessagePage() {
  const token = sessionStorage.getItem('token');
  const isAdmin = roleFromToken(token) === 'admin';
  const [initialDraft] = useState(loadSavedDraft);
  const [users, setUsers] = useState([]);
  const [templateType, setTemplateType] = useState(initialDraft.templateType);
  const [subject, setSubject] = useState(initialDraft.subject);
  const [content, setContent] = useState(initialDraft.content);
  const [sendName, setSendName] = useState(initialDraft.sendName);
  const [receivers, setReceivers] = useState(initialDraft.receivers);

  const [files, setFiles] = useState([]);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loadingRecipients, setLoadingRecipients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [serverPreviewHtml, setServerPreviewHtml] = useState('');
  const [fileInputKey, setFileInputKey] = useState(0);

  // Autosave state
  const [autosaveStatus, setAutosaveStatus] = useState('idle'); // idle, saving, saved
  const [autosavedAt, setAutosavedAt] = useState(() => {
    const timestamp = localStorage.getItem('compose_draft_timestamp');
    if (!timestamp) return null;
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? null : date;
  });
  const [, setAutosaveTick] = useState(0);

  const editorIsEmpty = useMemo(() => normalizeEditorHtml(content).length === 0, [content]);

  const autosaveTimer = useRef(null);
  const [lastSavedDraft, setLastSavedDraft] = useState(initialDraft.raw);
  const [editorSeed, setEditorSeed] = useState(initialDraft.content);
  const contentEditableRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!contentEditableRef.current) return;
    contentEditableRef.current.innerHTML = editorSeed || '';
  }, [editorSeed]);

  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };

    axios
      .get('/api/users/recipients', { headers })
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
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let ignore = false;

    axios
      .get('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (ignore) return;
        const profileName = String(res.data?.name || res.data?.email || '').trim();
        if (!profileName) return;
        setSendName((current) => {
          if (isAdmin && current.trim()) return current;
          return profileName;
        });
      })
      .catch(() => {
        setSendName((current) => current || sessionStorage.getItem('email') || 'Current user');
      });

    return () => {
      ignore = true;
    };
  }, [isAdmin, token]);

  useEffect(() => {
    if (!autosavedAt) return undefined;
    const interval = window.setInterval(() => setAutosaveTick((tick) => tick + 1), 10000);
    return () => window.clearInterval(interval);
  }, [autosavedAt]);

  // Autosave functionality
  useEffect(() => {
    if (!sendName.trim()) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);

    autosaveTimer.current = setTimeout(async () => {
      const composeDraft = JSON.stringify({
        templateType,
        subject,
        content,
        sendName,
        receivers,
      });

      if (composeDraft === lastSavedDraft) {
        setAutosaveStatus('idle');
        return;
      }

      setAutosaveStatus('saving');
      try {
        // For now, autosave is stored in localStorage
        const savedAt = new Date();
        localStorage.setItem('compose_draft', composeDraft);
        localStorage.setItem('compose_draft_timestamp', savedAt.toISOString());
        setLastSavedDraft(composeDraft);
        setAutosavedAt(savedAt);
        setAutosaveTick((tick) => tick + 1);
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus('idle'), 2000);
      } catch (err) {
        console.error('Autosave failed:', err);
        setAutosaveStatus('idle');
      }
    }, 2000); // Autosave after 2 seconds of inactivity

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [templateType, subject, content, sendName, receivers, lastSavedDraft]);

  const firstRecipientName = useMemo(() => {
    const selected = users.find((user) => Number(user.id) === Number(receivers[0]));
    if (receivers.length > 1) return `${selected?.name || 'Recipient'} + ${receivers.length - 1}`;
    return selected?.name || 'Recipient';
  }, [receivers, users]);

  // Use first file for preview (multiple files not shown in preview)
  const firstFile = useMemo(
    () => (files.length > 0 ? { name: files[0].name, size: files[0].size } : null),
    [files]
  );

  const livePreviewHtml = useMemo(
    () =>
      buildClientLetterPreview({
        templateType,
        recipientName: firstRecipientName,
        subject,
        content,
        file: firstFile,
        senderName: sendName,
      }),
    [content, firstFile, firstRecipientName, sendName, subject, templateType]
  );

  const autosaveLabel = formatAutosaveLabel(autosaveStatus, autosavedAt);

  const subjectSuggestions = useMemo(() => {
    const selectedLetterTemplate = LETTER_TEMPLATES.find((template) => template.value === templateType);
    const firstLine = stripHtmlForSuggestion(content).slice(0, 72);
    return [
      selectedLetterTemplate?.label ? `${selectedLetterTemplate.label} Request` : '',
      firstLine ? `Regarding ${firstLine}` : '',
      'Request for Equipment Approval',
    ].filter(Boolean);
  }, [content, templateType]);

  const resetForm = () => {
    setSubject('');
    setContent('');
    setReceivers([]);
    setFiles([]);
    setServerPreviewHtml('');
    setPreviewOpen(false);
    setFileInputKey((key) => key + 1);
    setAutosaveStatus('idle');
    setAutosavedAt(null);
    setLastSavedDraft(null);
    setEditorSeed('');
    if (contentEditableRef.current) {
      contentEditableRef.current.innerHTML = '';
    }
    localStorage.removeItem('compose_draft');
    localStorage.removeItem('compose_draft_timestamp');
  };

  const validateForSubmit = () => {
    if (!sendName.trim()) {
      setError('Please enter the sender name.');
      return false;
    }
    if (receivers.length === 0) {
      setError('Please select at least one receiver.');
      return false;
    }
    if (!subject.trim()) {
      setError('Please enter a subject before sending.');
      return false;
    }
    if (!normalizeEditorHtml(content)) {
      setError('Please write your message before sending.');
      return false;
    }
    return true;
  };

  const validateForDraft = () => {
    if (!sendName.trim()) {
      setError('Please enter the sender name before saving a draft.');
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
      const res = await axios.post(
        '/api/messages/preview',
        {
          receiver_ids: receivers,
          receiver_id: receivers[0] || '',
          subject: subject.trim(),
          content: normalizeEditorHtml(content),
          template_type: templateType,
          sender_name: sendName.trim(),
          attachment_name: files[0]?.name || '',
          attachment_mime: files[0]?.type || '',
          attachment_size: files[0]?.size || 0,
        },
        {
          headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}` },
        }
      );
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
    if (action === 'draft' && !validateForDraft()) return;

    setSubmitting(true);
    const formData = new FormData();
    formData.append('receiver_ids', JSON.stringify(receivers));
    formData.append('receiver_id', receivers[0] || '');
    formData.append('subject', subject.trim());
    formData.append('content', normalizeEditorHtml(content));
    formData.append('template_type', templateType);
    formData.append('sender_name', sendName.trim());
    formData.append('action', action);

    try {
      const token = sessionStorage.getItem('token');
      if (token) {
        const b64 = token.split('.')[1];
        const json = atob(b64.replace(/-/g, '+').replace(/_/g, '/'));
        const payload = JSON.parse(json);
        if (payload?.department_id) formData.append('department_id', payload.department_id);
      }
    } catch {
      // Department id is optional here; the server can derive it from the token.
    }

    if (files.length > 0) formData.append('file', files[0]);

    try {
      await axios.post('/api/messages', formData, {
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem('token')}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      setSuccess(action === 'draft' ? 'Draft saved.' : 'Official letter sent.');
      notify({
        type: 'success',
        title: action === 'draft' ? 'Draft Saved notification' : 'Message Sent confirmation',
        message: action === 'draft' ? 'Your message draft was saved.' : 'Your formatted letter was sent successfully.',
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

  const addFiles = (newFiles) => {
    setFiles([...files, ...Array.from(newFiles)]);
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const applyFormat = (command, value = null) => {
    document.execCommand(command, false, value);
    const html = contentEditableRef.current?.innerHTML || '';
    setContent(normalizeEditorHtml(html));
    contentEditableRef.current?.focus();
  };

  const insertTable = () => {
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:12px 0;">
        <tbody>
          <tr>
            <td style="border:1px solid #cfd7e6; padding:8px;">Item</td>
            <td style="border:1px solid #cfd7e6; padding:8px;">Details</td>
          </tr>
          <tr>
            <td style="border:1px solid #cfd7e6; padding:8px;">&nbsp;</td>
            <td style="border:1px solid #cfd7e6; padding:8px;">&nbsp;</td>
          </tr>
        </tbody>
      </table>
    `;
    applyFormat('insertHTML', tableHtml);
  };

  const handleEditorInput = (e) => {
    const html = e.currentTarget.innerHTML || '';
    setContent(normalizeEditorHtml(html));
  };

  const handleEditorPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText', false, text);
    const html = contentEditableRef.current?.innerHTML || '';
    setContent(normalizeEditorHtml(html));
  };

  return (
    <div className="compose-container compose-container--document">
      <div className="page-title-row">
        <div>
          <h2>Compose Message</h2>
          <p className="admin-panel-hint">Create and send official internal correspondence</p>
        </div>
        <div className="compose-status-row">
          <span className={`autosave-indicator autosave-${autosaveStatus === 'saving' ? 'saving' : autosavedAt ? 'saved' : 'idle'}`} aria-live="polite">
            <span aria-hidden="true">{autosaveStatus === 'saving' ? '...' : autosavedAt ? 'OK' : '-'}</span>
            {autosaveLabel}
          </span>
        </div>
      </div>

      <div className="compose-document-layout compose-document-layout--single">
        <form
          className="compose-document-form"
          onSubmit={(e) => {
            e.preventDefault();
            requestPreview();
          }}
        >
          {loadingRecipients ? <div className="list-state">Loading recipients...</div> : null}

          <section className="compose-section" aria-labelledby="message-details-title">
            <div className="compose-section-heading">
              <h3 id="message-details-title">Message Details</h3>
            </div>

            <label className="compose-field">
              <span>Letter Template</span>
              <select value={templateType} onChange={(e) => setTemplateType(e.target.value)}>
                {LETTER_TEMPLATES.map((template) => (
                  <option key={template.value} value={template.value}>
                    {template.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="compose-field">
              <span>Recipients</span>
              <RecipientPicker users={users} selectedIds={receivers} onChange={setReceivers} />
            </label>

            <label className="compose-field">
              <span>Sender Name</span>
              <div className={`locked-input-wrap${isAdmin ? ' locked-input-wrap--editable' : ''}`}>
                <input
                  type="text"
                  placeholder="Sender name is loaded from your profile"
                  value={sendName}
                  onChange={(e) => setSendName(e.target.value)}
                  readOnly={!isAdmin}
                  aria-readonly={!isAdmin}
                  required
                />
                <span className="locked-input-badge">{isAdmin ? 'Admin editable' : 'Locked'}</span>
              </div>
            </label>

            <label className="compose-field">
              <span>Subject</span>
              <input
                type="text"
                placeholder="e.g., Request for Equipment Approval"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                list="compose-subject-suggestions"
                required
              />
              <datalist id="compose-subject-suggestions">
                {subjectSuggestions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
          </section>

          <section className="compose-section" aria-labelledby="message-content-title">
            <div className="compose-section-heading">
              <h3 id="message-content-title">Message Content</h3>
            </div>

            <label className="compose-field">
              <span>Write your message</span>
              <div className="rich-editor" style={{ position: 'relative' }}>
                <div className="editor-toolbar">
                  <button type="button" className="editor-btn" onClick={() => applyFormat('undo')} title="Undo" aria-label="Undo">
                    U
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('redo')} title="Redo" aria-label="Redo">
                    R
                  </button>
                  <div className="editor-separator" />
                  <button type="button" className="editor-btn" onClick={() => applyFormat('bold')} title="Bold">
                    <strong>B</strong>
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('italic')} title="Italic">
                    <em>I</em>
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('underline')} title="Underline">
                    <u>U</u>
                  </button>
                  <div className="editor-separator" />
                  <button type="button" className="editor-btn" onClick={() => applyFormat('justifyLeft')} title="Align left" aria-label="Align left">
                    L
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('justifyCenter')} title="Align center" aria-label="Align center">
                    C
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('justifyRight')} title="Align right" aria-label="Align right">
                    R
                  </button>
                  <div className="editor-separator" />
                  <button type="button" className="editor-btn" onClick={() => applyFormat('insertUnorderedList')} title="Bullet List">
                    ⚬
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('insertOrderedList')} title="Numbered List">
                    1.
                  </button>
                  <div className="editor-separator" />
                  <button
                    type="button"
                    className="editor-btn"
                    onClick={() => applyFormat('createLink', prompt('Enter URL:') || '')}
                    title="Add Link"
                  >
                    🔗
                  </button>
                  <button type="button" className="editor-btn editor-btn--wide" onClick={insertTable} title="Insert table" aria-label="Insert table">
                    Tbl
                  </button>
                  <button type="button" className="editor-btn editor-btn--wide" onClick={() => fileInputRef.current?.click()} title="Attach file" aria-label="Attach file">
                    Att
                  </button>
                  <button type="button" className="editor-btn" onClick={() => applyFormat('removeFormat')} title="Clear Formatting">
                    ✕
                  </button>
                </div>

                <div
                  className="editor-placeholder"
                  aria-hidden={!editorIsEmpty}
                  style={{
                    opacity: editorIsEmpty ? 1 : 0,
                    pointerEvents: 'none',
                    position: 'absolute',
                    left: 16,
                    top: 66,
                    zIndex: 2,
                  }}
                >
                  Write your message here...
                </div>

                <div
                  ref={contentEditableRef}
                  className="editor-content"
                  contentEditable
                  suppressContentEditableWarning
                  onInput={handleEditorInput}
                  onPaste={handleEditorPaste}
                  aria-label="Message content"
                  style={{ paddingTop: 0 }}
                />
              </div>
            </label>

            <label className="compose-field">
              <span>Attachments ({files.length})</span>
            <input
              ref={fileInputRef}
              key={fileInputKey}
              type="file"
              multiple
              onChange={(e) => addFiles(e.target.files)}
              className="file-input"
              accept="*/*"
            />
          </label>

          {files.length > 0 && (
            <div className="attachments-list">
              {files.map((file, idx) => (
                <div key={idx} className="attachment-preview">
                  <span className="attachment-info">
                    📎 {file.name}
                    <small>({Math.ceil(file.size / 1024)} KB)</small>
                  </span>
                  <button type="button" className="attachment-remove" onClick={() => removeFile(idx)} aria-label="Remove attachment">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          </section>

          <div className="compose-hint">
            Tip: Your message is automatically saved as you type. Select a letter template to format your correspondence professionally.
          </div>

          <div className="button-row compose-action-row">
            <button type="button" className="secondary-btn" onClick={() => handleSubmit('draft')} disabled={submitting || previewing}>
              {submitting ? 'Saving...' : 'Save Draft'}
            </button>
            <button type="submit" className="secondary-btn" disabled={submitting || previewing || loadingRecipients}>
              {previewing ? 'Preparing...' : 'Preview'}
            </button>
          </div>
          {success && <div className="success">{success}</div>}
          {error && <div className="error">{error}</div>}
        </form>
      </div>

      {previewOpen ? (
        <div className="modal-backdrop letter-preview-backdrop">
          <div className="letter-preview-modal" role="dialog" aria-modal="true" aria-labelledby="letter-preview-title">
            <div className="panel-title-row">
              <h3 id="letter-preview-title">Preview Letter</h3>
              <button type="button" className="secondary-btn letter-modal-close" onClick={() => setPreviewOpen(false)}>
                Edit
              </button>
            </div>
            <div className="letter-preview-scroll">
<LetterRenderer html={serverPreviewHtml || livePreviewHtml} />
            </div>
            <div className="confirm-modal-actions letter-modal-actions">
              <button type="button" className="secondary-btn" onClick={() => setPreviewOpen(false)}>
                Return to Compose
              </button>
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
