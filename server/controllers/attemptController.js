const db = require('../config/db');

async function startAttempt(req, res, next) {
    try {
        const userId = req.session.user.id;
        const { role_id, skill_id, difficulty, mode, question_ids, limit = 5 } = req.body;

        let selectedQuestions = [];

        if (Array.isArray(question_ids) && question_ids.length > 0) {
            // Specific question IDs provided (e.g., from bookmark practice or single question practice)
            const placeholders = question_ids.map(() => '?').join(',');
            const [rows] = await db.query(
                `SELECT q.id, q.role_id, r.name AS role_name, q.skill_id, s.name AS skill_name, 
                        q.difficulty, q.question_text, q.model_answer, q.expected_keywords
                 FROM questions q
                 JOIN interview_roles r ON q.role_id = r.id
                 JOIN skills s ON q.skill_id = s.id
                 WHERE q.id IN (${placeholders}) AND q.status = 'active'`,
                question_ids
            );
            selectedQuestions = rows;
        } else if (mode === 'bookmarks') {
            const [rows] = await db.query(
                `SELECT q.id, q.role_id, r.name AS role_name, q.skill_id, s.name AS skill_name, 
                        q.difficulty, q.question_text, q.model_answer, q.expected_keywords
                 FROM bookmarks b
                 JOIN questions q ON b.question_id = q.id
                 JOIN interview_roles r ON q.role_id = r.id
                 JOIN skills s ON q.skill_id = s.id
                 WHERE b.user_id = ? AND q.status = 'active'
                 ORDER BY RAND()
                 LIMIT ?`,
                [userId, Number(limit) || 10]
            );
            selectedQuestions = rows;
        } else {
            // General or filtered practice
            let where = ["q.status = 'active'"];
            let params = [];

            if (role_id) {
                where.push("q.role_id = ?");
                params.push(role_id);
            }
            if (skill_id) {
                where.push("q.skill_id = ?");
                params.push(skill_id);
            }
            if (difficulty) {
                where.push("q.difficulty = ?");
                params.push(difficulty);
            }

            const whereSql = where.join(' AND ');
            params.push(Number(limit) || 5);

            const [rows] = await db.query(
                `SELECT q.id, q.role_id, r.name AS role_name, q.skill_id, s.name AS skill_name, 
                        q.difficulty, q.question_text, q.model_answer, q.expected_keywords
                 FROM questions q
                 JOIN interview_roles r ON q.role_id = r.id
                 JOIN skills s ON q.skill_id = s.id
                 WHERE ${whereSql}
                 ORDER BY RAND()
                 LIMIT ?`,
                params
            );
            selectedQuestions = rows;
        }

        if (selectedQuestions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No practice questions found matching your criteria. Try adjusting your filters.'
            });
        }

        // Fetch answer points for each selected question
        for (const q of selectedQuestions) {
            const [pts] = await db.query(
                'SELECT point_text FROM answer_points WHERE question_id = ? ORDER BY id ASC',
                [q.id]
            );
            q.points = pts.map(p => p.point_text);
        }

        // Create practice attempt record
        const parsedRoleId = role_id ? Number(role_id) : (selectedQuestions[0].role_id || null);
        const [attemptRes] = await db.query(
            `INSERT INTO practice_attempts (user_id, role_id, total_questions, completed_questions, total_time, status)
             VALUES (?, ?, ?, 0, 0, 'in_progress')`,
            [userId, parsedRoleId, selectedQuestions.length]
        );

        const attemptId = attemptRes.insertId;

        // Default time limit: 3 minutes per question (e.g. 5 questions = 15 minutes = 900 seconds)
        const timeLimitSeconds = (req.body.time_limit_minutes ? Number(req.body.time_limit_minutes) : selectedQuestions.length * 3) * 60;

        return res.status(201).json({
            success: true,
            message: 'Practice session started.',
            attemptId,
            totalQuestions: selectedQuestions.length,
            timeLimitSeconds,
            questions: selectedQuestions
        });
    } catch (err) {
        next(err);
    }
}

