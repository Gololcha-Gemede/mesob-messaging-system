const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');
const { loginRateLimiter } = require('../middleware/security');
const upload = require('../middleware/multer');

router.post('/login', loginRateLimiter, authController.login);
router.post('/register', upload.fields([
	{ name: 'profile_image', maxCount: 1 },
	{ name: 'signature_image', maxCount: 1 }
]), authController.register);
router.get('/me', authenticateToken, authController.me);
router.put('/me', authenticateToken, upload.single('profile_image'), authController.updateMe);

module.exports = router;
