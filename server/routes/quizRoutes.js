const express = require('express');
const router = express.Router();
const quizController = require('../controllers/quizController');

// Publicly accessible quiz endpoints (guest practice permitted, authenticated users get history tracking)
router.get('/subjects', quizController.getSubjects);
router.get('/topics', quizController.getTopics);
router.get('/questions', quizController.getQuestions);
router.post('/submit', quizController.submitQuiz);
router.get('/history', quizController.getHistory);

module.exports = router;
