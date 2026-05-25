const pool = require('./db');
const DM_ONLY_M = "m.template_type = 'direct_message'";

module.exports = {
  DM_ONLY_M,
  async create(message) {
    const {
      sender_id,
      receiver_id,
      sender_name = null,
      subject,
      content,
      raw_content = content || '',
      formatted_content = '',
      template_type = 'official_letter',
      reference_number,
      status,
      file_path,
      file_name = null,
      file_mime = null,
      file_size = null,
      pdf_path = null,
      department_id,
      due_date = null
    } = message;
    const [result] = await pool.query(
      `INSERT INTO messages (
        sender_id, receiver_id, sender_name, subject, content, raw_content, formatted_content, template_type,
        reference_number, status, file_path, file_name, file_mime, file_size, pdf_path,
        department_id, due_date, submitted_at, delivered_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [
        sender_id,
        receiver_id,
        sender_name,
        subject,
        raw_content,
        raw_content,
        formatted_content,
        template_type,
        reference_number,
        status,
        file_path,
        file_name,
        file_mime,
        file_size,
        pdf_path,
        department_id,
        due_date,
        status !== 'draft' ? new Date() : null,
        status !== 'draft' ? new Date() : null
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
    const status = typeof filters.status === 'string' ? filters.status.trim() : '';
    if (status === 'read') {
      sql += ' AND read_at IS NOT NULL';
    } else if (status === 'unread') {
      sql += ' AND read_at IS NULL';
    } else if (status) {
      sql += ' AND status = ?';
      params.push(status);
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
      `SELECT COUNT(*) as count FROM messages
       WHERE receiver_id = ? AND status <> 'draft' AND read_at IS NULL`,
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
        SELECT root_messages.*, root_messages.id AS root_id, 0 AS chain_depth, CAST(LPAD(root_messages.id, 10, '0') AS CHAR(1000)) AS chain_path
        FROM root_messages
        UNION ALL
        SELECT child.*, parent.root_id, parent.chain_depth + 1, CONCAT(parent.chain_path, '/', LPAD(child.id, 10, '0'))
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
             pr.name AS parent_receiver_name,
             (
               SELECT fe.created_at
               FROM message_events fe
               WHERE fe.message_id = mc.id AND fe.event_type = 'forwarded'
               ORDER BY fe.id ASC
               LIMIT 1
             ) AS forwarded_at,
             (
               SELECT fe.actor_id
               FROM message_events fe
               WHERE fe.message_id = mc.id AND fe.event_type = 'forwarded'
               ORDER BY fe.id ASC
               LIMIT 1
             ) AS forwarded_by_id,
             (
               SELECT fu.name
               FROM message_events fe
               LEFT JOIN users fu ON fu.id = fe.actor_id
               WHERE fe.message_id = mc.id AND fe.event_type = 'forwarded'
               ORDER BY fe.id ASC
               LIMIT 1
             ) AS forwarded_by_name,
             (
               SELECT fe.note
               FROM message_events fe
               WHERE fe.message_id = mc.id AND fe.event_type = 'forwarded'
               ORDER BY fe.id ASC
               LIMIT 1
             ) AS forward_note
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
          WHERE access_chain.root_id = mc.root_id
            AND (access_chain.sender_id = ? OR access_chain.receiver_id = ?)
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
       SET read_at = COALESCE(read_at, NOW()),
           opened_at = COALESCE(opened_at, NOW()),
           status = CASE WHEN status IN ('submitted', 'sent', 'delivered', 'received') THEN 'opened' ELSE status END
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
        sender_id, receiver_id, subject, content, raw_content, formatted_content, template_type,
        reference_number, status, file_path, file_name, file_mime, file_size, pdf_path,
        department_id, parent_message_id, due_date, submitted_at, delivered_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW(), NOW())`,
      [
        actor_id,
        new_receiver_id,
        msg.subject,
        msg.raw_content || msg.content || '',
        msg.raw_content || msg.content || '',
        msg.formatted_content || '',
        msg.template_type || 'official_letter',
        reference_number,
        'delivered',
        msg.file_path,
        msg.file_name,
        msg.file_mime,
        msg.file_size,
        msg.pdf_path,
        msg.department_id,
        msg.id,
        due_date
      ]
    );
    return result.insertId;
  },
  async submit(id, senderId, updates = {}) {
    const [result] = await pool.query(
      `UPDATE messages
       SET status = 'delivered',
           submitted_at = NOW(),
           delivered_at = NOW(),
           formatted_content = COALESCE(?, formatted_content),
           pdf_path = COALESCE(?, pdf_path)
       WHERE id = ? AND sender_id = ? AND status = 'draft'`,
      [updates.formatted_content || null, updates.pdf_path || null, id, senderId]
    );
    return result.affectedRows;
  },
  async updateGeneratedFields(id, { formatted_content, pdf_path }) {
    const fields = [];
    const params = [];
    if (formatted_content !== undefined) {
      fields.push('formatted_content = ?');
      params.push(formatted_content);
    }
    if (pdf_path !== undefined) {
      fields.push('pdf_path = ?');
      params.push(pdf_path);
    }
    if (!fields.length) return 0;
    params.push(id);
    const [result] = await pool.query(`UPDATE messages SET ${fields.join(', ')} WHERE id = ?`, params);
    return result.affectedRows;
  },
  async markPrinted(id, userId) {
    const [result] = await pool.query(
      `UPDATE messages
       SET printed_at = COALESCE(printed_at, NOW())
       WHERE id = ? AND (sender_id = ? OR receiver_id = ?)`,
      [id, userId, userId]
    );
    return result.affectedRows;
  },
  async markPdfDownloaded(id, userId) {
    const [result] = await pool.query(
      `UPDATE messages
       SET downloaded_at = COALESCE(downloaded_at, NOW())
       WHERE id = ? AND (sender_id = ? OR receiver_id = ?)`,
      [id, userId, userId]
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
  async incrementViewCount(messageId) {
    const [result] = await pool.query(
      `UPDATE messages SET view_count = view_count + 1 WHERE id = ?`,
      [messageId]
    );
    return result.affectedRows > 0;
  },
};
