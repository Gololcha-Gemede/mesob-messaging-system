const pool = require('./db');

module.exports = {
  async create(message) {
    const {
      sender_id,
      receiver_id,
      subject,
      content,
      reference_number,
      status,
      file_path,
      department_id,
      due_date = null
    } = message;
    const [result] = await pool.query(
      `INSERT INTO messages (
        sender_id, receiver_id, subject, content, reference_number, status, file_path, department_id, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [sender_id, receiver_id, subject, content, reference_number, status, file_path, department_id, due_date]
    );
    return result.insertId;
  },
  async getInbox(userId, filters = {}) {
    let sql = "SELECT * FROM messages WHERE receiver_id = ? AND status <> 'draft'";
    const params = [userId];
    const subject = typeof filters.subject === 'string' ? filters.subject.trim() : '';
    const reference = typeof filters.reference === 'string' ? filters.reference.trim() : '';
    if (subject) {
      sql += ' AND subject LIKE ?';
      params.push(`%${subject}%`);
    }
    if (reference) {
      sql += ' AND reference_number LIKE ?';
      params.push(`%${reference}%`);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async getSent(userId, filters = {}) {
    let sql = "SELECT * FROM messages WHERE sender_id = ? AND status <> 'draft'";
    const params = [userId];
    const subject = typeof filters.subject === 'string' ? filters.subject.trim() : '';
    const reference = typeof filters.reference === 'string' ? filters.reference.trim() : '';
    if (subject) {
      sql += ' AND subject LIKE ?';
      params.push(`%${subject}%`);
    }
    if (reference) {
      sql += ' AND reference_number LIKE ?';
      params.push(`%${reference}%`);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async getDrafts(userId, filters = {}) {
    let sql = "SELECT * FROM messages WHERE sender_id = ? AND status = 'draft'";
    const params = [userId];
    const subject = typeof filters.subject === 'string' ? filters.subject.trim() : '';
    const reference = typeof filters.reference === 'string' ? filters.reference.trim() : '';
    if (subject) {
      sql += ' AND subject LIKE ?';
      params.push(`%${subject}%`);
    }
    if (reference) {
      sql += ' AND reference_number LIKE ?';
      params.push(`%${reference}%`);
    }
    sql += ' ORDER BY id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async getAllForAdmin(userId) {
    const [rows] = await pool.query(
      `SELECT m.id, m.subject, m.reference_number, m.status, m.sender_id, m.receiver_id,
              m.submitted_at, m.read_at, m.created_at,
              s.name AS sender_name, r.name AS receiver_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.receiver_id
       WHERE m.status <> 'draft' OR m.sender_id = ?
       ORDER BY m.id DESC`,
      [userId]
    );
    return rows;
  },
  async track({ userId, role, reference, subject }) {
    let sql = `SELECT m.*, s.name AS sender_name, r.name AS receiver_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.receiver_id
       WHERE 1 = 1`;
    const params = [];
    const cleanReference = typeof reference === 'string' ? reference.trim() : '';
    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';

    if (role !== 'admin') {
      sql += ' AND m.sender_id = ?';
      params.push(userId);
    }
    if (cleanReference) {
      sql += ' AND m.reference_number LIKE ?';
      params.push(`%${cleanReference}%`);
    }
    if (cleanSubject) {
      sql += ' AND m.subject LIKE ?';
      params.push(`%${cleanSubject}%`);
    }

    sql += ' ORDER BY m.id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async markAsRead(id, userId) {
    const [result] = await pool.query(
      `UPDATE messages
       SET read_at = NOW(),
           status = CASE WHEN status = 'submitted' THEN 'received' ELSE status END
       WHERE id = ? AND receiver_id = ? AND read_at IS NULL`,
      [id, userId]
    );
    return result.affectedRows;
  },
  async forward({ original_id, new_receiver_id, actor_id, reference_number, due_date = null }) {
    // Copy message and assign new receiver
    const [original] = await pool.query('SELECT * FROM messages WHERE id = ?', [original_id]);
    if (!original[0]) throw new Error('Original message not found');
    const msg = original[0];
    const [result] = await pool.query(
      `INSERT INTO messages (
        sender_id, receiver_id, subject, content, reference_number, status, file_path, department_id, parent_message_id, due_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [actor_id, new_receiver_id, msg.subject, msg.content, reference_number, 'submitted', msg.file_path, msg.department_id, msg.id, due_date]
    );
    return result.insertId;
  },
  async submit(id, senderId) {
    const [result] = await pool.query(
      `UPDATE messages
       SET status = 'submitted', submitted_at = NOW()
       WHERE id = ? AND sender_id = ? AND status = 'draft'`,
      [id, senderId]
    );
    return result.affectedRows;
  },
  async getById(id) {
    const [rows] = await pool.query(
      `SELECT m.*, s.name AS sender_name, r.name AS receiver_name
       FROM messages m
       LEFT JOIN users s ON s.id = m.sender_id
       LEFT JOIN users r ON r.id = m.receiver_id
       WHERE m.id = ?`,
      [id]
    );
    return rows[0];
  },
  
};
