const db = require('../config/db');

async function getQuestions(req, res, next) {
    try {
        const { role_id, skill_id, difficulty, search, status, bookmarked_only } = req.query;
        const currentUserId = req.session && req.session.user ? req.session.user.id : null;
        const isAdminUser = req.session && req.session.user && req.session.user.role === 'admin';

        let whereClauses = [];
        let params = [];

        // Non-admin users can only view active questions
        if (!isAdminUser) {
            whereClauses.push("q.status = 'active'");
        } else if (status) {
            whereClauses.push("q.status = ?");
            params.push(status);
        }

        if (role_id) {
            whereClauses.push("q.role_id = ?");
            params.push(role_id);
        }

        if (skill_id) {
            whereClauses.push("q.skill_id = ?");
            params.push(skill_id);
        }

        if (difficulty) {
            whereClauses.push("q.difficulty = ?");
            params.push(difficulty);
        }

        if (search && search.trim()) {
            whereClauses.push("(q.question_text LIKE ? OR q.model_answer LIKE ? OR q.expected_keywords LIKE ?)");
            const keywordPattern = `%${search.trim()}%`;
            params.push(keywordPattern, keywordPattern, keywordPattern);
        }

        if (bookmarked_only === 'true' && currentUserId) {
            whereClauses.push("b.id IS NOT NULL");
        }

        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

        // Select questions with role name, skill name, bookmark flag
        let query = `
            SELECT 
                q.id,
                q.role_id,
                r.name AS role_name,
                q.skill_id,
                s.name AS skill_name,
                q.difficulty,
                q.question_text,
                q.model_answer,
                q.expected_keywords,
                q.status,
                q.created_at,
                q.updated_at,
                ${currentUserId ? '(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END)' : '0'} AS is_bookmarked
            FROM questions q
            JOIN interview_roles r ON q.role_id = r.id
            JOIN skills s ON q.skill_id = s.id
            ${currentUserId ? 'LEFT JOIN bookmarks b ON q.id = b.question_id AND b.user_id = ?' : ''}
            ${whereSql}
            ORDER BY q.id DESC
        `;

        const queryParams = currentUserId ? [currentUserId, ...params] : params;
        const [questions] = await db.query(query, queryParams);

        return res.json({
            success: true,
            count: questions.length,
            questions
        });
    } catch (err) {
        next(err);
    }
}

