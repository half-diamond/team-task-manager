const express = require('express');
const { body } = require('express-validator');
const { protect } = require('../middleware/authMiddleware');
const {
  listProjects,
  createProject,
  getProject,
  addMember,
  removeMember
} = require('../controllers/projectController');

const router = express.Router();

router.use(protect);

router.get('/', listProjects);
router.post(
  '/',
  [body('name').trim().notEmpty().withMessage('Project name is required')],
  createProject
);
router.get('/:id', getProject);
router.post('/:id/members', addMember);
router.delete('/:id/members/:userId', removeMember);

module.exports = router;
