const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user');
require('dotenv').config();

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) return res.status(400).json({ message: 'Invalid credentials' });
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(400).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role, department_id: user.department_id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, department_id: user.department_id } });
};

exports.me = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department_id: user.department_id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error fetching profile', error: err.message });
  }
};

exports.updateMe = async (req, res) => {
  try {
    const user = await userModel.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password.trim() : '';
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const dup = await userModel.countByEmailExceptId(email, req.user.id);
    if (dup > 0) return res.status(400).json({ message: 'Email already in use' });

    const payload = {
      name,
      email,
      role: user.role,
      department_id: user.department_id
    };
    if (password) payload.password = await bcrypt.hash(password, 10);
    await userModel.update(req.user.id, payload);

    res.json({
      id: user.id,
      name,
      email,
      role: user.role,
      department_id: user.department_id
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};
