const db = require('../config/db');

/**
 * Weak Topic Analysis Controller
 * Calculates topic mastery based on attempt history and user self-ratings (1 to 4).
 * Pure SQL queries and straightforward logic; no AI or ML.
 */
async function getWeakTopics(req, res, next) {
    try {
        const userId = req.session.user.id;

        // Query performance per skill for the current user
        const query = `
            SELECT 
                s.id AS skill_id,
                s.name AS skill_name,
                COUNT(DISTINCT pa.id) AS attempts_count,
                COUNT(aq.id) AS questions_attempted,
                ROUND(AVG(aq.self_rating), 1) AS average_rating,
                SUM(CASE WHEN aq.self_rating <= 2 THEN 1 ELSE 0 END) AS low_rated_count,
                (SELECT COUNT(*) FROM questions q2 WHERE q2.skill_id = s.id AND q2.status = 'active') AS total_available_questions
            FROM attempt_questions aq
            JOIN practice_attempts pa ON aq.attempt_id = pa.id
            JOIN questions q ON aq.question_id = q.id
            JOIN skills s ON q.skill_id = s.id
            WHERE pa.user_id = ? AND aq.self_rating IS NOT NULL
            GROUP BY s.id, s.name
            ORDER BY average_rating ASC, questions_attempted DESC
        `;

        const [skillsData] = await db.query(query, [userId]);

        // Query performance per topic from quiz_attempts
        const quizQuery = `
            SELECT 
                qa.topic AS skill_name,
                COUNT(qa.id) AS attempts_count,
                CAST(COALESCE(SUM(qa.total_questions), 0) AS UNSIGNED) AS questions_attempted,
                ROUND((AVG(qa.percentage) / 100) * 4, 1) AS average_rating,
                CAST(SUM(CASE WHEN qa.percentage < 60 THEN 1 ELSE 0 END) AS UNSIGNED) AS low_rated_count,
                COALESCE((SELECT COUNT(*) FROM quiz_questions qq WHERE qq.topic = qa.topic), 20) AS total_available_questions,
                'quiz' AS source_type,
                qa.subject
            FROM quiz_attempts qa
            WHERE qa.user_id = ?
            GROUP BY qa.topic, qa.subject
            ORDER BY average_rating ASC
        `;
        const [quizData] = await db.query(quizQuery, [userId]);

        // Process weak topics (average rating <= 2.5 out of 4, or low_rated_count >= 1)
        const combinedData = [
            ...skillsData.map(s => ({ ...s, source_type: 'practice' })),
            ...quizData
        ];

        const analysis = combinedData.map((item, idx) => {
            const avg = Number(item.average_rating) || 0;
            const isWeak = avg <= 2.5 || item.low_rated_count >= 1;

            let suggestedCount = 5;
            if (isWeak) {
                suggestedCount = Math.min(10, Math.max(5, item.low_rated_count * 3));
            } else if (avg < 3.5) {
                suggestedCount = 5;
            } else {
                suggestedCount = 3;
            }

            return {
                skill_id: item.skill_id || `q_${idx}`,
                skill_name: item.source_type === 'quiz' ? `${item.subject}: ${item.skill_name}` : item.skill_name,
                raw_topic: item.skill_name,
                subject: item.subject,
                source_type: item.source_type,
                attempts_count: item.attempts_count,
                questions_attempted: item.questions_attempted,
                average_rating: avg,
                low_rated_count: item.low_rated_count,
                total_available_questions: item.total_available_questions,
                is_weak: isWeak,
                suggested_practice_count: suggestedCount
            };
        });

        const weakOnly = analysis.filter(t => t.is_weak);

        return res.json({
            success: true,
            has_history: analysis.length > 0,
            weak_topics: weakOnly,
            all_topics: analysis
        });
    } catch (err) {
        next(err);
    }
}

/**
 * Personalised Practice Recommendations
 * Uses user's weak topics, bookmarked questions, and unattempted questions.
 */
