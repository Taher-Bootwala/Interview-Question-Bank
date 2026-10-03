/**
 * Question Bank Logic
 */

let allLoadedQuestions = [];
let questionModal = null;

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    questionModal = new bootstrap.Modal(document.getElementById('questionModal'));

    // Populate filter dropdowns
    await loadFilterOptions();

    // Check URL parameters for preset filters
    const params = new URLSearchParams(window.location.search);
    if (params.get('role_id')) {
        document.getElementById('filter-role').value = params.get('role_id');
    }
    if (params.get('skill_id')) {
        document.getElementById('filter-skill').value = params.get('skill_id');
    }
    if (params.get('difficulty')) {
        document.getElementById('filter-difficulty').value = params.get('difficulty');
    }
    if (params.get('search')) {
        document.getElementById('filter-search').value = params.get('search');
    }

    // Attach filter event listeners
    document.getElementById('btn-filter-apply').addEventListener('click', () => loadQuestions());
    document.getElementById('btn-filter-clear').addEventListener('click', () => clearFilters());
    document.getElementById('filter-search').addEventListener('keyup', (e) => {
        if (e.key === 'Enter') loadQuestions();
    });

    document.getElementById('btn-practice-filtered').addEventListener('click', () => {
        if (allLoadedQuestions.length === 0) {
            App.showToast('No questions currently match your filters.', 'warning');
            return;
        }
        const roleId = document.getElementById('filter-role').value;
        const skillId = document.getElementById('filter-skill').value;
        const diff = document.getElementById('filter-difficulty').value;
        const qIds = allLoadedQuestions.map(q => q.id).join(',');
        window.location.href = `/practice.html?role_id=${roleId}&skill_id=${skillId}&difficulty=${diff}&ids=${qIds}`;
    });

    // Initial load
    await loadQuestions();
});

async function loadFilterOptions() {
    try {
        const [rolesRes, skillsRes] = await Promise.all([
            fetch('/api/roles'),
            fetch('/api/skills')
        ]);
        const rolesData = await rolesRes.json();
        const skillsData = await skillsRes.json();

        const roleSelect = document.getElementById('filter-role');
        if (rolesData.success) {
            rolesData.roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.name} (${r.question_count || 0})`;
                roleSelect.appendChild(opt);
            });
        }

        const skillSelect = document.getElementById('filter-skill');
        if (skillsData.success) {
            skillsData.skills.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `${s.name} (${s.question_count || 0})`;
                skillSelect.appendChild(opt);
            });
        }
    } catch (err) {
        console.error('Failed to load filter dropdowns:', err);
    }
}

function clearFilters() {
    document.getElementById('filter-search').value = '';
    document.getElementById('filter-role').value = '';
    document.getElementById('filter-skill').value = '';
    document.getElementById('filter-difficulty').value = '';
    loadQuestions();
}

async function loadQuestions() {
    const container = document.getElementById('questions-container');
    container.innerHTML = `
        <div class="text-center py-5 text-muted">
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            Loading questions...
        </div>
    `;

    const search = document.getElementById('filter-search').value.trim();
    const roleId = document.getElementById('filter-role').value;
    const skillId = document.getElementById('filter-skill').value;
    const diff = document.getElementById('filter-difficulty').value;

    const queryParams = new URLSearchParams();
    if (search) queryParams.set('search', search);
    if (roleId) queryParams.set('role_id', roleId);
    if (skillId) queryParams.set('skill_id', skillId);
    if (diff) queryParams.set('difficulty', diff);

    try {
        const res = await fetch(`/api/questions?${queryParams.toString()}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to fetch questions.');
        }

        allLoadedQuestions = data.questions || [];
        document.getElementById('filtered-count').textContent = allLoadedQuestions.length;

        if (allLoadedQuestions.length === 0) {
            container.innerHTML = `
                <div class="card p-5 text-center text-muted">
                    <h5>No questions found</h5>
                    <p class="mb-3">Try clearing or adjusting your search filters to find interview questions.</p>
                    <div><button onclick="clearFilters()" class="btn btn-sm btn-outline-primary">Reset Filters</button></div>
                </div>
            `;
            return;
        }

        container.innerHTML = allLoadedQuestions.map((q, idx) => `
            <div class="card mb-3 card-hover border">
                <div class="card-body">
                    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                            <span class="badge bg-secondary-subtle text-secondary border">Q${idx + 1}</span>
                            <span class="badge bg-light text-dark border">${App.escapeHtml(q.role_name)}</span>
                            <span class="badge bg-light text-dark border">${App.escapeHtml(q.skill_name)}</span>
                            ${App.getDifficultyBadge(q.difficulty)}
                        </div>
                        <div class="d-flex gap-2">
                            ${App.user ? `
                                <button class="btn btn-sm ${q.is_bookmarked ? 'btn-warning text-dark' : 'btn-outline-secondary'} btn-bookmark" data-id="${q.id}" data-bookmarked="${q.is_bookmarked}">
                                    ${q.is_bookmarked ? 'Bookmarked' : 'Bookmark'}
                                </button>
                            ` : ''}
                            <button class="btn btn-sm btn-outline-info text-dark btn-preview" data-id="${q.id}">
                                Preview
                            </button>
                            <a href="/practice.html?question_id=${q.id}" class="btn btn-sm btn-primary">
                                Practice
                            </a>
                        </div>
                    </div>
                    <h5 class="card-title text-dark fw-bold mb-2">${App.escapeHtml(q.question_text)}</h5>
                    ${q.expected_keywords ? `
                        <div class="small text-muted">
                            <span class="fw-semibold">Key terms:</span> ${App.escapeHtml(q.expected_keywords)}
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');

        // Attach Bookmark Event Handlers
        document.querySelectorAll('.btn-bookmark').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const qId = btn.getAttribute('data-id');
                const isBookmarked = btn.getAttribute('data-bookmarked') === '1' || btn.getAttribute('data-bookmarked') === 'true';
                await toggleBookmark(qId, isBookmarked, btn);
            });
        });

        // Attach Preview Event Handlers
        document.querySelectorAll('.btn-preview').forEach(btn => {
            btn.addEventListener('click', async () => {
                const qId = btn.getAttribute('data-id');
                await openQuestionPreview(qId);
            });
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                Failed to load questions. Please check your connection and try again.
            </div>
        `;
    }
}

async function toggleBookmark(questionId, currentlyBookmarked, buttonElement) {
    if (!App.user) {
        App.showToast('Please log in to bookmark questions.', 'warning');
        return;
    }

    try {
        if (currentlyBookmarked) {
            const res = await fetch(`/api/bookmarks/${questionId}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                buttonElement.setAttribute('data-bookmarked', '0');
                buttonElement.className = 'btn btn-sm btn-outline-secondary btn-bookmark';
                buttonElement.textContent = 'Bookmark';
                App.showToast('Bookmark removed.', 'info');
            }
        } else {
            const res = await fetch('/api/bookmarks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_id: questionId })
            });
            const data = await res.json();
            if (data.success) {
                buttonElement.setAttribute('data-bookmarked', '1');
                buttonElement.className = 'btn btn-sm btn-warning text-dark btn-bookmark';
                buttonElement.textContent = 'Bookmarked';
                App.showToast('Bookmark added.', 'success');
            }
        }
    } catch (err) {
        console.error(err);
        App.showToast('Error updating bookmark.', 'error');
    }
}

