/**
 * Unified Admin Console Logic
 */

let questionFormModal = null;
let roleModal = null;
let skillModal = null;
let adminRoles = [];
let adminSkills = [];

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    if (!App.requireAuth(true)) return;

    // Attach Admin Logout
    document.getElementById('btn-admin-logout')?.addEventListener('click', (e) => {
        e.preventDefault();
        App.logout();
    });

    const pagePath = window.location.pathname;

    if (pagePath.includes('/admin/dashboard.html')) {
        await initAdminDashboard();
    } else if (pagePath.includes('/admin/questions.html')) {
        await initAdminQuestions();
    } else if (pagePath.includes('/admin/roles.html')) {
        await initAdminRoles();
    } else if (pagePath.includes('/admin/skills.html')) {
        await initAdminSkills();
    } else if (pagePath.includes('/admin/users.html')) {
        await initAdminUsers();
    } else if (pagePath.includes('/admin/attempts.html')) {
        await initAdminAttempts();
    }
});

/* =========================================================================
   1. Admin Dashboard
   ========================================================================= */
async function initAdminDashboard() {
    try {
        const res = await fetch('/api/dashboard/admin');
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Failed to load stats');

        document.getElementById('stat-users').textContent = data.stats.totalUsers || 0;
        document.getElementById('stat-questions').textContent = data.stats.totalQuestions || 0;
        document.getElementById('stat-active-questions').textContent = `(${data.stats.activeQuestions || 0} active)`;
        document.getElementById('stat-attempts').textContent = data.stats.totalAttempts || 0;
        document.getElementById('stat-bookmarks').textContent = data.stats.totalBookmarks || 0;

        // By Role Table
        const roleTbody = document.getElementById('table-by-role');
        if (data.byRole && data.byRole.length > 0) {
            roleTbody.innerHTML = data.byRole.map(r => `
                <tr>
                    <td>${App.escapeHtml(r.name)}</td>
                    <td class="text-end fw-semibold">${r.count}</td>
                </tr>
            `).join('');
        } else {
            roleTbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No roles found</td></tr>';
        }

        // By Skill Table
        const skillTbody = document.getElementById('table-by-skill');
        if (data.bySkill && data.bySkill.length > 0) {
            skillTbody.innerHTML = data.bySkill.map(s => `
                <tr>
                    <td>${App.escapeHtml(s.name)}</td>
                    <td class="text-end fw-semibold">${s.count}</td>
                </tr>
            `).join('');
        } else {
            skillTbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No skills found</td></tr>';
        }

        // Difficulty Breakdown
        const diffContainer = document.getElementById('diff-breakdown-container');
        if (data.byDifficulty && data.byDifficulty.length > 0) {
            diffContainer.innerHTML = data.byDifficulty.map(d => `
                <div class="d-flex justify-content-between align-items-center mb-2 p-2 border rounded">
                    <span>${App.getDifficultyBadge(d.difficulty)}</span>
                    <span class="fw-bold">${d.count} questions</span>
                </div>
            `).join('');
        } else {
            diffContainer.innerHTML = '<div class="text-muted text-center">No questions recorded.</div>';
        }

        // Recent Attempts
        const attemptsTbody = document.getElementById('table-admin-recent-attempts');
        if (data.recentAttempts && data.recentAttempts.length > 0) {
            attemptsTbody.innerHTML = data.recentAttempts.map(att => `
                <tr>
                    <td>
                        <div class="fw-semibold">${App.escapeHtml(att.user_name)}</div>
                        <small class="text-muted">${App.escapeHtml(att.user_email)}</small>
                    </td>
                    <td>${App.escapeHtml(att.role_name || 'Mixed')}</td>
                    <td class="small">${App.formatDate(att.started_at)}</td>
                    <td><span class="badge bg-light text-dark border">${att.completed_questions || 0} / ${att.total_questions || 0}</span></td>
                    <td>${App.formatTime(att.total_time)}</td>
                    <td>${App.getRatingBadge(att.average_rating)}</td>
                </tr>
            `).join('');
        } else {
            attemptsTbody.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-muted">No practice attempts recorded yet.</td></tr>';
        }

    } catch (err) {
        console.error(err);
        App.showToast('Failed to load admin metrics.', 'error');
    }
}

/* =========================================================================
   2. Admin Questions CRUD
   ========================================================================= */
