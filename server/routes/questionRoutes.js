const express = require('express');
const router = express.Router();
const questionController = require('../controllers/questionController');
const { isAdmin } = require('../middleware/auth');

router.get('/', questionController.getQuestions);
router.get('/:id', questionController.getQuestionById);
router.post('/', isAdmin, questionController.createQuestion);
router.put('/:id', isAdmin, questionController.updateQuestion);
router.delete('/:id', isAdmin, questionController.deleteQuestion);

module.exports = router;
