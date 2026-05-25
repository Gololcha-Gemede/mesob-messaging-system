const messageModel = require('../models/message');
const messageEventModel = require('../models/messageEvent');
const userModel = require('../models/user');
const pool = require('../models/db');
const { generateLetterHtml, getTemplateOptions, normalizeTemplateType } = require('../services/letterFormatter');
const { withLockedReference } = require('../services/referenceService');
const { generateLetterPdf } = require('../services/pdfService');
const { audit } = require('../utils/audit');
const { validateUploadedFile } = require('../utils/uploadSecurity');

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

function fileMetadata(file) {
  if (!file) return {};
  return {
    file_path: file.path,
    file_name: file.originalname || file.filename || null,
    file_mime: file.mimetype || null,
    file_size: file.size || null
  };
}

function messageAttachmentMetadata(message) {
  if (!message?.file_path && !message?.file_name) return [];
  return [{
    name: message.file_name || String(message.file_path).split(/[\\/]/).pop(),
    mime: message.file_mime || '',
    size: message.file_size || 0
  }];
}

function uploadAttachmentMetadata(file) {
  if (!file) return [];
  return [{
    name: file.originalname || file.filename,
    mime: file.mimetype || '',
    size: file.size || 0
  }];
}

function previewAttachmentMetadata(body) {
  if (!body?.attachment_name) return [];
  return [{
    name: body.attachment_name,
    mime: body.attachment_mime || '',
    size: Number(body.attachment_size) || 0
  }];
}

function buildLetterPayload({
  template_type,
  reference_number,
  sender,
  receiver,
  subject,
  content,
  attachments,
  date = new Date()
}) {
  return {
    templateType: normalizeTemplateType(template_type),
    referenceNumber: reference_number,
    date,
    senderName: sender?.name || 'Sender',
    senderTitle: sender?.position_title || '',
    recipientName: receiver?.name || 'Recipient',
    subject: subject || '(No subject)',
    body: content || '',
    attachments,
    signatureImagePath: '',
    logoUrl: '/qms-logo.png'
  };
}

async function createGeneratedMessage(payload, { sender, receiver, attachments, shouldGeneratePdf }) {
  return withLockedReference(async (reference_number) => {
    const letterPayload = buildLetterPayload({
      template_type: payload.template_type,
      reference_number,
      sender,
      receiver,
      subject: payload.subject,
      content: payload.raw_content || payload.content,
      attachments
    });
    const formatted_content = generateLetterHtml(letterPayload);
    const pdf_path = shouldGeneratePdf ? await generateLetterPdf(letterPayload) : null;
    const messageId = await messageModel.create({
      ...payload,
      content: payload.raw_content || payload.content || '',
      formatted_content,
      reference_number,
      pdf_path
    });
    return { messageId, reference_number, formatted_content, pdf_path };
  });
}

