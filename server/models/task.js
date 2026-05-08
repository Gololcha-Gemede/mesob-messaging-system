const pool = require('./db');

module.exports = {
  async create(task) {
    const { title, assigned_to, status } = task;
    const [result] = await pool.query(
      'INSERT INTO tasks (title, assigned_to, status) VALUES (?, ?, ?)',
      [title, assigned_to, status]
    );
    return result.insertId;
  },
  async getByUser(userId) {
    const [rows] = await pool.query('SELECT * FROM tasks WHERE assigned_to = ?', [userId]);
    return rows;
  },
  // ...other task model methods
};
