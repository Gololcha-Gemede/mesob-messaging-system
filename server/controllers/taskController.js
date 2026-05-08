const taskModel = require('../models/task');

exports.createTask = async (req, res) => {
  try {
    const { title, assigned_to } = req.body;
    const status = 'pending';
    const taskId = await taskModel.create({ title, assigned_to, status });
    res.status(201).json({ id: taskId });
  } catch (err) {
    res.status(500).json({ message: 'Error creating task', error: err.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    const tasks = await taskModel.getByUser(req.user.id);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Error fetching tasks', error: err.message });
  }
};