async function getPersonalisedPractice(req, res, next) {
    try {
        const userId = req.session.user.id;
        const { role_id, difficulty } = req.query;

        // 1. Identify weak skill IDs
        const [weakRows] = await db.query(`
            SELECT s.id
            FROM attempt_questions aq
            JOIN practice_attempts pa ON aq.attempt_id = pa.id
            JOIN questions q ON aq.question_id = q.id
            JOIN skills s ON q.skill_id = s.id
            WHERE pa.user_id = ? AND aq.self_rating IS NOT NULL
            GROUP BY s.id
            HAVING AVG(aq.self_rating) <= 2.5 OR SUM(CASE WHEN aq.self_rating <= 2 THEN 1 ELSE 0 END) >= 2
        `, [userId]);
        const weakSkillIds = weakRows.map(r => r.id);

        // 2. Identify already attempted question IDs
        const [attemptedRows] = await db.query(`
            SELECT DISTINCT aq.question_id
            FROM attempt_questions aq
            JOIN practice_attempts pa ON aq.attempt_id = pa.id
            WHERE pa.user_id = ?
        `, [userId]);
        const attemptedQuestionIds = attemptedRows.map(r => r.question_id);

        // 3. Identify bookmarked question IDs
        const [bmRows] = await db.query('SELECT question_id FROM bookmarks WHERE user_id = ?', [userId]);
        const bookmarkedQuestionIds = bmRows.map(r => r.question_id);

        // 4. Fetch candidate questions
        let whereClauses = ["q.status = 'active'"];
        let params = [];

        if (role_id) {
            whereClauses.push("q.role_id = ?");
            params.push(role_id);
        }
        if (difficulty) {
            whereClauses.push("q.difficulty = ?");
            params.push(difficulty);
        }

        const whereSql = whereClauses.join(' AND ');

        const [allCandidates] = await db.query(`
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
                (CASE WHEN b.id IS NOT NULL THEN 1 ELSE 0 END) AS is_bookmarked
            FROM questions q
            JOIN interview_roles r ON q.role_id = r.id
            JOIN skills s ON q.skill_id = s.id
            LEFT JOIN bookmarks b ON q.id = b.question_id AND b.user_id = ?
            WHERE ${whereSql}
        `, [userId, ...params]);

        // Prioritize candidates:
        // Priority 1: Unattempted questions from weak topics
        // Priority 2: Bookmarked questions
        // Priority 3: Low-rated attempted questions (re-practice)
        // Priority 4: Unattempted questions from any topic
        const scoredCandidates = allCandidates.map(q => {
            let score = 0;
            let reason = 'General recommendation for role/skill';

            const isWeakTopic = weakSkillIds.includes(q.skill_id);
            const isAttempted = attemptedQuestionIds.includes(q.id);
            const isBookmarked = bookmarkedQuestionIds.includes(q.id);

            if (isWeakTopic && !isAttempted) {
                score += 100;
                reason = `Weak topic improvement: ${q.skill_name}`;
            } else if (isWeakTopic && isAttempted) {
                score += 60;
                reason = `Re-practice weak topic: ${q.skill_name}`;
            } else if (isBookmarked) {
                score += 50;
                reason = 'Saved in your bookmarks';
            } else if (!isAttempted) {
                score += 30;
                reason = 'New unattempted question';
            } else {
                score += 10;
                reason = 'Reinforce previously practiced concept';
            }

            return { ...q, score, recommendation_reason: reason };
        });

        // Sort descending by priority score
        scoredCandidates.sort((a, b) => b.score - a.score);

        // Fetch answer points for top 10 recommended questions
        const topQuestions = scoredCandidates.slice(0, 10);
        for (const q of topQuestions) {
            const [pts] = await db.query(
                'SELECT point_text FROM answer_points WHERE question_id = ? ORDER BY id ASC',
                [q.id]
            );
            q.points = pts.map(p => p.point_text);
        }

        return res.json({
            success: true,
            total_recommended: topQuestions.length,
            weak_skills_count: weakSkillIds.length,
            questions: topQuestions
        });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getWeakTopics,
    getPersonalisedPractice
};