async function getQuestionById(req, res, next) {
    try {
        const { id } = req.params;
        const currentUserId = req.session && req.session.user ? req.session.user.id : null;

        const [rows] = await db.query(
            `SELECT 
                q.id,
                q.role_id,
                r.name AS role_name,
                q.skill_id,
                s.name AS skill_name,
                q.difficulty,
                q.question_text,
                q.model_answer,
                q.expected_keywords,
                q.status,
                q.created_at,
                q.updated_at,
                ${currentUserId ? '(CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END)' : '0'} AS is_bookmarked
            FROM questions q
            JOIN interview_roles r ON q.role_id = r.id
            JOIN skills s ON q.skill_id = s.id
            ${currentUserId ? 'LEFT JOIN bookmarks b ON q.id = b.question_id AND b.user_id = ?' : ''}
            WHERE q.id = ?`,
            currentUserId ? [currentUserId, id] : [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Question not found.' });
        }

        const question = rows[0];

        // Fetch answer points
        const [points] = await db.query(
            'SELECT id, point_text FROM answer_points WHERE question_id = ? ORDER BY id ASC',
            [id]
        );
        question.points = points.map(p => p.point_text);

        return res.json({ success: true, question });
    } catch (err) {
        next(err);
    }
}

async function createQuestion(req, res, next) {
    const conn = await db.getConnection();
    try {
        const { role_id, skill_id, difficulty, question_text, model_answer, expected_keywords, status, points } = req.body;

        if (!role_id || !skill_id || !difficulty || !question_text || !model_answer) {
            return res.status(400).json({
                success: false,
                message: 'Role, Skill, Difficulty, Question Text, and Model Answer are required fields.'
            });
        }

        if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
            return res.status(400).json({
                success: false,
                message: 'Difficulty must be Easy, Medium, or Hard.'
            });
        }

        await conn.beginTransaction();

        const [qRes] = await conn.query(
            `INSERT INTO questions (role_id, skill_id, difficulty, question_text, model_answer, expected_keywords, status)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                role_id,
                skill_id,
                difficulty,
                question_text.trim(),
                model_answer.trim(),
                expected_keywords ? expected_keywords.trim() : '',
                status === 'inactive' ? 'inactive' : 'active'
            ]
        );

        const newQuestionId = qRes.insertId;

        // Insert points if provided
        if (Array.isArray(points)) {
            for (const pt of points) {
                if (pt && typeof pt === 'string' && pt.trim()) {
                    await conn.query(
                        'INSERT INTO answer_points (question_id, point_text) VALUES (?, ?)',
                        [newQuestionId, pt.trim()]
                    );
                }
            }
        }

        await conn.commit();

        return res.status(201).json({
            success: true,
            message: 'Question added successfully.',
            questionId: newQuestionId
        });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
}

async function updateQuestion(req, res, next) {
    const conn = await db.getConnection();
    try {
        const { id } = req.params;
        const { role_id, skill_id, difficulty, question_text, model_answer, expected_keywords, status, points } = req.body;

        if (!role_id || !skill_id || !difficulty || !question_text || !model_answer) {
            return res.status(400).json({
                success: false,
                message: 'Role, Skill, Difficulty, Question Text, and Model Answer are required fields.'
            });
        }

        await conn.beginTransaction();

        const [qRes] = await conn.query(
            `UPDATE questions 
             SET role_id = ?, skill_id = ?, difficulty = ?, question_text = ?, model_answer = ?, expected_keywords = ?, status = ?
             WHERE id = ?`,
            [
                role_id,
                skill_id,
                difficulty,
                question_text.trim(),
                model_answer.trim(),
                expected_keywords ? expected_keywords.trim() : '',
                status === 'inactive' ? 'inactive' : 'active',
                id
            ]
        );

        if (qRes.affectedRows === 0) {
            await conn.rollback();
            return res.status(404).json({ success: false, message: 'Question not found.' });
        }

        // Replace answer points if points array provided
        if (Array.isArray(points)) {
            await conn.query('DELETE FROM answer_points WHERE question_id = ?', [id]);
            for (const pt of points) {
                if (pt && typeof pt === 'string' && pt.trim()) {
                    await conn.query(
                        'INSERT INTO answer_points (question_id, point_text) VALUES (?, ?)',
                        [id, pt.trim()]
                    );
                }
            }
        }

        await conn.commit();

        return res.json({
            success: true,
            message: 'Question updated successfully.'
        });
    } catch (err) {
        await conn.rollback();
        next(err);
    } finally {
        conn.release();
    }
}

async function deleteQuestion(req, res, next) {
    try {
        const { id } = req.params;
        const permanent = req.query.permanent === 'true';

        if (permanent) {
            // Permanently delete question (cascade deletes points, bookmarks, attempts)
            const [result] = await db.query('DELETE FROM questions WHERE id = ?', [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Question not found.' });
            }
            return res.json({ success: true, message: 'Question permanently deleted successfully.' });
        } else {
            // Soft delete by setting status to inactive
            const [result] = await db.query("UPDATE questions SET status = 'inactive' WHERE id = ?", [id]);
            if (result.affectedRows === 0) {
                return res.status(404).json({ success: false, message: 'Question not found.' });
            }
            return res.json({ success: true, message: 'Question marked as inactive successfully.' });
        }
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getQuestions,
    getQuestionById,
    createQuestion,
    updateQuestion,
    deleteQuestion
};
