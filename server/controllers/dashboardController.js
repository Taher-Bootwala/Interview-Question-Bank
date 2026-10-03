const db = require('../config/db');

async function getUserDashboard(req, res, next) {
    try {
        const userId = req.session.user.id;

        // 1. Total attempts (Practice Attempts + Topic Quiz Attempts)
        const [[practiceAttemptsCount]] = await db.query(
            'SELECT COUNT(*) AS total FROM practice_attempts WHERE user_id = ?',
            [userId]
        );
        const [[quizAttemptsCount]] = await db.query(
            'SELECT COUNT(*) AS total FROM quiz_attempts WHERE user_id = ?',
            [userId]
        );
        const totalAttempts = (practiceAttemptsCount?.total || 0) + (quizAttemptsCount?.total || 0);

        // 2. Questions attempted (Practice Questions + Quiz Questions)
        const [[practiceQuestionsCount]] = await db.query(
            `SELECT COUNT(DISTINCT aq.question_id) AS total
             FROM attempt_questions aq
             JOIN practice_attempts pa ON aq.attempt_id = pa.id
             WHERE pa.user_id = ?`,
            [userId]
        );
        const [[quizQuestionsSum]] = await db.query(
            'SELECT COALESCE(SUM(total_questions), 0) AS total FROM quiz_attempts WHERE user_id = ?',
            [userId]
        );
        const questionsAttempted = (practiceQuestionsCount?.total || 0) + Number(quizQuestionsSum?.total || 0);

        // 3. Bookmarked questions count
        const [[bookmarksCount]] = await db.query(
            'SELECT COUNT(*) AS total FROM bookmarks WHERE user_id = ?',
            [userId]
        );

        // 4. Weak topics count (skills where average rating <= 2.5 OR quiz topics with percentage < 60%)
        const [weakPracticeRows] = await db.query(`
            SELECT s.name AS topic_name
            FROM attempt_questions aq
            JOIN practice_attempts pa ON aq.attempt_id = pa.id
            JOIN questions q ON aq.question_id = q.id
            JOIN skills s ON q.skill_id = s.id
            WHERE pa.user_id = ? AND aq.self_rating IS NOT NULL
            GROUP BY s.id, s.name
            HAVING AVG(aq.self_rating) <= 2.5
        `, [userId]);

        const [weakQuizRows] = await db.query(`
            SELECT topic AS topic_name
            FROM quiz_attempts
            WHERE user_id = ?
            GROUP BY topic
            HAVING AVG(percentage) < 60
        `, [userId]);

        const distinctWeakTopics = new Set([
            ...weakPracticeRows.map(r => r.topic_name),
            ...weakQuizRows.map(r => r.topic_name)
        ]);

        // 5. Recent attempts (combined Practice Sessions + Topic Quizzes, sorted chronologically)
        const [recentPractice] = await db.query(`
            SELECT 
                pa.id,
                'Practice' AS attempt_type,
                pa.started_at,
                pa.completed_at,
                pa.total_questions,
                pa.completed_questions,
                pa.total_time,
                pa.status,
                COALESCE(r.name, 'Mixed Practice') AS title,
                ROUND(AVG(aq.self_rating), 1) AS rating,
                NULL AS percentage
            FROM practice_attempts pa
            LEFT JOIN interview_roles r ON pa.role_id = r.id
            LEFT JOIN attempt_questions aq ON pa.id = aq.attempt_id
            WHERE pa.user_id = ?
            GROUP BY pa.id, pa.started_at, pa.completed_at, pa.total_questions, pa.completed_questions, pa.total_time, pa.status, r.name
            ORDER BY pa.id DESC
            LIMIT 5
        `, [userId]);

        const [recentQuizzes] = await db.query(`
            SELECT 
                id,
                'Quiz' AS attempt_type,
                created_at AS started_at,
                created_at AS completed_at,
                total_questions,
                score AS completed_questions,
                time_spent AS total_time,
                'completed' AS status,
                CONCAT(subject, ' - ', topic) AS title,
                NULL AS rating,
                percentage
            FROM quiz_attempts
            WHERE user_id = ?
            ORDER BY id DESC
            LIMIT 5
        `, [userId]);

        const combinedAttempts = [...recentPractice, ...recentQuizzes]
            .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
            .slice(0, 6);

        // 6. Recent bookmarked questions (last 4)
        const [recentBookmarks] = await db.query(`
            SELECT 
                q.id,
                q.question_text,
                q.difficulty,
                r.name AS role_name,
                s.name AS skill_name,
                b.created_at AS bookmarked_at
            FROM bookmarks b
            JOIN questions q ON b.question_id = q.id
            JOIN interview_roles r ON q.role_id = r.id
            JOIN skills s ON q.skill_id = s.id
            WHERE b.user_id = ? AND q.status = 'active'
            ORDER BY b.created_at DESC
            LIMIT 4
        `, [userId]);

        return res.json({
            success: true,
            stats: {
                totalAttempts,
                questionsAttempted,
                bookmarkedQuestions: bookmarksCount.total,
                weakTopicsCount: distinctWeakTopics.size
            },
            recentAttempts: combinedAttempts,
            recentBookmarks
        });
    } catch (err) {
        next(err);
    }
}