exports.sendMessage = async (req, res) => {
  try {
    const { receiver_id, receiver_ids, subject, content, department_id, action, due_date, template_type, sender_name } = req.body;
    const sender_id = req.user.id;
    const selectedReceiverIds = parseRecipientIds(receiver_ids || receiver_id);
    const senderNameTrimmed = typeof sender_name === 'string' ? sender_name.trim() : '';
    const effectiveDepartmentId = req.user.department_id || department_id || await getUserDepartmentId(sender_id);
    if (!effectiveDepartmentId) {
      return res.status(400).json({ message: 'Department is required to send a message' });
    }
    if (!senderNameTrimmed) {
      return res.status(400).json({ message: 'Sender name is required' });
    }

    const normalizedAction = action === 'draft' ? 'draft' : 'submit';
    if (normalizedAction === 'submit' && selectedReceiverIds.length === 0) {
      return res.status(400).json({ message: 'At least one receiver is required to submit a message' });
    }

    const subjectTrimmed = typeof subject === 'string' ? subject.trim() : '';
    if (normalizedAction === 'submit' && !subjectTrimmed) {
      return res.status(400).json({ message: 'Subject is required to send a message' });
    }

    const status = normalizedAction === 'draft' ? 'draft' : 'delivered';
    const uploadError = await validateUploadedFile(req.file, { allowPdf: true, allowImages: true });
    if (uploadError) return res.status(400).json({ message: uploadError });
    const sender = await userModel.findById(sender_id);
    const senderForLetter = { ...sender, name: senderNameTrimmed };
    const attachmentFields = fileMetadata(req.file);
    // Note: actual file metadata is stored on the message (file_path/file_name/etc.)
    // but attachments are not rendered inside the letter HTML.
    const attachments = uploadAttachmentMetadata(req.file);

    const receiversToCreate = selectedReceiverIds.length ? selectedReceiverIds : [null];
    const createdMessages = [];

    for (const receiverId of receiversToCreate) {
      const receiver = receiverId ? await userModel.findById(receiverId) : null;
      const { messageId, reference_number } = await createGeneratedMessage({
        sender_id,
        receiver_id: receiverId,
        subject: normalizedAction === 'submit' ? subjectTrimmed : (subject || ''),
        raw_content: content || '',
        content: content || '',
        template_type: normalizeTemplateType(template_type),
        sender_name: senderNameTrimmed,
        status,

        ...attachmentFields,
        department_id: effectiveDepartmentId,
        due_date: due_date || null
      }, {
        sender: senderForLetter,
        receiver,
        attachments: [],
        shouldGeneratePdf: normalizedAction === 'submit'
      });
      await messageEventModel.create({
        message_id: messageId,
        event_type: normalizedAction === 'draft' ? 'created_draft' : 'sent',
        actor_id: sender_id,
        to_status: status
      });
      if (normalizedAction === 'submit') {
        await messageEventModel.create({
          message_id: messageId,
          event_type: 'delivered',
          actor_id: sender_id,
          to_status: 'delivered'
        });
      }
      createdMessages.push({ id: messageId, reference_number, receiver_id: receiverId });
    }

    res.status(201).json({
      id: createdMessages[0]?.id,
      reference_number: createdMessages[0]?.reference_number,
      messages: createdMessages
    });
    audit(normalizedAction === 'draft' ? 'draft_created' : 'message_sent', req, {
      message_ids: createdMessages.map((message) => message.id),
      receiver_ids: selectedReceiverIds
    });
  } catch (err) {
    res.status(500).json({ message: 'Error sending message', error: err.message });
  }
};

exports.previewMessage = async (req, res) => {
  try {
    const { receiver_id, receiver_ids, subject, content, template_type, sender_name } = req.body;
    const selectedReceiverIds = parseRecipientIds(receiver_ids || receiver_id);
    const senderNameTrimmed = typeof sender_name === 'string' ? sender_name.trim() : '';
    if (!senderNameTrimmed) {
      return res.status(400).json({ message: 'Sender name is required' });
    }
    const sender = await userModel.findById(req.user.id);

    const receiver = selectedReceiverIds[0] ? await userModel.findById(selectedReceiverIds[0]) : null;
    const reference_number = `IMS-${new Date().getFullYear()}-PREVIEW`;
    const letterPayload = buildLetterPayload({
      template_type,
      reference_number,
      sender: {
        ...sender,
        name: senderNameTrimmed
      },
      receiver,
      subject: subject || '(No subject)',
      content: content || '',
      // Attachments should be delivered separately (downloadable), not rendered inside the letter HTML.
      attachments: []
    });

    res.json({

      formatted_content: generateLetterHtml(letterPayload),
      reference_number,
      template_type: normalizeTemplateType(template_type),
      template_options: getTemplateOptions()
    });
  } catch (err) {
    res.status(500).json({ message: 'Error generating preview', error: err.message });
  }
};

