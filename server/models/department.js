const pool = require('./db');

module.exports = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM departments');
    return rows;
  },
  async getById(id) {
    const [rows] = await pool.query('SELECT * FROM departments WHERE id = ?', [id]);
    return rows[0] || null;
  },
  async create(name, code) {
    const [result] = await pool.query('INSERT INTO departments (name, code) VALUES (?, ?)', [name, code || null]);
    return result.insertId;
  },
  async update(id, name, code) {
    await pool.query('UPDATE departments SET name = ?, code = ? WHERE id = ?', [name, code || null, id]);
  },
  async deleteById(id) {
    const [result] = await pool.query('DELETE FROM departments WHERE id = ?', [id]);
    return result.affectedRows;
  },
  async countUsersInDepartment(deptId) {
    const [[{ c }]] = await pool.query('SELECT COUNT(*) as c FROM users WHERE department_id = ?', [deptId]);
    return c;
  },
};
