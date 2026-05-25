const pool = require('../models/db');
const messageModel = require('../models/message');
const { DM_ONLY_M } = require('../models/message');
const messageEventModel = require('../models/messageEvent');
const userModel = require('../models/user');

const typingState = new Map();
const TYPING_WINDOW_MS = 5000;

function requirePositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function makeReferenceNumber(senderId, receiverId) {
  // Not guaranteed unique across all time, so we add timestamp.
  return `DM-${senderId}-${receiverId}-${Date.now()}`;
}

async function markUserSeen(messageId, actorId, receiverId) {
  // mark read_at only for receiver side
  await messageModel.markAsRead(messageId, actorId);
  await messageEventModel.create({
    message_id: messageId,
    event_type: 'opened',
    actor_id: actorId
  });
}

exports.getThreads = async (req, res) => {
  try {
    const me = req.user.id;

    // We interpret any message where receiver_id = me OR sender_id = me as a DM candidate.
    // For now, we treat DM as: 1-to-1 where the other user is either sender or receiver.
    // thread_key is just sorting the pair.
    const [rows] = await pool.query(
      `SELECT
        CASE
          WHEN m.sender_id = ? THEN CONCAT('me:', m.receiver_id)
          ELSE CONCAT('me:', m.sender_id)
        END AS thread_key,
        CASE
          WHEN m.sender_id = ? THEN m.receiver_id
          ELSE m.sender_id
        END AS other_user_id,
        MAX(COALESCE(m.created_at, m.submitted_at)) AS last_message_at,
        MAX(m.created_at) AS last_message_raw_at,
        SUM(CASE WHEN m.read_at IS NULL AND m.receiver_id = ? THEN 1 ELSE 0 END) AS unread_count,
        MAX(m.delivered_at) AS last_delivered_at,
        MAX(m.read_at) AS last_read_at,
        MAX(o.name) AS other_user_name,
        SUBSTRING_INDEX(MAX(CONCAT(m.created_at, '|', COALESCE(m.content, m.raw_content, ''))), '|', -1) AS last_message_text
      FROM messages m
      LEFT JOIN users o ON o.id = (CASE WHEN m.sender_id = ? THEN m.receiver_id ELSE m.sender_id END)
      WHERE m.status <> 'draft'
        AND ${DM_ONLY_M}
        AND (m.sender_id = ? OR m.receiver_id = ?)
      GROUP BY thread_key, other_user_id
      ORDER BY last_message_at DESC
      LIMIT 50`,
      [me, me, me, me, me, me]
    );

    const threads = rows.map((r) => ({
      thread_key: r.thread_key,
      other_user_id: r.other_user_id,
      other_user_name: r.other_user_name,
      last_message_at: r.last_message_raw_at,
      last_message_text: r.last_message_text || '',
      unread_count: Number(r.unread_count) || 0,
      last_delivered_at: r.last_delivered_at
    }));

    res.json(threads);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching DM threads', error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const me = req.user.id;
    const otherUserId = requirePositiveInt(req.params.otherUserId);
    if (!otherUserId) return res.status(400).json({ message: 'Invalid user' });

    // Fetch all DM messages between the pair.
    const [rows] = await pool.query(
      `SELECT
        m.id,
        m.sender_id,
        m.receiver_id,
        m.subject,
        m.content,
        m.raw_content,
        m.created_at,
        m.submitted_at,
        m.delivered_at,
        m.read_at
      FROM messages m
      WHERE m.status <> 'draft'
        AND ${DM_ONLY_M}
        AND ((m.sender_id = ? AND m.receiver_id = ?) OR (m.sender_id = ? AND m.receiver_id = ?))
      ORDER BY m.id ASC`,
      [me, otherUserId, otherUserId, me]
    );

    const [otherSeen] = await pool.query(
      `SELECT MAX(m.read_at) AS other_seen_at
       FROM messages m
       WHERE m.status <> 'draft'
         AND m.receiver_id = ?
         AND m.sender_id = ?
         AND m.read_at IS NOT NULL`,
      [me, otherUserId]
    );

    const other_user = await userModel.findById(otherUserId);

    res.json({
      thread: {
        my_user_id: me,
        other_user_id: otherUserId,
        other_seen_at: otherSeen?.[0]?.other_seen_at || null
      },
      other_user: other_user || null,
      messages: rows
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching DM messages', error: err.message });
  }
};

exports.sendMessage = async (req, res) => {
  try {
    const me = req.user.id;
    const otherUserId = requirePositiveInt(req.params.otherUserId);
    if (!otherUserId) return res.status(400).json({ message: 'Invalid user' });

    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ message: 'Message content is required' });

    // Create a message row for DM.
    // Use minimal fields; department_id is required by schema.
    // We'll use sender's department_id from users table.
    const [[meRow]] = await pool.query('SELECT department_id, name FROM users WHERE id = ?', [me]);
    const department_id = meRow?.department_id;
    if (!department_id) return res.status(400).json({ message: 'Department is required to send DM' });

    const reference_number = makeReferenceNumber(me, otherUserId);
    const subject = 'Direct message';

    const messageId = await messageModel.create({
      sender_id: me,
      receiver_id: otherUserId,
      sender_name: null,
      subject,
      content,
      raw_content: content,
      formatted_content: null,
      template_type: 'direct_message',
      reference_number,
      status: 'delivered',
      file_path: null,
      department_id,
      due_date: null
    });

    // events
    await messageEventModel.create({
      message_id: messageId,
      event_type: 'sent',
      actor_id: me,
      to_status: 'delivered'
    });
    await messageEventModel.create({
      message_id: messageId,
      event_type: 'delivered',
      actor_id: me,
      to_status: 'delivered'
    });

    res.json({ message_id: messageId });
  } catch (err) {
    res.status(500).json({ message: 'Error sending DM message', error: err.message });
  }
};

