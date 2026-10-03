const db = require('../config/db');
const quizService = require('../services/quizService');

/**
 * Get all available subjects with topic and question counts directly from MySQL
 */
async function getSubjects(req, res, next) {
    try {
        const [rows] = await db.query(`
            SELECT 
                subject AS name, 
                COUNT(DISTINCT topic) AS topicCount, 
                COUNT(*) AS questionCount
            FROM quiz_questions
            GROUP BY subject
            ORDER BY subject ASC
        `);

        if (rows.length > 0) {
            return res.status(200).json({
                success: true,
                count: rows.length,
                data: rows
            });
        }

        // Fallback to service if table is empty
        const subjects = quizService.getSubjects();
        res.status(200).json({
            success: true,
            count: subjects.length,
            data: subjects
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Get topics for a selected subject directly from MySQL
 */
async function getTopics(req, res, next) {
    try {
        const { subject } = req.query;
        if (!subject) {
            return res.status(400).json({
                success: false,
                message: 'Subject parameter is required.'
            });
        }

        const [rows] = await db.query(`
            SELECT 
                topic AS name, 
                COUNT(*) AS questionCount
            FROM quiz_questions
            WHERE subject = ?
            GROUP BY topic
            ORDER BY topic ASC
        `, [subject]);

        if (rows.length > 0) {
            return res.status(200).json({
                success: true,
                subject,
                count: rows.length,
                data: rows
            });
        }

        // Fallback to service
        const topics = quizService.getTopics(subject);
        res.status(200).json({
            success: true,
            subject,
            count: topics.length,
            data: topics
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Fetch quiz questions with multiple choice options directly from MySQL
 */
async function getQuestions(req, res, next) {
    try {
        const { subject, topic, limit = 10 } = req.query;
        if (!subject || !topic) {
            return res.status(400).json({
                success: false,
                message: 'Both subject and topic parameters are required.'
            });
        }

        const numLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 30);

        const [rows] = await db.query(`
            SELECT 
                id, 
                subject, 
                topic, 
                question_text, 
                option_a, 
                option_b, 
                option_c, 
                option_d, 
                correct_option, 
                explanation
            FROM quiz_questions
            WHERE subject = ? AND topic = ?
            ORDER BY id ASC
            LIMIT ?
        `, [subject, topic, numLimit]);

        let questions = [];

        if (rows.length > 0) {
            questions = rows.map(row => ({
                id: row.id,
                question_text: row.question_text,
                subject: row.subject,
                topic: row.topic,
                options: [
                    { id: 'A', text: row.option_a },
                    { id: 'B', text: row.option_b },
                    { id: 'C', text: row.option_c },
                    { id: 'D', text: row.option_d }
                ],
                correct_option: row.correct_option,
                explanation: row.explanation
            }));
        } else {
            questions = quizService.getQuizQuestions(subject, topic, numLimit);
        }

        res.status(200).json({
            success: true,
            subject,
            topic,
            count: questions.length,
            data: questions
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Submit quiz results and store in MySQL
 */
async function submitQuiz(req, res, next) {
    try {
        const userId = req.session?.user?.id || null;
        const { subject, topic, score, total_questions, time_spent = 0, answers = [] } = req.body;

        if (!subject || !topic) {
            return res.status(400).json({
                success: false,
                message: 'Subject and topic are required.'
            });
        }

        let calculatedScore = parseInt(score, 10);
        let totalCount = parseInt(total_questions, 10);

        if (Array.isArray(answers) && answers.length > 0) {
            totalCount = answers.length;
            calculatedScore = answers.filter(a => a.selected_option && a.selected_option === a.correct_option).length;
        }

        if (isNaN(calculatedScore) || isNaN(totalCount) || totalCount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Valid score and total_questions or answers are required.'
            });
        }

        const percentage = parseFloat(((calculatedScore / totalCount) * 100).toFixed(2));
        const timeSpentSeconds = parseInt(time_spent, 10) || 0;

        const [result] = await db.query(
            `INSERT INTO quiz_attempts (user_id, subject, topic, score, total_questions, percentage, time_spent)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, subject, topic, calculatedScore, totalCount, percentage, timeSpentSeconds]
        );

        res.status(201).json({
            success: true,
            message: 'Quiz attempt saved successfully.',
            data: {
                attemptId: result.insertId,
                subject,
                topic,
                score: calculatedScore,
                total_questions: totalCount,
                percentage,
                time_spent: timeSpentSeconds
            }
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Retrieve user's quiz attempt history
 */
async function getHistory(req, res, next) {
    try {
        const userId = req.session?.user?.id;
        if (!userId) {
            return res.status(200).json({
                success: true,
                message: 'Guest users do not have persistent history.',
                data: []
            });
        }

        const [rows] = await db.query(
            `SELECT id, subject, topic, score, total_questions, percentage, time_spent, created_at
             FROM quiz_attempts
             WHERE user_id = ?
             ORDER BY created_at DESC
             LIMIT 50`,
            [userId]
        );

        res.status(200).json({
            success: true,
            count: rows.length,
            data: rows
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSubjects,
    getTopics,
    getQuestions,
    submitQuiz,
    getHistory
};
