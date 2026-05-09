const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.me);
router.put('/me', authenticateToken, upload.single('profile_image'), authController.updateMe);

module.exports = router;
