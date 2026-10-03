const express = require('express');
const router = express.Router();
const attemptController = require('../controllers/attemptController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.post('/start', attemptController.startAttempt);
router.post('/:id/save-question', attemptController.saveQuestionAnswer);
router.post('/:id/finish', attemptController.finishAttempt);
router.get('/', attemptController.getAttempts);
router.get('/:id', attemptController.getAttemptById);

module.exports = router;