async function getAdminDashboard(req, res, next) {
    try {
        // Overall counters
        const [[usersCount]] = await db.query("SELECT COUNT(*) AS total FROM users WHERE role = 'user'");
        const [[practiceAttemptsCount]] = await db.query("SELECT COUNT(*) AS total FROM practice_attempts");
        const [[quizAttemptsCount]] = await db.query("SELECT COUNT(*) AS total FROM quiz_attempts");
        const totalAttempts = (practiceAttemptsCount?.total || 0) + (quizAttemptsCount?.total || 0);

        const [[questionsCount]] = await db.query("SELECT COUNT(*) AS total FROM questions");
        const [[quizQuestionsCount]] = await db.query("SELECT COUNT(*) AS total FROM quiz_questions");
        const totalQuestions = (questionsCount?.total || 0) + (quizQuestionsCount?.total || 0);

        const [[activeQuestionsCount]] = await db.query("SELECT COUNT(*) AS total FROM questions WHERE status = 'active'");
        const [[bookmarksCount]] = await db.query("SELECT COUNT(*) AS total FROM bookmarks");

        // Questions by difficulty
        const [byDifficulty] = await db.query(`
            SELECT difficulty, COUNT(*) AS count 
            FROM questions 
            GROUP BY difficulty
        `);

        // Questions by role
        const [byRole] = await db.query(`
            SELECT r.id, r.name, COUNT(q.id) AS count
            FROM interview_roles r
            LEFT JOIN questions q ON r.id = q.role_id
            GROUP BY r.id, r.name
            ORDER BY count DESC
        `);

        // Questions by skill
        const [bySkill] = await db.query(`
            SELECT s.id, s.name, COUNT(q.id) AS count
            FROM skills s
            LEFT JOIN questions q ON s.id = q.skill_id
            GROUP BY s.id, s.name
            ORDER BY count DESC
        `);

        // Recent practice attempts across all users
        const [recentAttempts] = await db.query(`
            SELECT 
                pa.id,
                pa.started_at,
                pa.completed_at,
                pa.total_questions,
                pa.completed_questions,
                pa.total_time,
                pa.status,
                u.name AS user_name,
                u.email AS user_email,
                r.name AS role_name,
                ROUND(AVG(aq.self_rating), 1) AS average_rating
            FROM practice_attempts pa
            JOIN users u ON pa.user_id = u.id
            LEFT JOIN interview_roles r ON pa.role_id = r.id
            LEFT JOIN attempt_questions aq ON pa.id = aq.attempt_id
            GROUP BY pa.id, pa.started_at, pa.completed_at, pa.total_questions, pa.completed_questions, pa.total_time, pa.status, u.name, u.email, r.name
            ORDER BY pa.id DESC
            LIMIT 8
        `);

        return res.json({
            success: true,
            stats: {
                totalUsers: usersCount.total,
                totalQuestions: totalQuestions,
                activeQuestions: activeQuestionsCount.total + (quizQuestionsCount?.total || 0),
                totalAttempts: totalAttempts,
                totalBookmarks: bookmarksCount.total
            },
            byDifficulty,
            byRole,
            bySkill,
            recentAttempts
        });
    } catch (err) {
        next(err);
    }
}

async function getUsersList(req, res, next) {
    try {
        const query = `
            SELECT 
                u.id,
                u.name,
                u.email,
                u.role,
                u.created_at,
                (
                    (SELECT COUNT(*) FROM practice_attempts WHERE user_id = u.id) + 
                    (SELECT COUNT(*) FROM quiz_attempts WHERE user_id = u.id)
                ) AS total_attempts,
                (SELECT COUNT(*) FROM bookmarks WHERE user_id = u.id) AS total_bookmarks
            FROM users u
            ORDER BY u.created_at DESC
        `;
        const [users] = await db.query(query);
        return res.json({ success: true, count: users.length, users });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getUserDashboard,
    getAdminDashboard,
    getUsersList
};
