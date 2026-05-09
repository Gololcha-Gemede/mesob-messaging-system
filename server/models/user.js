const pool = require('./db');

module.exports = {
  async findByEmail(email) {
    const [rows] = await pool.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0];
  },
  async create(user) {
    const { name, email, password, role, department_id, profile_image_path = null } = user;
    const [result] = await pool.query(
      'INSERT INTO users (name, email, password, role, department_id, profile_image_path) VALUES (?, ?, ?, ?, ?, ?)',
      [name, email, password, role, department_id, profile_image_path]
    );
    return result.insertId;
  },
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM users');
    return rows;
  },
  async update(id, { name, email, role, department_id, password, profile_image_path }) {
    const fields = ['name = ?', 'email = ?', 'role = ?', 'department_id = ?'];
    const params = [name, email, role, department_id];
    if (password) {
      fields.push('password = ?');
      params.push(password);
    }
    if (profile_image_path !== undefined) {
      fields.push('profile_image_path = ?');
      params.push(profile_image_path);
    }
    params.push(id);
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, params);
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
    let sql = 'SELECT id, name, email, role, department_id, profile_image_path FROM users WHERE id != ?';
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
