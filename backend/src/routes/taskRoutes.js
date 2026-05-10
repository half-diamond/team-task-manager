const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const {
  listTasks,
  createTask,
  updateTask,
  assignTask,
  deleteTask
} = require('../controllers/taskController');

const router = express.Router();

router.use(protect);

router.get('/project/:projectId', listTasks);
router.post(
  '/project/:projectId',
  [
    body('title').trim().notEmpty().withMessage('Task title is required'),
    body('dueDate').optional({ checkFalsy: true }).isISO8601().withMessage('Valid due date is required'),
    body('priority').optional().isIn(['Low', 'Medium', 'High']).withMessage('Invalid priority')
  ],
  createTask
);
router.patch('/:taskId', updateTask);
router.patch('/:taskId/assign', assignTask);
router.delete('/:taskId', deleteTask);

module.exports = router;
