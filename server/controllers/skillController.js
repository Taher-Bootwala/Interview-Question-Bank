const db = require('../config/db');

async function getSkills(req, res, next) {
    try {
        const query = `
            SELECT s.id, s.name, s.created_at, COUNT(q.id) AS question_count
            FROM skills s
            LEFT JOIN questions q ON s.id = q.skill_id AND q.status = 'active'
            GROUP BY s.id, s.name, s.created_at
            ORDER BY s.name ASC
        `;
        const [skills] = await db.query(query);
        return res.json({ success: true, skills });
    } catch (err) {
        next(err);
    }
}

async function createSkill(req, res, next) {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Skill name is required.' });
        }
        const trimmed = name.trim();

        const [existing] = await db.query('SELECT id FROM skills WHERE name = ?', [trimmed]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'A skill with this name already exists.' });
        }

        const [result] = await db.query('INSERT INTO skills (name) VALUES (?)', [trimmed]);
        return res.status(201).json({
            success: true,
            message: 'Skill created successfully.',
            skill: { id: result.insertId, name: trimmed }
        });
    } catch (err) {
        next(err);
    }
}

async function updateSkill(req, res, next) {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Skill name is required.' });
        }
        const trimmed = name.trim();

        const [existing] = await db.query('SELECT id FROM skills WHERE name = ? AND id != ?', [trimmed, id]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Another skill with this name already exists.' });
        }

        const [result] = await db.query('UPDATE skills SET name = ? WHERE id = ?', [trimmed, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Skill not found.' });
        }

        return res.json({
            success: true,
            message: 'Skill updated successfully.',
            skill: { id: Number(id), name: trimmed }
        });
    } catch (err) {
        next(err);
    }
}

async function deleteSkill(req, res, next) {
    try {
        const { id } = req.params;

        // Check if questions depend on this skill
        const [qCount] = await db.query('SELECT COUNT(*) AS count FROM questions WHERE skill_id = ?', [id]);
        if (qCount[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete skill. There are ${qCount[0].count} question(s) associated with this skill. Please reassign or remove them first.`
            });
        }

        const [result] = await db.query('DELETE FROM skills WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Skill not found.' });
        }

        return res.json({ success: true, message: 'Skill deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getSkills,
    createSkill,
    updateSkill,
    deleteSkill
};
