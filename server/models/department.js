const pool = require('./db');

module.exports = {
  async getAll() {
    const [rows] = await pool.query('SELECT * FROM departments');
    return rows;
  },
  async create(name) {
    const [result] = await pool.query('INSERT INTO departments (name) VALUES (?)', [name]);
    return result.insertId;
  },
  async update(id, name) {
    await pool.query('UPDATE departments SET name = ? WHERE id = ?', [name, id]);
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
