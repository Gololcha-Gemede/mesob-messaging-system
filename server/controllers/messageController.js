const messageModel = require('../models/message');
const messageEventModel = require('../models/messageEvent');
const departmentModel = require('../models/department');
const pool = require('../models/db');

function padNumber(num, size) {
  let s = num+'';
  while (s.length < size) s = '0' + s;
  return s;
}

async function generateReferenceNumber(department_id) {
  const departments = await departmentModel.getAll();
  const year = new Date().getFullYear();
  const deptId = Number(department_id);
  const deptName = departments.find((d) => d.id === deptId)?.name?.substring(0, 3).toUpperCase() || 'GEN';
  const prefix = `${deptName}-${year}-`;
  const [rows] = await pool.query(
    `SELECT reference_number
     FROM messages
     WHERE department_id = ? AND reference_number LIKE ?
     ORDER BY reference_number DESC
     LIMIT 1`,
    [department_id, `${prefix}%`]
  );
  const lastNumber = Number(String(rows[0]?.reference_number || '').split('-').pop());
  return `${prefix}${padNumber((Number.isInteger(lastNumber) ? lastNumber : 0) + 1, 4)}`;
}

async function getUserDepartmentId(userId) {
  const [[row]] = await pool.query('SELECT department_id FROM users WHERE id = ?', [userId]);
  return row?.department_id || null;
}

function parseRecipientIds(value) {
  if (!value) return [];

  let rawValue = value;
  if (typeof rawValue === 'string') {
    try {
      rawValue = JSON.parse(rawValue);
    } catch {
      rawValue = rawValue.split(',');
    }
  }

  const values = Array.isArray(rawValue) ? rawValue : [rawValue];
  return [...new Set(
    values
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0)
  )];
}

function parseBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1;
}

function cleanLetterHtml(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son\w+="[^"]*"/gi, '')
    .replace(/\son\w+='[^']*'/gi, '')
    .replace(/\sjavascript:/gi, '');
}

function canAccessMessage(user, message) {
  if (message.status === 'draft') return Number(message.sender_id) === Number(user.id);
  if (user.role === 'admin') return true;
  return Number(message.sender_id) === Number(user.id) || Number(message.receiver_id) === Number(user.id);
}

async function createMessageWithReference(payload, departmentId, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reference_number = await generateReferenceNumber(departmentId);
    try {
      const letter_html = typeof payload.letter_html === 'string'
        ? payload.letter_html.replace(/__SYSTEM_REFERENCE_NUMBER__/g, reference_number)
        : payload.letter_html;
      const messageId = await messageModel.create({ ...payload, letter_html, reference_number });
      return { messageId, reference_number };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY' || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error('Unable to generate a unique reference number');
}

async function forwardMessageWithReference(payload, departmentId, maxAttempts = 5) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const reference_number = await generateReferenceNumber(departmentId);
    try {
      const messageId = await messageModel.forward({ ...payload, reference_number });
      return { messageId, reference_number };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY' || attempt === maxAttempts - 1) throw err;
    }
  }
  throw new Error('Unable to generate a unique reference number');
}

exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, receiver_ids, subject, content, department_id, action, due_date, is_formal_letter, letter_html, pdf_path } = req.body;
    const sender_id = req.user.id;
    const selectedReceiverIds = parseRecipientIds(receiver_ids || receiver_id);
    const effectiveDepartmentId = req.user.department_id || department_id || await getUserDepartmentId(sender_id);
    if (!effectiveDepartmentId) {
      return res.status(400).json({ message: 'Department is required to send a message' });
    }

    const normalizedAction = action === 'draft' ? 'draft' : 'submit';
    if (normalizedAction === 'submit' && selectedReceiverIds.length === 0) {
      return res.status(400).json({ message: 'At least one receiver is required to submit a message' });
    }

    const subjectTrimmed = typeof subject === 'string' ? subject.trim() : '';
    if (normalizedAction === 'submit' && !subjectTrimmed) {
      return res.status(400).json({ message: 'Subject is required to send a message' });
    }

    const status = normalizedAction === 'draft' ? 'draft' : 'submitted';
    const file_path = req.file ? req.file.path : null;
    const formalLetterEnabled = parseBoolean(is_formal_letter);
    const sanitizedLetterHtml = formalLetterEnabled ? cleanLetterHtml(letter_html) : null;
    const receiversToCreate = selectedReceiverIds.length ? selectedReceiverIds : [null];
    const createdMessages = [];

    for (const receiverId of receiversToCreate) {
      const { messageId, reference_number } = await createMessageWithReference({
        sender_id,
        receiver_id: receiverId,
        subject: normalizedAction === 'submit' ? subjectTrimmed : (subject || ''),
        content: content || '',
        status,
        file_path,
        department_id: effectiveDepartmentId,
        due_date: due_date || null,
        is_formal_letter: formalLetterEnabled ? 1 : 0,
        letter_html: sanitizedLetterHtml,
        pdf_path: formalLetterEnabled && typeof pdf_path === 'string' && pdf_path.trim() ? pdf_path.trim() : null
      }, effectiveDepartmentId);
      await messageEventModel.create({
        message_id: messageId,
        event_type: normalizedAction === 'draft' ? 'created_draft' : 'submitted',
        actor_id: sender_id,
        to_status: status
      });
      createdMessages.push({ id: messageId, reference_number, receiver_id: receiverId });
    }

    res.status(201).json({
      id: createdMessages[0]?.id,
      reference_number: createdMessages[0]?.reference_number,
      messages: createdMessages
    });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
};

