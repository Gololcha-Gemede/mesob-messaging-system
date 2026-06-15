const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const userModel = require('../models/user');
const { validatePassword } = require('../utils/passwordPolicy');
const { audit } = require('../utils/audit');
const { validateUploadedFile } = require('../utils/uploadSecurity');
require('dotenv').config();

function uploadedFilePath(file) {
  return file?.filename ? `/uploads/${file.filename}` : undefined;
}

exports.login = async (req, res) => {
  const { email, password } = req.body;
  const user = await userModel.findByEmail(email);
  if (!user) {
    audit('login_failed', req, { email: String(email || '').toLowerCase(), reason: 'unknown_user' });
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    audit('login_failed', req, { user_id: user.id, reason: 'bad_password' });
    return res.status(400).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ id: user.id, role: user.role, department_id: user.department_id }, process.env.JWT_SECRET, { expiresIn: '1d' });
  audit('login_success', req, { user_id: user.id });
  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      role: user.role,
      department_id: user.department_id,
      profile_image_path: user.profile_image_path,
      position_title: user.position_title,
      signature_image_path: user.signature_image_path
    }
  });
};

exports.register = async (req, res) => {
  try {
    if (process.env.ALLOW_PUBLIC_REGISTER !== 'true') {
      return res.status(403).json({
        message: 'Public registration is disabled. Contact an administrator to create an account.'
      });
    }
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ message: passwordError });

    const existing = await userModel.findByEmail(email);
    if (existing) return res.status(400).json({ message: 'Email already in use' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const profileImage = req.files?.profile_image?.[0];
    const signatureImage = req.files?.signature_image?.[0];
    const profileUploadError = await validateUploadedFile(profileImage, { allowPdf: false, allowImages: true });
    if (profileUploadError) return res.status(400).json({ message: profileUploadError });
    const signatureUploadError = await validateUploadedFile(signatureImage, { allowPdf: false, allowImages: true });
    if (signatureUploadError) return res.status(400).json({ message: signatureUploadError });

    const userId = await userModel.create({
      name,
      email,
      password: hashedPassword,
      role: 'user',
      department_id: null,
      profile_image_path: uploadedFilePath(profileImage) || null,
      signature_image_path: uploadedFilePath(signatureImage) || null
    });
    audit('user_registered', req, { user_id: userId, email });

    res.status(201).json({
      id: userId,
      message: 'Account created. An administrator can update your access level if needed.'
    });
  } catch (err) {
    res.status(500).json({ message: 'Error creating account', error: err.message });
  }
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
      department_id: user.department_id,
      profile_image_path: user.profile_image_path,
      position_title: user.position_title,
      signature_image_path: user.signature_image_path
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
    const position_title = typeof req.body.position_title === 'string' ? req.body.position_title.trim() : undefined;
    if (!name || !email) {
      return res.status(400).json({ message: 'Name and email are required' });
    }

    const dup = await userModel.countByEmailExceptId(email, req.user.id);
    if (dup > 0) return res.status(400).json({ message: 'Email already in use' });
    const passwordError = validatePassword(password, { required: false });
    if (passwordError) return res.status(400).json({ message: passwordError });
    const uploadError = await validateUploadedFile(req.file, { allowPdf: false, allowImages: true });
    if (uploadError) return res.status(400).json({ message: uploadError });

    const payload = {
      name,
      email,
      role: user.role,
      department_id: user.department_id
    };
    if (password) payload.password = await bcrypt.hash(password, 10);
    if (position_title !== undefined) payload.position_title = position_title;
    const profileImagePath = uploadedProfilePath(req.file);
    if (profileImagePath !== undefined) payload.profile_image_path = profileImagePath;
    await userModel.update(req.user.id, payload);
    audit('profile_updated', req, { user_id: req.user.id });

    res.json({
      id: user.id,
      name,
      email,
      role: user.role,
      department_id: user.department_id,
      profile_image_path: payload.profile_image_path ?? user.profile_image_path,
      position_title: payload.position_title ?? user.position_title,
      signature_image_path: payload.signature_image_path ?? user.signature_image_path
    });
  } catch (err) {
    res.status(500).json({ message: 'Error updating profile', error: err.message });
  }
};
