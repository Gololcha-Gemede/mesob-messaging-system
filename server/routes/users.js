const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const upload = require('../middleware/multer');

router.post('/', authenticateToken, authorizeRoles('admin'), upload.single('profile_image'), userController.createUser);
router.get('/', authenticateToken, authorizeRoles('admin'), userController.getUsers);
router.get('/recipients', authenticateToken, userController.getRecipients);
router.put('/:id', authenticateToken, authorizeRoles('admin'), userController.updateUser);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), userController.deleteUser);

module.exports = router;
