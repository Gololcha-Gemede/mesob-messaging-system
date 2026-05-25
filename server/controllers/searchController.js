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
    const [[{ received }]] = await pool.query("SELECT COUNT(*) as received FROM messages WHERE receiver_id = ? AND status <> 'draft'", [req.user.id]);
    const [[{ total_messages }]] = await pool.query(
      "SELECT COUNT(*) as total_messages FROM messages WHERE (sender_id = ? OR receiver_id = ?) AND status <> 'draft'",
      [req.user.id, req.user.id]
    );
    const [[{ unread }]] = await pool.query(
      "SELECT COUNT(*) as unread FROM messages WHERE receiver_id = ? AND status <> 'draft' AND read_at IS NULL",
      [req.user.id]
    );
    const [[{ opened }]] = await pool.query(
      "SELECT COUNT(*) as opened FROM messages WHERE receiver_id = ? AND status <> 'draft' AND read_at IS NOT NULL",
      [req.user.id]
    );
    const [[{ this_month }]] = await pool.query(
      `SELECT COUNT(*) as this_month
       FROM messages
       WHERE (sender_id = ? OR receiver_id = ?)
         AND status <> 'draft'
         AND COALESCE(submitted_at, created_at) >= DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      [req.user.id, req.user.id]
    );
    const [[{ last_month }]] = await pool.query(
      `SELECT COUNT(*) as last_month
       FROM messages
       WHERE (sender_id = ? OR receiver_id = ?)
         AND status <> 'draft'
         AND COALESCE(submitted_at, created_at) >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 1 MONTH)
         AND COALESCE(submitted_at, created_at) < DATE_FORMAT(CURDATE(), '%Y-%m-01')`,
      [req.user.id, req.user.id]
    );
    const [[{ needs_action }]] = await pool.query(
      `SELECT COUNT(*) as needs_action FROM messages
       WHERE receiver_id = ? AND read_at IS NULL AND status IN ('submitted', 'received', 'delivered')`,
      [req.user.id]
    );
    const [[{ drafts }]] = await pool.query(
      "SELECT COUNT(*) as drafts FROM messages WHERE sender_id = ? AND status = 'draft'",
      [req.user.id]
    );
    const [[{ active_users }]] = await pool.query('SELECT COUNT(*) as active_users FROM users');
    const [[{ department_activity }]] = await pool.query('SELECT COUNT(*) as department_activity FROM departments');
    const [weekly_stats] = await pool.query(
      `SELECT DATE(COALESCE(submitted_at, created_at)) AS day, COUNT(*) AS count
       FROM messages
       WHERE (sender_id = ? OR receiver_id = ?)
         AND COALESCE(submitted_at, created_at) >= DATE_SUB(CURDATE(), INTERVAL 6 DAY)
       GROUP BY DATE(COALESCE(submitted_at, created_at))
       ORDER BY day ASC`,
      [req.user.id, req.user.id]
    );
    const [monthly_stats] = await pool.query(
      `SELECT DATE_FORMAT(COALESCE(submitted_at, created_at), '%Y-%m') AS month, COUNT(*) AS count
       FROM messages
       WHERE (sender_id = ? OR receiver_id = ?)
         AND status <> 'draft'
         AND COALESCE(submitted_at, created_at) >= DATE_SUB(DATE_FORMAT(CURDATE(), '%Y-%m-01'), INTERVAL 5 MONTH)
       GROUP BY DATE_FORMAT(COALESCE(submitted_at, created_at), '%Y-%m')
       ORDER BY month ASC`,
      [req.user.id, req.user.id]
    );
    const [recent_activity] = await pool.query(
      `SELECT me.id, me.message_id, me.event_type, me.created_at, m.subject, m.reference_number, u.name AS actor_name
       FROM message_events me
       LEFT JOIN messages m ON m.id = me.message_id
       LEFT JOIN users u ON u.id = me.actor_id
       WHERE me.actor_id = ?
       ORDER BY me.id DESC
       LIMIT 8`,
      [req.user.id]
    );

    let pending_tasks = 0;
    try {
      const [[taskCounts]] = await pool.query('SELECT COUNT(*) as pending_tasks FROM tasks WHERE assigned_to = ? AND status = ?', [req.user.id, 'pending']);
      pending_tasks = taskCounts.pending_tasks;
    } catch {
      pending_tasks = 0;
    }

    res.json({
      inbox,
      sent,
      received,
      drafts,
      total_messages,
      unread,
      opened,
      this_month,
      last_month,
      active_users,
      department_activity,
      pending_tasks,
      needs_action,
      weekly_stats,
      monthly_stats,
      recent_activity
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching dashboard counts', error: err.message });
  }
};
