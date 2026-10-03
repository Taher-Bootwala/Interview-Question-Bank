const db = require('../config/db');

async function getBookmarks(req, res, next) {
    try {
        const userId = req.session.user.id;

        const query = `
            SELECT 
                b.id AS bookmark_id,
                b.created_at AS bookmarked_at,
                q.id,
                q.role_id,
                r.name AS role_name,
                q.skill_id,
                s.name AS skill_name,
                q.difficulty,
                q.question_text,
                q.model_answer,
                q.expected_keywords,
                q.status
            FROM bookmarks b
            JOIN questions q ON b.question_id = q.id
            JOIN interview_roles r ON q.role_id = r.id
            JOIN skills s ON q.skill_id = s.id
            WHERE b.user_id = ? AND q.status = 'active'
            ORDER BY b.created_at DESC
        `;

        const [bookmarks] = await db.query(query, [userId]);
        return res.json({ success: true, count: bookmarks.length, bookmarks });
    } catch (err) {
        next(err);
    }
}

async function getBookmarkedIds(req, res, next) {
    try {
        const userId = req.session.user.id;
        const [rows] = await db.query('SELECT question_id FROM bookmarks WHERE user_id = ?', [userId]);
        const ids = rows.map(r => r.question_id);
        return res.json({ success: true, ids });
    } catch (err) {
        next(err);
    }
}

async function addBookmark(req, res, next) {
    try {
        const userId = req.session.user.id;
        const { question_id } = req.body;

        if (!question_id) {
            return res.status(400).json({ success: false, message: 'Question ID is required.' });
        }

        // Verify question exists
        const [qRows] = await db.query('SELECT id FROM questions WHERE id = ?', [question_id]);
        if (qRows.length === 0) {
            return res.status(404).json({ success: false, message: 'Question not found.' });
        }

        // Insert or ignore if duplicate
        const [result] = await db.query(
            'INSERT IGNORE INTO bookmarks (user_id, question_id) VALUES (?, ?)',
            [userId, question_id]
        );

        if (result.affectedRows === 0) {
            return res.json({ success: true, message: 'Question already bookmarked.', is_bookmarked: true });
        }

        return res.status(201).json({
            success: true,
            message: 'Bookmark added.',
            is_bookmarked: true
        });
    } catch (err) {
        next(err);
    }
}

async function removeBookmark(req, res, next) {
    try {
        const userId = req.session.user.id;
        const { questionId } = req.params;

        const [result] = await db.query(
            'DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?',
            [userId, questionId]
        );

        return res.json({
            success: true,
            message: 'Bookmark removed.',
            is_bookmarked: false
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getBookmarks,
    getBookmarkedIds,
    addBookmark,
    removeBookmark
};