exports.getInbox = async (req, res) => {
  try {
    const subject = typeof req.query.subject === 'string' ? req.query.subject : '';
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    const messages = await messageModel.getInbox(req.user.id, { subject, reference });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching inbox', error: err.message });
  }
};

exports.getSent = async (req, res) => {
  try {
    const subject = typeof req.query.subject === 'string' ? req.query.subject : '';
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    const messages = await messageModel.getSent(req.user.id, { subject, reference });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching sent messages', error: err.message });
  }
};

exports.getDrafts = async (req, res) => {
  try {
    const subject = typeof req.query.subject === 'string' ? req.query.subject : '';
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    const messages = await messageModel.getDrafts(req.user.id, { subject, reference });
    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching drafts', error: err.message });
  }
};

exports.deleteDrafts = async (req, res) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [req.params.id];
    const deleted = await messageModel.deleteDrafts(req.user.id, ids);
    if (!deleted) return res.status(404).json({ message: 'No matching draft messages found' });
    res.json({ message: 'Draft message deleted', deleted });
  } catch (err) {
    res.status(500).json({ message: 'Error deleting draft messages', error: err.message });
  }
};

exports.getUnreadNotifications = async (req, res) => {
  try {
    const [messages, count] = await Promise.all([
      messageModel.getUnreadForUser(req.user.id),
      messageModel.countUnreadForUser(req.user.id)
    ]);
    res.json({ count, messages });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching notifications', error: err.message });
  }
};

exports.getAllMessagesAdmin = async (req, res) => {
  try {
    const rows = await messageModel.getAllForAdmin(req.user.id);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching messages', error: err.message });
  }
};

exports.trackMessage = async (req, res) => {
  try {
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    const subject = typeof req.query.subject === 'string' ? req.query.subject : '';
    if (!reference.trim() && !subject.trim()) {
      return res.status(400).json({ message: 'Reference number or subject is required' });
    }

    const rows = await messageModel.track({
      userId: req.user.id,
      role: req.user.role,
      reference,
      subject
    });
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error tracking message', error: err.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!Number.isInteger(Number(id)) || Number(id) <= 0) {
      return res.status(400).json({ message: 'Invalid message id' });
    }
    const changed = await messageModel.markAsRead(id, req.user.id);
    if (changed) {
      await messageEventModel.create({
        message_id: id,
        event_type: 'read',
        actor_id: req.user.id
      });
      return res.json({ message: 'Marked as read' });
    }
    res.json({ message: 'Already marked as read' });
  } catch (err) {
    res.status(500).json({ message: 'Error marking as read', error: err.message });
  }
};

exports.getMessageById = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.getById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!canAccessMessage(req.user, message)) return res.status(403).json({ message: 'Forbidden' });
    res.json(message);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching message', error: err.message });
  }
};

exports.getMessageHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.getById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!canAccessMessage(req.user, message)) return res.status(403).json({ message: 'Forbidden' });
    const history = await messageEventModel.getByMessageChainId(id);
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching message history', error: err.message });
  }
};

exports.submitDraft = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.getById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (Number(message.sender_id) !== Number(req.user.id)) return res.status(403).json({ message: 'Forbidden' });
    if (!message.receiver_id) return res.status(400).json({ message: 'Cannot submit draft without a receiver' });

    const affected = await messageModel.submit(id, req.user.id);
    if (!affected) return res.status(400).json({ message: 'Only draft messages can be submitted' });
    await messageEventModel.create({
      message_id: id,
      event_type: 'submitted',
      actor_id: req.user.id,
      from_status: 'draft',
      to_status: 'submitted'
    });
    res.json({ message: 'Draft submitted' });
  } catch (err) {
    res.status(500).json({ message: 'Error submitting draft', error: err.message });
  }
};

exports.forwardMessage = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_receiver_id, new_receiver_ids, note, due_date } = req.body;
    const selectedReceiverIds = parseRecipientIds(new_receiver_ids || new_receiver_id);
    if (selectedReceiverIds.length === 0) return res.status(400).json({ message: 'At least one new receiver is required' });

    const message = await messageModel.getById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!canAccessMessage(req.user, message)) return res.status(403).json({ message: 'Forbidden' });
    const forwardedMessages = [];

    for (const receiverId of selectedReceiverIds) {
      const { messageId: newId, reference_number } = await forwardMessageWithReference({
        original_id: id,
        new_receiver_id: receiverId,
        actor_id: req.user.id,
        due_date: due_date || null
      }, message.department_id);
      await messageEventModel.create({
        message_id: newId,
        event_type: 'forwarded',
        actor_id: req.user.id,
        note: note || null,
        to_status: 'submitted'
      });
      forwardedMessages.push({ id: newId, reference_number, receiver_id: receiverId });
    }

    res.json({ id: forwardedMessages[0]?.id, messages: forwardedMessages });
  } catch (err) {
    res.status(500).json({ message: 'Error forwarding message', error: err.message });
  }
};

exports.downloadAttachment = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.getById(id);
    if (!message || !message.file_path) return res.status(404).json({ message: 'No attachment found' });
    if (!canAccessMessage(req.user, message)) return res.status(403).json({ message: 'Forbidden' });
    await messageEventModel.create({
      message_id: id,
      event_type: 'attachment_downloaded',
      actor_id: req.user.id
    });
    res.download(message.file_path);
  } catch (err) {
    res.status(500).json({ message: 'Error downloading attachment', error: err.message });
  }
};