async function saveQuestionAnswer(req, res, next) {
    try {
        const userId = req.session.user.id;
        const attemptId = req.params.id;
        const { question_id, user_answer, self_rating, evaluation_data } = req.body;

        if (!question_id) {
            return res.status(400).json({ success: false, message: 'Question ID is required.' });
        }

        // Validate attempt ownership
        const [attemptRows] = await db.query(
            'SELECT id, status FROM practice_attempts WHERE id = ? AND user_id = ?',
            [attemptId, userId]
        );

        if (attemptRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Practice attempt not found or unauthorized.' });
        }

        const serializedEval = typeof evaluation_data === 'object' ? JSON.stringify(evaluation_data) : evaluation_data;

        // Upsert into attempt_questions
        const [existing] = await db.query(
            'SELECT id FROM attempt_questions WHERE attempt_id = ? AND question_id = ?',
            [attemptId, question_id]
        );

        if (existing.length > 0) {
            await db.query(
                `UPDATE attempt_questions 
                 SET user_answer = ?, self_rating = ?, evaluation_data = ?, answered_at = NOW()
                 WHERE id = ?`,
                [user_answer, self_rating || null, serializedEval, existing[0].id]
            );
        } else {
            await db.query(
                `INSERT INTO attempt_questions (attempt_id, question_id, user_answer, self_rating, evaluation_data)
                 VALUES (?, ?, ?, ?, ?)`,
                [attemptId, question_id, user_answer, self_rating || null, serializedEval]
            );
        }

        // Update completed count in practice_attempts
        const [[countRow]] = await db.query(
            'SELECT COUNT(*) AS count FROM attempt_questions WHERE attempt_id = ? AND (user_answer IS NOT NULL OR self_rating IS NOT NULL)',
            [attemptId]
        );

        await db.query(
            'UPDATE practice_attempts SET completed_questions = ? WHERE id = ?',
            [countRow.count, attemptId]
        );

        return res.json({
            success: true,
            message: 'Question saved successfully.',
            completedQuestions: countRow.count
        });
    } catch (err) {
        next(err);
    }
}

async function finishAttempt(req, res, next) {
    try {
        const userId = req.session.user.id;
        const attemptId = req.params.id;
        const { total_time = 0, status = 'completed' } = req.body;

        const [attemptRows] = await db.query(
            'SELECT id, total_questions, status FROM practice_attempts WHERE id = ? AND user_id = ?',
            [attemptId, userId]
        );

        if (attemptRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Practice attempt not found or unauthorized.' });
        }

        // Count completed answers
        const [[answeredRow]] = await db.query(
            'SELECT COUNT(*) AS answered_count, AVG(self_rating) AS avg_rating FROM attempt_questions WHERE attempt_id = ?',
            [attemptId]
        );

        await db.query(
            `UPDATE practice_attempts 
             SET completed_at = NOW(), total_time = ?, completed_questions = ?, status = ?
             WHERE id = ?`,
            [Number(total_time), answeredRow.answered_count, status, attemptId]
        );

        return res.json({
            success: true,
            message: 'Practice attempt finished successfully.',
            summary: {
                attemptId,
                totalQuestions: attemptRows[0].total_questions,
                completedQuestions: answeredRow.answered_count,
                totalTime: Number(total_time),
                averageRating: answeredRow.avg_rating ? Number(Number(answeredRow.avg_rating).toFixed(1)) : null,
                status
            }
        });
    } catch (err) {
        next(err);
    }
}

