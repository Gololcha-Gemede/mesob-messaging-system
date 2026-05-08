const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { authenticateToken } = require('../middleware/auth');

router.get('/messages', authenticateToken, searchController.searchMessages);
router.get('/dashboard', authenticateToken, searchController.getDashboardCounts);

module.exports = router;