async function openQuestionPreview(questionId) {
    const modalBody = document.getElementById('modal-q-body');
    const modalPracticeBtn = document.getElementById('modal-q-practice-btn');
    modalBody.innerHTML = '<div class="text-center py-4 text-muted">Loading question details...</div>';
    questionModal.show();

    try {
        const res = await fetch(`/api/questions/${questionId}`);
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message);

        const q = data.question;
        document.getElementById('modal-q-title').textContent = `${q.role_name} &bull; ${q.skill_name}`;
        modalPracticeBtn.href = `/practice.html?question_id=${q.id}`;

        const pointsHtml = q.points && q.points.length > 0
            ? `<ul class="points-list mt-2">${q.points.map(pt => `<li>${App.escapeHtml(pt)}</li>`).join('')}</ul>`
            : '<p class="text-muted small">No specific breakdown points specified.</p>';

        const keywordsHtml = q.expected_keywords
            ? `<div class="keywords-tag-cloud mt-2">${q.expected_keywords.split(',').map(kw => `<span class="badge">${App.escapeHtml(kw.trim())}</span>`).join('')}</div>`
            : '<span class="text-muted small">None</span>';

        modalBody.innerHTML = `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="badge bg-light text-dark border">${App.escapeHtml(q.skill_name)}</span>
                    ${App.getDifficultyBadge(q.difficulty)}
                </div>
                <h5 class="fw-bold text-dark">${App.escapeHtml(q.question_text)}</h5>
            </div>

            <div class="model-answer-section mb-3">
                <h6 class="fw-bold text-success mb-2">Model Answer:</h6>
                <p class="mb-2 text-dark">${App.escapeHtml(q.model_answer)}</p>
                <div class="fw-semibold text-success small mb-1">Key Points to Cover:</div>
                ${pointsHtml}
            </div>

            <div class="p-3 bg-light rounded border">
                <span class="fw-semibold small text-muted">Expected Technical Keywords:</span>
                ${keywordsHtml}
            </div>
        `;
    } catch (err) {
        console.error(err);
        modalBody.innerHTML = `<div class="alert alert-danger">Failed to load question details.</div>`;
    }
}
