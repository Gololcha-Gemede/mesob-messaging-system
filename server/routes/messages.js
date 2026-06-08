
const express = require('express');
const router = express.Router();
const messageController = require('../controllers/messageController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.post('/', authenticateToken, upload.single('file'), messageController.sendMessage);
router.post('/preview', authenticateToken, messageController.previewMessage);
router.get('/inbox', authenticateToken, messageController.getInbox);
router.get('/sent', authenticateToken, messageController.getSent);
router.get('/drafts', authenticateToken, messageController.getDrafts);
router.delete('/drafts', authenticateToken, messageController.deleteDrafts);
router.get('/notifications', authenticateToken, messageController.getUnreadNotifications);
router.get('/admin/all', authenticateToken, authorizeRoles('manager'), messageController.getAllMessagesManager);
router.get('/track', authenticateToken, messageController.trackMessage);

router.get('/:id', authenticateToken, messageController.getMessageById);
router.get('/:id/history', authenticateToken, messageController.getMessageHistory);

router.delete('/:id/draft', authenticateToken, messageController.deleteDrafts);
router.patch('/:id/read', authenticateToken, messageController.markAsRead);
router.post('/:id/submit', authenticateToken, messageController.submitDraft);
router.post('/:id/forward', authenticateToken, messageController.forwardMessage);
router.get('/:id/attachment', authenticateToken, messageController.downloadAttachment);
router.get('/:id/pdf', authenticateToken, messageController.downloadPdf);
router.post('/:id/print', authenticateToken, messageController.markPrinted);

// TODO: Add forwarding, search, filter, download endpoints

module.exports = router;