exports.getInbox = async (req, res) => {
  try {
    const subject = typeof req.query.subject === 'string' ? req.query.subject : '';
    const reference = typeof req.query.reference === 'string' ? req.query.reference : '';
    const status = typeof req.query.status === 'string' ? req.query.status : '';
    const messages = await messageModel.getInbox(req.user.id, { subject, reference, status });
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
        event_type: 'opened',
        actor_id: req.user.id
      });
      return res.json({ message: 'Marked as opened' });
    }
    res.json({ message: 'Already marked as opened' });
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

    const sender = await userModel.findById(message.sender_id);
    const senderForLetter = { ...sender, name: message.sender_name || sender?.name };
    const receiver = await userModel.findById(message.receiver_id);
    const letterPayload = buildLetterPayload({
      template_type: message.template_type,
      reference_number: message.reference_number,
      sender: senderForLetter,
      receiver,
      subject: message.subject,
      content: message.raw_content || message.content,
      // Attachments should be delivered separately (downloadable), not rendered inside the letter HTML.
      attachments: []
    });
    const formatted_content = generateLetterHtml(letterPayload);
    const pdf_path = await generateLetterPdf(letterPayload);
    const affected = await messageModel.submit(id, req.user.id, { formatted_content, pdf_path });
    if (!affected) return res.status(400).json({ message: 'Only draft messages can be submitted' });
    await messageEventModel.create({
      message_id: id,
      event_type: 'sent',
      actor_id: req.user.id,
      from_status: 'draft',
      to_status: 'delivered'
    });
    await messageEventModel.create({
      message_id: id,
      event_type: 'delivered',
      actor_id: req.user.id,
      to_status: 'delivered'
    });
    res.json({ message: 'Draft submitted' });
    audit('draft_submitted', req, { message_id: Number(id) });
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
    const sender = await userModel.findById(req.user.id);

    for (const receiverId of selectedReceiverIds) {
      const { messageId: newId, reference_number } = await withLockedReference(async (nextReference) => {
        const insertedId = await messageModel.forward({
          original_id: id,
          new_receiver_id: receiverId,
          actor_id: req.user.id,
          reference_number: nextReference,
          due_date: due_date || null
        });
        return { messageId: insertedId, reference_number: nextReference };
      });
      const receiver = await userModel.findById(receiverId);
      const letterPayload = buildLetterPayload({
        template_type: message.template_type,
        reference_number,
        sender,
        receiver,
        subject: message.subject,
        content: message.raw_content || message.content,
        // Attachments should be delivered separately (downloadable), not rendered inside the letter HTML.
        attachments: []
      });
      const formatted_content = generateLetterHtml(letterPayload);
      const pdf_path = await generateLetterPdf(letterPayload);
      await messageModel.updateGeneratedFields(newId, { formatted_content, pdf_path });
      await messageEventModel.create({
        message_id: newId,
        event_type: 'forwarded',
        actor_id: req.user.id,
        note: note || null,
        to_status: 'delivered'
      });
      await messageEventModel.create({
        message_id: newId,
        event_type: 'delivered',
        actor_id: req.user.id,
        to_status: 'delivered'
      });
      forwardedMessages.push({ id: newId, reference_number, receiver_id: receiverId });
    }

    res.json({ id: forwardedMessages[0]?.id, messages: forwardedMessages });
    audit('message_forwarded', req, {
      original_message_id: Number(id),
      message_ids: forwardedMessages.map((message) => message.id)
    });
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
    audit('attachment_downloaded', req, { message_id: Number(id) });
    res.download(message.file_path);
  } catch (err) {
    res.status(500).json({ message: 'Error downloading attachment', error: err.message });
  }
};

exports.downloadPdf = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.getById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!canAccessMessage(req.user, message)) return res.status(403).json({ message: 'Forbidden' });

    let pdfPath = message.pdf_path;
    if (!pdfPath) {
      const sender = await userModel.findById(message.sender_id);
      const senderForLetter = { ...sender, name: message.sender_name || sender?.name };
      const receiver = message.receiver_id ? await userModel.findById(message.receiver_id) : null;
      const letterPayload = buildLetterPayload({
        template_type: message.template_type,
        reference_number: message.reference_number,
        sender: senderForLetter,
        receiver,
        subject: message.subject,
        content: message.raw_content || message.content,
        // Attachments should be delivered separately (downloadable), not rendered inside the letter HTML.
        attachments: [],
        date: message.submitted_at || message.created_at || new Date()
      });
      pdfPath = await generateLetterPdf(letterPayload);
      await messageModel.updateGeneratedFields(id, { pdf_path: pdfPath });
    }

    await messageModel.markPdfDownloaded(id, req.user.id);
    await messageEventModel.create({
      message_id: id,
      event_type: 'pdf_downloaded',
      actor_id: req.user.id
    });
    audit('pdf_downloaded', req, { message_id: Number(id) });
    res.download(pdfPath, `${message.reference_number || `message-${id}`}.pdf`);
  } catch (err) {
    res.status(500).json({ message: 'Error downloading PDF', error: err.message });
  }
};

exports.markPrinted = async (req, res) => {
  try {
    const { id } = req.params;
    const message = await messageModel.getById(id);
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (!canAccessMessage(req.user, message)) return res.status(403).json({ message: 'Forbidden' });
    await messageModel.markPrinted(id, req.user.id);
    await messageEventModel.create({
      message_id: id,
      event_type: 'printed',
      actor_id: req.user.id
    });
    res.json({ message: 'Print tracked' });
  } catch (err) {
    res.status(500).json({ message: 'Error tracking print', error: err.message });
  }
};
