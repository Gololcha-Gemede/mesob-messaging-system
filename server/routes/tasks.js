const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { authenticateToken } = require('../middleware/auth');

router.post('/', authenticateToken, taskController.createTask);
router.get('/', authenticateToken, taskController.getTasks);

module.exports = router;
