const pool = require('../models/db');

exports.searchMessages = async (req, res) => {
  try {
    const { q, type } = req.query;
    let sql = 'SELECT * FROM messages WHERE ';
    let params = [];
    if (type === 'sent') {
      sql += 'sender_id = ? AND ';
      params.push(req.user.id);
    } else {
      sql += "receiver_id = ? AND status <> 'draft' AND ";
      params.push(req.user.id);
    }
    sql += '(subject LIKE ? OR reference_number LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: 'Error searching messages', error: err.message });
  }
};

exports.getDashboardCounts = async (req, res) => {
  try {
    const [[{ inbox }]] = await pool.query("SELECT COUNT(*) as inbox FROM messages WHERE receiver_id = ? AND status <> 'draft'", [req.user.id]);
    const [[{ sent }]] = await pool.query("SELECT COUNT(*) as sent FROM messages WHERE sender_id = ? AND status <> 'draft'", [req.user.id]);
    const [[{ pending_tasks }]] = await pool.query('SELECT COUNT(*) as pending_tasks FROM tasks WHERE assigned_to = ? AND status = ?', [req.user.id, 'pending']);
    const [[{ needs_action }]] = await pool.query(
      "SELECT COUNT(*) as needs_action FROM messages WHERE receiver_id = ? AND status IN ('submitted', 'received', 'in_review')",
      [req.user.id]
    );
    const [[{ drafts }]] = await pool.query(
      "SELECT COUNT(*) as drafts FROM messages WHERE sender_id = ? AND status = 'draft'",
      [req.user.id]
    );
    res.json({ inbox, sent, pending_tasks, needs_action, drafts });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching dashboard counts', error: err.message });
  }
};
