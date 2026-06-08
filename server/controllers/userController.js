const bcrypt = require('bcryptjs');
const userModel = require('../models/user');
const { audit } = require('../utils/audit');
const { validatePassword } = require('../utils/passwordPolicy');
const { validateUploadedFile } = require('../utils/uploadSecurity');

function uploadedProfilePath(file) {
  return file?.filename ? `/uploads/${file.filename}` : null;
}

function normalizeRole(role) {
  if (role === 'admin') return 'admin';
  if (role === 'manager') return 'manager';
  return 'user';
}

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role, department_id } = req.body;
    if (!name || !email || !password || !department_id) {
      return res.status(400).json({ message: 'Name, email, password, and department are required' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });
    const uploadError = await validateUploadedFile(req.file, { allowPdf: false, allowImages: true });
    if (uploadError) return res.status(400).json({ message: uploadError });
    const existing = await userModel.findByEmail(email);
    if (existing) return res.status(400).json({ message: 'Email already in use' });
    const normalizedRole = normalizeRole(role);
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = await userModel.create({
      name,
      email,
      password: hashedPassword,
      role: normalizedRole,
      department_id,
      profile_image_path: uploadedProfilePath(req.file)
    });
    audit('admin_created_user', req, { user_id: userId, role: normalizedRole });
    res.status(201).json({ id: userId });
  } catch (err) {
    if (err.code === 'WARN_DATA_TRUNCATED' || err.code === 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD') {
      return res.status(500).json({ message: 'Database role column is not ready for manager users. Restart the server so schema initialization can update the users role column.' });
    }
    res.status(500).json({ message: 'Error creating user', error: err.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await userModel.getAll();
    res.json(users.map(({ password: _p, ...u }) => u));
  } catch (err) {
    res.status(500).json({ message: 'Error fetching users', error: err.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid user id' });
    const { name, email, password, role, department_id } = req.body;
    if (!name || !email || !role || department_id === undefined || department_id === '') {
      return res.status(400).json({ message: 'Name, email, role, and department are required' });
    }
    const existing = await userModel.findById(id);
    if (!existing) return res.status(404).json({ message: 'User not found' });
    const dup = await userModel.countByEmailExceptId(email, id);
    if (dup > 0) return res.status(400).json({ message: 'Email already in use' });
    const normalizedRole = normalizeRole(role);
    const payload = { name, email, role: normalizedRole, department_id };
    if (password && String(password).trim()) {
      const cleanPassword = String(password).trim();
      const passwordError = validatePassword(cleanPassword, { required: false });
      if (passwordError) return res.status(400).json({ message: passwordError });
      payload.password = await bcrypt.hash(cleanPassword, 10);
    }
    await userModel.update(id, payload);
    audit('admin_updated_user', req, { user_id: id, role: normalizedRole });
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid user id' });
    if (Number(req.user.id) === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const existing = await userModel.findById(id);
    if (!existing) return res.status(404).json({ message: 'User not found' });
    const affected = await userModel.deleteById(id);
    if (!affected) return res.status(404).json({ message: 'User not found' });
    audit('admin_deleted_user', req, { user_id: id });
    res.json({ message: 'User deleted' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({ message: 'Cannot delete user: related messages or records exist' });
    }
    res.status(500).json({ message: 'Error deleting user', error: err.message });
  }
};

exports.getRecipients = async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const recipients = await userModel.getRecipients({
      query: q,
      excludeUserId: req.user.id
    });
    res.json(recipients);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching recipients', error: err.message });
  }
};
