const express = require('express');
const router = express.Router();
const dmController = require('../controllers/dmController');
const { authenticateToken } = require('../middleware/auth');

router.get('/threads', authenticateToken, dmController.getThreads);
router.get('/:otherUserId/messages', authenticateToken, dmController.getMessages);
router.post('/:otherUserId/send', authenticateToken, dmController.sendMessage);
router.patch('/:otherUserId/seen', authenticateToken, dmController.markSeen);
router.get('/:otherUserId/typing', authenticateToken, dmController.getTyping);
router.post('/:otherUserId/typing', authenticateToken, dmController.setTyping);

module.exports = router;

