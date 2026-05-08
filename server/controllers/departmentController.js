const departmentModel = require('../models/department');

exports.createDepartment = async (req, res) => {
  try {
    const { name } = req.body;
    const deptId = await departmentModel.create(name);
    res.status(201).json({ id: deptId });
  } catch (err) {
    res.status(500).json({ message: 'Error creating department', error: err.message });
  }
};

exports.getDepartments = async (req, res) => {
  try {
    const departments = await departmentModel.getAll();
    res.json(departments);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching departments', error: err.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid department id' });
    const { name } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Name is required' });
    }
    const depts = await departmentModel.getAll();
    if (!depts.some((d) => d.id === id)) {
      return res.status(404).json({ message: 'Department not found' });
    }
    await departmentModel.update(id, String(name).trim());
    res.json({ message: 'Department updated' });
  } catch (err) {
    res.status(500).json({ message: 'Error updating department', error: err.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: 'Invalid department id' });
    const depts = await departmentModel.getAll();
    if (!depts.some((d) => d.id === id)) {
      return res.status(404).json({ message: 'Department not found' });
    }
    const userCount = await departmentModel.countUsersInDepartment(id);
    if (userCount > 0) {
      return res.status(400).json({
        message: `Cannot delete: ${userCount} user(s) are assigned to this department. Reassign them first.`
      });
    }
    const affected = await departmentModel.deleteById(id);
    if (!affected) return res.status(404).json({ message: 'Department not found' });
    res.json({ message: 'Department deleted' });
  } catch (err) {
    if (err.code === 'ER_ROW_IS_REFERENCED_2' || err.errno === 1451) {
      return res.status(400).json({ message: 'Cannot delete department: related records exist' });
    }
    res.status(500).json({ message: 'Error deleting department', error: err.message });
  }
};