async function getAttempts(req, res, next) {
    try {
        const userId = req.session.user.id;
        const isAdminUser = req.session.user.role === 'admin';
        const viewAll = isAdminUser && req.query.all === 'true';

        let query = `
            SELECT 
                pa.id,
                pa.user_id,
                u.name AS user_name,
                u.email AS user_email,
                pa.role_id,
                r.name AS role_name,
                pa.started_at,
                pa.completed_at,
                pa.total_questions,
                pa.completed_questions,
                pa.total_time,
                pa.status,
                (SELECT ROUND(AVG(aq.self_rating), 1) FROM attempt_questions aq WHERE aq.attempt_id = pa.id) AS average_rating
            FROM practice_attempts pa
            JOIN users u ON pa.user_id = u.id
            LEFT JOIN interview_roles r ON pa.role_id = r.id
        `;

        let params = [];
        if (!viewAll) {
            query += ' WHERE pa.user_id = ?';
            params.push(userId);
        }

        query += ' ORDER BY pa.id DESC';

        const [attempts] = await db.query(query, params);

        // Fetch quiz attempts as well
        let quizQuery = `
            SELECT 
                qa.id,
                qa.user_id,
                u.name AS user_name,
                u.email AS user_email,
                qa.subject,
                qa.topic,
                qa.score,
                qa.total_questions,
                qa.percentage,
                qa.time_spent,
                qa.created_at
            FROM quiz_attempts qa
            LEFT JOIN users u ON qa.user_id = u.id
        `;
        let quizParams = [];
        if (!viewAll) {
            quizQuery += ' WHERE qa.user_id = ?';
            quizParams.push(userId);
        }
        quizQuery += ' ORDER BY qa.id DESC';

        const [quizAttempts] = await db.query(quizQuery, quizParams);

        return res.json({
            success: true,
            count: attempts.length + quizAttempts.length,
            attempts,
            quizAttempts
        });
    } catch (err) {
        next(err);
    }
}

async function getAttemptById(req, res, next) {
    try {
        const userId = req.session.user.id;
        const isAdminUser = req.session.user.role === 'admin';
        const attemptId = req.params.id;

        const [attemptRows] = await db.query(
            `SELECT 
                pa.id,
                pa.user_id,
                u.name AS user_name,
                u.email AS user_email,
                pa.role_id,
                r.name AS role_name,
                pa.started_at,
                pa.completed_at,
                pa.total_questions,
                pa.completed_questions,
                pa.total_time,
                pa.status
            FROM practice_attempts pa
            JOIN users u ON pa.user_id = u.id
            LEFT JOIN interview_roles r ON pa.role_id = r.id
            WHERE pa.id = ?`,
            [attemptId]
        );

        if (attemptRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Attempt not found.' });
        }

        const attempt = attemptRows[0];

        // Ensure user owns attempt or is admin
        if (!isAdminUser && attempt.user_id !== userId) {
            return res.status(403).json({ success: false, message: 'Unauthorized access to this attempt.' });
        }

        // Get questions and answers for this attempt
        const [questions] = await db.query(
            `SELECT 
                aq.id AS attempt_question_id,
                aq.question_id,
                aq.user_answer,
                aq.self_rating,
                aq.evaluation_data,
                aq.answered_at,
                q.question_text,
                q.model_answer,
                q.expected_keywords,
                q.difficulty,
                r.name AS role_name,
                s.name AS skill_name
            FROM attempt_questions aq
            JOIN questions q ON aq.question_id = q.id
            JOIN interview_roles r ON q.role_id = r.id
            JOIN skills s ON q.skill_id = s.id
            WHERE aq.attempt_id = ?
            ORDER BY aq.id ASC`,
            [attemptId]
        );

        // Fetch answer points for each question
        for (const q of questions) {
            const [pts] = await db.query(
                'SELECT point_text FROM answer_points WHERE question_id = ? ORDER BY id ASC',
                [q.question_id]
            );
            q.points = pts.map(p => p.point_text);

            if (q.evaluation_data) {
                try {
                    q.evaluation_data = JSON.parse(q.evaluation_data);
                } catch {
                    // Keep as string if parsing fails
                }
            }
        }

        attempt.questions = questions;

        return res.json({ success: true, attempt });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    startAttempt,
    saveQuestionAnswer,
    finishAttempt,
    getAttempts,
    getAttemptById
};
