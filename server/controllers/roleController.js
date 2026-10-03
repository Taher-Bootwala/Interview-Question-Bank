const db = require('../config/db');

async function getRoles(req, res, next) {
    try {
        const query = `
            SELECT r.id, r.name, r.created_at, COUNT(q.id) AS question_count
            FROM interview_roles r
            LEFT JOIN questions q ON r.id = q.role_id AND q.status = 'active'
            GROUP BY r.id, r.name, r.created_at
            ORDER BY r.name ASC
        `;
        const [roles] = await db.query(query);
        return res.json({ success: true, roles });
    } catch (err) {
        next(err);
    }
}

async function createRole(req, res, next) {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Role name is required.' });
        }
        const trimmed = name.trim();

        const [existing] = await db.query('SELECT id FROM interview_roles WHERE name = ?', [trimmed]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'A role with this name already exists.' });
        }

        const [result] = await db.query('INSERT INTO interview_roles (name) VALUES (?)', [trimmed]);
        return res.status(201).json({
            success: true,
            message: 'Role created successfully.',
            role: { id: result.insertId, name: trimmed }
        });
    } catch (err) {
        next(err);
    }
}

async function updateRole(req, res, next) {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, message: 'Role name is required.' });
        }
        const trimmed = name.trim();

        const [existing] = await db.query('SELECT id FROM interview_roles WHERE name = ? AND id != ?', [trimmed, id]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: 'Another role with this name already exists.' });
        }

        const [result] = await db.query('UPDATE interview_roles SET name = ? WHERE id = ?', [trimmed, id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Role not found.' });
        }

        return res.json({
            success: true,
            message: 'Role updated successfully.',
            role: { id: Number(id), name: trimmed }
        });
    } catch (err) {
        next(err);
    }
}

async function deleteRole(req, res, next) {
    try {
        const { id } = req.params;

        // Check if any questions depend on this role
        const [qCount] = await db.query('SELECT COUNT(*) AS count FROM questions WHERE role_id = ?', [id]);
        if (qCount[0].count > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete role. There are ${qCount[0].count} question(s) associated with this role. Please reassign or remove them first.`
            });
        }

        const [result] = await db.query('DELETE FROM interview_roles WHERE id = ?', [id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, message: 'Role not found.' });
        }

        return res.json({ success: true, message: 'Role deleted successfully.' });
    } catch (err) {
        next(err);
    }
}

module.exports = {
    getRoles,
    createRole,
    updateRole,
    deleteRole
};
