const pool = require('./db');

module.exports = {
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },
  async create(user) {
    const { name, email, password, role, department_id } = user;
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, department_id) VALUES (?, ?, ?, ?, ?)',
      [name, email, password, role, department_id]
    );
    return result.insertId;
  },
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM users');
    return rows;
  },
  async update(id, { name, email, role, department_id, password }) {
    if (password) {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, role = ?, department_id = ?, password = ? WHERE id = ?',
        [name, email, role, department_id, password, id]
      );
    } else {
      await pool.query(
        'UPDATE users SET name = ?, email = ?, role = ?, department_id = ? WHERE id = ?',
        [name, email, role, department_id, id]
      );
    }
  },
  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM users WHERE id = ?', [id]);
    return result.affectedRows;
  },
  async findById(id) {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0];
  },
  async countByEmailExceptId(email, excludeId) {
    const [[{ c }]] = await pool.query(
      'SELECT COUNT(*) as c FROM users WHERE email = ? AND id != ?',
      [email, excludeId]
    );
    return c;
  },
  async getRecipients({ query, excludeUserId }) {
    let sql = 'SELECT id, name, email, role, department_id FROM users WHERE id != ?';
    const params = [excludeUserId];

    if (query) {
      sql += ' AND (name LIKE ? OR email LIKE ?)';
      const likeQuery = `%${query}%`;
      params.push(likeQuery, likeQuery);
    }

    sql += ' ORDER BY name ASC';
    const [rows] = await pool.query(sql, params);
    return rows;
  },
};