exports.markSeen = async (req, res) => {
  try {
    const me = req.user.id;
    const otherUserId = requirePositiveInt(req.params.otherUserId);
    if (!otherUserId) return res.status(400).json({ message: 'Invalid user' });

    // Mark all delivered/unread messages from other user to me as read.
    const [rows] = await pool.query(
      `SELECT id FROM messages
       WHERE status <> 'draft'
         AND sender_id = ?
         AND receiver_id = ?
         AND read_at IS NULL
       ORDER BY id DESC
       LIMIT 200`,
      [otherUserId, me]
    );

    const ids = Array.isArray(rows) ? rows.map((r) => r.id) : [];
    for (const id of ids) {
      await markUserSeen(id, me, otherUserId);
    }

    res.json({ ok: true, marked: ids.length });
  } catch (err) {
    res.status(500).json({ message: 'Error marking DM as seen', error: err.message });
  }
};

exports.getTyping = async (req, res) => {
  try {
    const me = req.user.id;
    const otherUserId = requirePositiveInt(req.params.otherUserId);
    if (!otherUserId) return res.status(400).json({ message: 'Invalid user' });

    const key = `${otherUserId}:${me}`;
    const lastTypedAt = typingState.get(key) || 0;
    const isTyping = Date.now() - lastTypedAt < TYPING_WINDOW_MS;
    if (!isTyping) typingState.delete(key);

    res.json({ is_typing: isTyping });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching typing state', error: err.message });
  }
};

exports.setTyping = async (req, res) => {
  try {
    const me = req.user.id;
    const otherUserId = requirePositiveInt(req.params.otherUserId);
    if (!otherUserId) return res.status(400).json({ message: 'Invalid user' });

    const is_typing = Boolean(req.body?.is_typing);

    if (is_typing) {
      typingState.set(`${me}:${otherUserId}`, Date.now());
    } else {
      typingState.delete(`${me}:${otherUserId}`);
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Error setting typing', error: err.message });
  }
};