async function initAdminQuestions() {
    const modalEl = document.getElementById('questionFormModal');
    if (modalEl) questionFormModal = new bootstrap.Modal(modalEl);

    // Fetch and populate roles & skills
    await loadAdminRolesAndSkills();

    // Attach Add Question Button
    document.getElementById('btn-open-create-modal')?.addEventListener('click', () => openCreateQuestionModal());

    // Attach Add Point Button in Form
    document.getElementById('btn-add-point-row')?.addEventListener('click', () => addPointRow(''));

    // Question Form Submission
    document.getElementById('question-form')?.addEventListener('submit', handleSaveQuestion);

    // Filter Buttons
    document.getElementById('btn-admin-filter')?.addEventListener('click', () => loadAdminQuestionsList());
    document.getElementById('btn-admin-filter-reset')?.addEventListener('click', () => {
        document.getElementById('admin-filter-search').value = '';
        document.getElementById('admin-filter-role').value = '';
        document.getElementById('admin-filter-skill').value = '';
        document.getElementById('admin-filter-status').value = '';
        loadAdminQuestionsList();
    });

    // Check if URL asked to open "new" modal
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
        openCreateQuestionModal();
    }

    await loadAdminQuestionsList();
}

async function loadAdminRolesAndSkills() {
    try {
        const [rRes, sRes] = await Promise.all([fetch('/api/roles'), fetch('/api/skills')]);
        const rData = await rRes.json();
        const sData = await sRes.json();

        adminRoles = rData.roles || [];
        adminSkills = sData.skills || [];

        // Populate filter selects
        const fRole = document.getElementById('admin-filter-role');
        const fSkill = document.getElementById('admin-filter-skill');
        const formRole = document.getElementById('q-form-role');
        const formSkill = document.getElementById('q-form-skill');

        if (fRole) {
            adminRoles.forEach(r => {
                fRole.appendChild(new Option(r.name, r.id));
                if (formRole) formRole.appendChild(new Option(r.name, r.id));
            });
        }

        if (fSkill) {
            adminSkills.forEach(s => {
                fSkill.appendChild(new Option(s.name, s.id));
                if (formSkill) formSkill.appendChild(new Option(s.name, s.id));
            });
        }
    } catch (err) {
        console.error(err);
    }
}

async function loadAdminQuestionsList() {
    const tbody = document.getElementById('admin-questions-tbody');
    tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted"><div class="spinner-border spinner-border-sm text-primary me-2"></div>Loading questions...</td></tr>';

    const search = document.getElementById('admin-filter-search').value.trim();
    const roleId = document.getElementById('admin-filter-role').value;
    const skillId = document.getElementById('admin-filter-skill').value;
    const status = document.getElementById('admin-filter-status').value;

    const query = new URLSearchParams();
    if (search) query.set('search', search);
    if (roleId) query.set('role_id', roleId);
    if (skillId) query.set('skill_id', skillId);
    if (status) query.set('status', status);

    try {
        const res = await fetch(`/api/questions?${query.toString()}`);
        const data = await res.json();
        const questions = data.questions || [];

        if (questions.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-muted">No questions found matching your filter criteria.</td></tr>';
            return;
        }

        tbody.innerHTML = questions.map(q => `
            <tr>
                <td class="fw-bold">#${q.id}</td>
                <td>
                    <div class="fw-semibold text-dark mb-1">${App.escapeHtml(q.question_text)}</div>
                    <small class="text-muted text-truncate d-block" style="max-width: 450px;">${App.escapeHtml(q.model_answer)}</small>
                </td>
                <td><span class="badge bg-light text-dark border">${App.escapeHtml(q.role_name)}</span></td>
                <td><span class="badge bg-light text-dark border">${App.escapeHtml(q.skill_name)}</span></td>
                <td>${App.getDifficultyBadge(q.difficulty)}</td>
                <td>
                    <span class="badge ${q.status === 'active' ? 'bg-success' : 'bg-secondary'}">
                        ${q.status}
                    </span>
                </td>
                <td class="text-end">
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary btn-edit-q" data-id="${q.id}">Edit</button>
                        <button class="btn btn-outline-danger btn-delete-q" data-id="${q.id}" data-status="${q.status}">
                            ${q.status === 'active' ? 'Archive' : 'Delete'}
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        // Attach action handlers
        document.querySelectorAll('.btn-edit-q').forEach(btn => {
            btn.addEventListener('click', () => openEditQuestionModal(btn.getAttribute('data-id')));
        });

        document.querySelectorAll('.btn-delete-q').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteQuestion(btn.getAttribute('data-id'), btn.getAttribute('data-status')));
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load questions.</td></tr>';
    }
}

function openCreateQuestionModal() {
    document.getElementById('questionModalTitle').textContent = 'Add New Question';
    document.getElementById('q-form-id').value = '';
    document.getElementById('q-form-role').value = '';
    document.getElementById('q-form-skill').value = '';
    document.getElementById('q-form-difficulty').value = 'Medium';
    document.getElementById('q-form-text').value = '';
    document.getElementById('q-form-model-answer').value = '';
    document.getElementById('q-form-keywords').value = '';
    document.getElementById('q-form-status').value = 'active';

    const pointsContainer = document.getElementById('points-input-container');
    pointsContainer.innerHTML = '';
    addPointRow('');
    addPointRow('');

    questionFormModal.show();
}

async function openEditQuestionModal(questionId) {
    try {
        const res = await fetch(`/api/questions/${questionId}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message);

        const q = data.question;
        document.getElementById('questionModalTitle').textContent = `Edit Question #${q.id}`;
        document.getElementById('q-form-id').value = q.id;
        document.getElementById('q-form-role').value = q.role_id;
        document.getElementById('q-form-skill').value = q.skill_id;
        document.getElementById('q-form-difficulty').value = q.difficulty;
        document.getElementById('q-form-text').value = q.question_text;
        document.getElementById('q-form-model-answer').value = q.model_answer;
        document.getElementById('q-form-keywords').value = q.expected_keywords || '';
        document.getElementById('q-form-status').value = q.status;

        const pointsContainer = document.getElementById('points-input-container');
        pointsContainer.innerHTML = '';
        if (q.points && q.points.length > 0) {
            q.points.forEach(pt => addPointRow(pt));
        } else {
            addPointRow('');
        }

        questionFormModal.show();
    } catch (err) {
        console.error(err);
        App.showToast('Failed to load question details.', 'error');
    }
}

