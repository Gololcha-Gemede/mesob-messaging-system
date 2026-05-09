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
        sender_id, receiver_id, subject, content, reference_number, status, file_path, department_id, due_date, submitted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        sender_id,
        receiver_id,
        subject,
        content,
        reference_number,
        status,
        file_path,
        department_id,
        due_date,
        status === 'submitted' ? new Date() : null
      ]
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
    sql += ' ORDER BY COALESCE(created_at, submitted_at) DESC, id DESC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async deleteDrafts(userId, ids) {
    const cleanIds = [...new Set(
      (Array.isArray(ids) ? ids : [ids])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )];
    if (!cleanIds.length) return 0;
    const placeholders = cleanIds.map(() => '?').join(',');
    const [result] = await pool.query(
      `DELETE FROM messages
       WHERE sender_id = ? AND status = 'draft' AND id IN (${placeholders})`,
      [userId, ...cleanIds]
    );
    return result.affectedRows;
  },
  async getUnreadForUser(userId) {
    const [rows] = await pool.query(
      `SELECT id, subject, reference_number, status, sender_id, submitted_at, created_at
       FROM messages
       WHERE receiver_id = ? AND status <> 'draft' AND read_at IS NULL
       ORDER BY id DESC
       LIMIT 20`,
      [userId]
    );
    return rows;
  },
  async countUnreadForUser(userId) {
    const [[{ count }]] = await pool.query(
      "SELECT COUNT(*) as count FROM messages WHERE receiver_id = ? AND status <> 'draft' AND read_at IS NULL",
      [userId]
    );
    return count;
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
    const cleanReference = typeof reference === 'string' ? reference.trim() : '';
    const cleanSubject = typeof subject === 'string' ? subject.trim() : '';
    const matchClauses = [];
    const matchParams = [];

    if (cleanReference) {
      matchClauses.push('reference_number LIKE ?');
      matchParams.push(`%${cleanReference}%`);
    }
    if (cleanSubject) {
      matchClauses.push('subject LIKE ?');
      matchParams.push(`%${cleanSubject}%`);
    }

    const whereMatch = matchClauses.length ? matchClauses.join(' AND ') : '1 = 0';
    let sql = `
      WITH RECURSIVE
      matched_messages AS (
        SELECT *
        FROM messages
        WHERE ${whereMatch}
      ),
      ancestors AS (
        SELECT *
        FROM matched_messages
        UNION ALL
        SELECT parent.*
        FROM messages parent
        JOIN ancestors child ON child.parent_message_id = parent.id
      ),
      root_messages AS (
        SELECT DISTINCT a.*
        FROM ancestors a
        LEFT JOIN messages parent ON parent.id = a.parent_message_id
        WHERE a.parent_message_id IS NULL OR parent.id IS NULL
      ),
      message_chain AS (
        SELECT root_messages.*, 0 AS chain_depth, CAST(LPAD(root_messages.id, 10, '0') AS CHAR(1000)) AS chain_path
        FROM root_messages
        UNION ALL
        SELECT child.*, parent.chain_depth + 1, CONCAT(parent.chain_path, '/', LPAD(child.id, 10, '0'))
        FROM messages child
        JOIN message_chain parent ON child.parent_message_id = parent.id
      )
      SELECT DISTINCT mc.*,
             s.name AS sender_name,
             r.name AS receiver_name,
             parent.reference_number AS parent_reference_number,
             parent.sender_id AS parent_sender_id,
             parent.receiver_id AS parent_receiver_id,
             ps.name AS parent_sender_name,
             pr.name AS parent_receiver_name
      FROM message_chain mc
      LEFT JOIN users s ON s.id = mc.sender_id
      LEFT JOIN users r ON r.id = mc.receiver_id
      LEFT JOIN messages parent ON parent.id = mc.parent_message_id
      LEFT JOIN users ps ON ps.id = parent.sender_id
      LEFT JOIN users pr ON pr.id = parent.receiver_id`;
    const params = [...matchParams];

    if (role !== 'admin') {
      sql += `
        WHERE EXISTS (
          SELECT 1
          FROM message_chain access_chain
          WHERE access_chain.sender_id = ? OR access_chain.receiver_id = ?
        )`;
      params.push(userId, userId);
    }

    sql += ' ORDER BY mc.chain_path ASC';
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
        sender_id, receiver_id, subject, content, reference_number, status, file_path, department_id, parent_message_id, due_date, submitted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
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
