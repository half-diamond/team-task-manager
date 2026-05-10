const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { projectOverview } = require('../controllers/dashboardController');

const router = express.Router();

router.use(protect);
router.get('/project/:projectId', projectOverview);

module.exports = router;
