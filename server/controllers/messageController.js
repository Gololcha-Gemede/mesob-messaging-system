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
  const [[{ count }]] = await pool.query('SELECT COUNT(*) as count FROM messages WHERE department_id = ?', [department_id]);
  const deptId = Number(department_id);
  const deptName = departments.find((d) => d.id === deptId)?.name?.substring(0, 3).toUpperCase() || 'GEN';
  return `${deptName}-${year}-${padNumber(count+1, 4)}`;
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

function canAccessMessage(user, message) {
  if (message.status === 'draft') return Number(message.sender_id) === Number(user.id);
  if (user.role === 'admin') return true;
  return Number(message.sender_id) === Number(user.id) || Number(message.receiver_id) === Number(user.id);
}

exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, receiver_ids, subject, content, department_id, action, due_date } = req.body;
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
    const receiversToCreate = selectedReceiverIds.length ? selectedReceiverIds : [null];
    const createdMessages = [];

    for (const receiverId of receiversToCreate) {
      const reference_number = await generateReferenceNumber(effectiveDepartmentId);
      const messageId = await messageModel.create({
        sender_id,
        receiver_id: receiverId,
        subject: normalizedAction === 'submit' ? subjectTrimmed : (subject || ''),
        content: content || '',
        reference_number,
        status,
        file_path,
        department_id: effectiveDepartmentId,
        due_date: due_date || null
      });
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
    const history = await messageEventModel.getByMessageId(id);
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
      const reference_number = await generateReferenceNumber(message.department_id);
      const newId = await messageModel.forward({
        original_id: id,
        new_receiver_id: receiverId,
        actor_id: req.user.id,
        reference_number,
        due_date: due_date || null
      });
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
