const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/weak-topics', analyticsController.getWeakTopics);
router.get('/personalised', analyticsController.getPersonalisedPractice);

module.exports = router;
