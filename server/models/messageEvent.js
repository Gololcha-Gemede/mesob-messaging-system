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
  }
};