function addPointRow(initialText = '') {
    const container = document.getElementById('points-input-container');
    const row = document.createElement('div');
    row.className = 'input-group mb-2 point-row';
    row.innerHTML = `
        <span class="input-group-text small">&bull;</span>
        <input type="text" class="form-control form-control-sm point-input" placeholder="Important model answer point..." value="${App.escapeHtml(initialText)}">
        <button type="button" class="btn btn-sm btn-outline-danger btn-remove-point">&times;</button>
    `;

    row.querySelector('.btn-remove-point').addEventListener('click', () => {
        row.remove();
    });

    container.appendChild(row);
}

async function handleSaveQuestion(e) {
    e.preventDefault();
    const id = document.getElementById('q-form-id').value;
    const isEdit = !!id;

    const role_id = document.getElementById('q-form-role').value;
    const skill_id = document.getElementById('q-form-skill').value;
    const difficulty = document.getElementById('q-form-difficulty').value;
    const question_text = document.getElementById('q-form-text').value.trim();
    const model_answer = document.getElementById('q-form-model-answer').value.trim();
    const expected_keywords = document.getElementById('q-form-keywords').value.trim();
    const status = document.getElementById('q-form-status').value;

    if (!role_id || !skill_id || !difficulty || !question_text || !model_answer) {
        App.showToast('Please fill in all required question fields.', 'warning');
        return;
    }

    const pointInputs = document.querySelectorAll('.point-input');
    const points = [];
    pointInputs.forEach(input => {
        if (input.value.trim()) points.push(input.value.trim());
    });

    const payload = {
        role_id: Number(role_id),
        skill_id: Number(skill_id),
        difficulty,
        question_text,
        model_answer,
        expected_keywords,
        status,
        points
    };

    const submitBtn = document.getElementById('btn-save-question');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        const url = isEdit ? `/api/questions/${id}` : '/api/questions';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (res.ok && data.success) {
            App.showToast(data.message, 'success');
            questionFormModal.hide();
            await loadAdminQuestionsList();
        } else {
            App.showToast(data.message || 'Failed to save question.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Error saving question.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save Question';
    }
}

async function handleDeleteQuestion(questionId, currentStatus) {
    const isInactive = currentStatus === 'inactive';
    const confirmMsg = isInactive
        ? `Question #${questionId} is already archived. Do you want to permanently delete it?`
        : `Are you sure you want to archive Question #${questionId}?`;

    if (!confirm(confirmMsg)) return;

    try {
        const url = isInactive 
            ? `/api/questions/${questionId}?permanent=true` 
            : `/api/questions/${questionId}`;

        const res = await fetch(url, { method: 'DELETE' });
        const data = await res.json();

        if (res.ok && data.success) {
            App.showToast(data.message, 'info');
            await loadAdminQuestionsList();
        } else {
            App.showToast(data.message || 'Failed to delete question.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Network error during deletion.', 'error');
    }
}

/* =========================================================================
   3. Admin Roles CRUD
   ========================================================================= */
async function initAdminRoles() {
    const modalEl = document.getElementById('roleModal');
    if (modalEl) roleModal = new bootstrap.Modal(modalEl);

    document.getElementById('btn-add-role-modal')?.addEventListener('click', () => {
        document.getElementById('roleModalTitle').textContent = 'Add Role';
        document.getElementById('role-id').value = '';
        document.getElementById('role-name-input').value = '';
        roleModal.show();
    });

    document.getElementById('role-form')?.addEventListener('submit', handleSaveRole);

    await loadAdminRolesList();
}

async function loadAdminRolesList() {
    const tbody = document.getElementById('roles-tbody');
    try {
        const res = await fetch('/api/roles');
        const data = await res.json();
        const roles = data.roles || [];

        tbody.innerHTML = roles.map(r => `
            <tr>
                <td class="fw-bold">#${r.id}</td>
                <td class="fw-semibold text-dark">${App.escapeHtml(r.name)}</td>
                <td><span class="badge bg-light text-dark border">${r.question_count || 0} questions</span></td>
                <td class="small text-muted">${App.formatDate(r.created_at)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1 btn-edit-role" data-id="${r.id}" data-name="${App.escapeHtml(r.name)}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-role" data-id="${r.id}" data-name="${App.escapeHtml(r.name)}">Delete</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-edit-role').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('roleModalTitle').textContent = 'Edit Role';
                document.getElementById('role-id').value = btn.getAttribute('data-id');
                document.getElementById('role-name-input').value = btn.getAttribute('data-name');
                roleModal.show();
            });
        });

        document.querySelectorAll('.btn-delete-role').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                if (confirm(`Are you sure you want to delete role '${name}'?`)) {
                    await deleteRole(id);
                }
            });
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load roles.</td></tr>';
    }
}

async function handleSaveRole(e) {
    e.preventDefault();
    const id = document.getElementById('role-id').value;
    const name = document.getElementById('role-name-input').value.trim();

    if (!name) return;

    try {
        const url = id ? `/api/roles/${id}` : '/api/roles';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            App.showToast(data.message, 'success');
            roleModal.hide();
            await loadAdminRolesList();
        } else {
            App.showToast(data.message || 'Error saving role.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Network error saving role.', 'error');
    }
}

async function deleteRole(id) {
    try {
        const res = await fetch(`/api/roles/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            App.showToast(data.message, 'info');
            await loadAdminRolesList();
        } else {
            App.showToast(data.message || 'Cannot delete role.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Network error deleting role.', 'error');
    }
}

/* =========================================================================
   4. Admin Skills CRUD
   ========================================================================= */
async function initAdminSkills() {
    const modalEl = document.getElementById('skillModal');
    if (modalEl) skillModal = new bootstrap.Modal(modalEl);

    document.getElementById('btn-add-skill-modal')?.addEventListener('click', () => {
        document.getElementById('skillModalTitle').textContent = 'Add Skill';
        document.getElementById('skill-id').value = '';
        document.getElementById('skill-name-input').value = '';
        skillModal.show();
    });

    document.getElementById('skill-form')?.addEventListener('submit', handleSaveSkill);

    await loadAdminSkillsList();
}

async function loadAdminSkillsList() {
    const tbody = document.getElementById('skills-tbody');
    try {
        const res = await fetch('/api/skills');
        const data = await res.json();
        const skills = data.skills || [];

        tbody.innerHTML = skills.map(s => `
            <tr>
                <td class="fw-bold">#${s.id}</td>
                <td class="fw-semibold text-dark">${App.escapeHtml(s.name)}</td>
                <td><span class="badge bg-light text-dark border">${s.question_count || 0} questions</span></td>
                <td class="small text-muted">${App.formatDate(s.created_at)}</td>
                <td class="text-end">
                    <button class="btn btn-sm btn-outline-primary me-1 btn-edit-skill" data-id="${s.id}" data-name="${App.escapeHtml(s.name)}">Edit</button>
                    <button class="btn btn-sm btn-outline-danger btn-delete-skill" data-id="${s.id}" data-name="${App.escapeHtml(s.name)}">Delete</button>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.btn-edit-skill').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('skillModalTitle').textContent = 'Edit Skill';
                document.getElementById('skill-id').value = btn.getAttribute('data-id');
                document.getElementById('skill-name-input').value = btn.getAttribute('data-name');
                skillModal.show();
            });
        });

        document.querySelectorAll('.btn-delete-skill').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const name = btn.getAttribute('data-name');
                if (confirm(`Are you sure you want to delete skill '${name}'?`)) {
                    await deleteSkill(id);
                }
            });
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-danger">Failed to load skills.</td></tr>';
    }
}

async function handleSaveSkill(e) {
    e.preventDefault();
    const id = document.getElementById('skill-id').value;
    const name = document.getElementById('skill-name-input').value.trim();

    if (!name) return;

    try {
        const url = id ? `/api/skills/${id}` : '/api/skills';
        const method = id ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name })
        });

        const data = await res.json();
        if (res.ok && data.success) {
            App.showToast(data.message, 'success');
            skillModal.hide();
            await loadAdminSkillsList();
        } else {
            App.showToast(data.message || 'Error saving skill.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Network error saving skill.', 'error');
    }
}

async function deleteSkill(id) {
    try {
        const res = await fetch(`/api/skills/${id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok && data.success) {
            App.showToast(data.message, 'info');
            await loadAdminSkillsList();
        } else {
            App.showToast(data.message || 'Cannot delete skill.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Network error deleting skill.', 'error');
    }
}

/* =========================================================================
   5. Admin Users View
   ========================================================================= */
async function initAdminUsers() {
    const tbody = document.getElementById('users-tbody');
    try {
        const res = await fetch('/api/dashboard/users');
        const data = await res.json();
        const users = data.users || [];

        tbody.innerHTML = users.map(u => `
            <tr>
                <td class="fw-bold">#${u.id}</td>
                <td class="fw-semibold text-dark">${App.escapeHtml(u.name)}</td>
                <td>${App.escapeHtml(u.email)}</td>
                <td>
                    <span class="badge ${u.role === 'admin' ? 'bg-danger' : 'bg-primary'}">
                        ${u.role}
                    </span>
                </td>
                <td><span class="badge bg-light text-dark border">${u.total_attempts || 0} attempts</span></td>
                <td><span class="badge bg-light text-dark border">${u.total_bookmarks || 0} bookmarks</span></td>
                <td class="small text-muted">${App.formatDate(u.created_at)}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="7" class="text-center py-4 text-danger">Failed to load users.</td></tr>';
    }
}

/* =========================================================================
   6. Admin Attempts View
   ========================================================================= */
async function initAdminAttempts() {
    const tbody = document.getElementById('admin-all-attempts-tbody');
    try {
        const res = await fetch('/api/attempts?all=true');
        const data = await res.json();
        const attempts = data.attempts || [];

        if (attempts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-muted">No practice attempts found in the database.</td></tr>';
            return;
        }

        tbody.innerHTML = attempts.map(att => `
            <tr>
                <td class="fw-bold">#${att.id}</td>
                <td>
                    <div class="fw-semibold text-dark">${App.escapeHtml(att.user_name)}</div>
                    <small class="text-muted">${App.escapeHtml(att.user_email)}</small>
                </td>
                <td>${App.escapeHtml(att.role_name || 'Mixed')}</td>
                <td class="small text-muted">${App.formatDate(att.started_at)}</td>
                <td><span class="badge bg-light text-dark border">${att.completed_questions || 0} / ${att.total_questions || 0}</span></td>
                <td>${App.formatTime(att.total_time)}</td>
                <td>
                    <span class="badge ${att.status === 'completed' ? 'bg-success' : 'bg-warning text-dark'}">
                        ${att.status}
                    </span>
                </td>
                <td>${App.getRatingBadge(att.average_rating)}</td>
                <td class="text-end">
                    <a href="/attempts.html?id=${att.id}" class="btn btn-sm btn-outline-primary">
                        Review
                    </a>
                </td>
            </tr>
        `).join('');

    } catch (err) {
        console.error(err);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center py-4 text-danger">Failed to load attempts.</td></tr>';
    }
}
