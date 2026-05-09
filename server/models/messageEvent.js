const pool = require('./db');

module.exports = {
  async create({ message_id, event_type, actor_id, note = null, from_status = null, to_status = null }) {
    await pool.query(
      `INSERT INTO message_events (message_id, event_type, actor_id, note, from_status, to_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [message_id, event_type, actor_id, note, from_status, to_status]
    );
  },

  async getByMessageId(messageId) {
    const [rows] = await pool.query(
      `SELECT me.*, u.name AS actor_name
       FROM message_events me
       LEFT JOIN users u ON u.id = me.actor_id
       WHERE me.message_id = ?
       ORDER BY me.id ASC`,
      [messageId]
    );
    return rows;
  },

  async getByMessageChainId(messageId) {
    const [rows] = await pool.query(
      `WITH RECURSIVE
       ancestors AS (
         SELECT *
         FROM messages
         WHERE id = ?
         UNION ALL
         SELECT parent.*
         FROM messages parent
         JOIN ancestors child ON child.parent_message_id = parent.id
       ),
       roots AS (
         SELECT a.*
         FROM ancestors a
         LEFT JOIN messages parent ON parent.id = a.parent_message_id
         WHERE a.parent_message_id IS NULL OR parent.id IS NULL
       ),
       chain AS (
         SELECT r.*, 0 AS chain_depth, CAST(LPAD(r.id, 10, '0') AS CHAR(1000)) AS chain_path
         FROM roots r
         UNION ALL
         SELECT child.*, chain.chain_depth + 1, CONCAT(chain.chain_path, '/', LPAD(child.id, 10, '0'))
         FROM messages child
         JOIN chain ON child.parent_message_id = chain.id
       )
       SELECT me.*, u.name AS actor_name, c.reference_number, c.subject, c.sender_id, c.receiver_id,
              c.parent_message_id, s.name AS sender_name, r.name AS receiver_name, c.chain_depth, c.chain_path
       FROM chain c
       JOIN message_events me ON me.message_id = c.id
       LEFT JOIN users u ON u.id = me.actor_id
       LEFT JOIN users s ON s.id = c.sender_id
       LEFT JOIN users r ON r.id = c.receiver_id
       ORDER BY c.chain_path ASC, me.id ASC`,
      [messageId]
    );
    return rows;
  }
};
