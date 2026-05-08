const express = require('express');
const router = express.Router();
const departmentController = require('../controllers/departmentController');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');

router.post('/', authenticateToken, authorizeRoles('admin'), departmentController.createDepartment);
router.get('/', authenticateToken, departmentController.getDepartments);
router.put('/:id', authenticateToken, authorizeRoles('admin'), departmentController.updateDepartment);
router.delete('/:id', authenticateToken, authorizeRoles('admin'), departmentController.deleteDepartment);

module.exports = router;
