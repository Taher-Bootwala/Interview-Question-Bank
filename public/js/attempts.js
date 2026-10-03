/**
 * Attempt History & Detailed Review Logic
 */

let attemptModal = null;

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    if (!App.requireAuth()) return;

    attemptModal = new bootstrap.Modal(document.getElementById('attemptModal'));

    await loadAttempts();

    // Check if URL specified an attempt ID to open immediately
    const params = new URLSearchParams(window.location.search);
    const targetAttemptId = params.get('id');
    if (targetAttemptId) {
        openAttemptModal(targetAttemptId);
    }
});

async function loadAttempts() {
    const tbody = document.getElementById('attempts-tbody');
    try {
        const res = await fetch('/api/attempts');
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to load attempts.');
        }

        const attempts = data.attempts || [];
        const quizAttempts = data.quizAttempts || [];

        // Update badge counts
        const badgePractice = document.getElementById('badge-practice-count');
        if (badgePractice) badgePractice.textContent = attempts.length;

        const badgeQuiz = document.getElementById('badge-quiz-count');
        if (badgeQuiz) badgeQuiz.textContent = quizAttempts.length;

        // Auto-switch active tab if user only has practice attempts
        if (quizAttempts.length === 0 && attempts.length > 0) {
            const practiceTabTrigger = document.getElementById('tab-practice');
            if (practiceTabTrigger) {
                const tabInstance = bootstrap.Tab.getOrCreateInstance(practiceTabTrigger);
                tabInstance.show();
            }
        }

        // 1. Render Topic Quizzes Table
        const quizTbody = document.getElementById('quiz-attempts-tbody');
        if (quizTbody) {
            if (quizAttempts.length === 0) {
                quizTbody.innerHTML = `
                    <tr>
                        <td colspan="8" class="text-center py-5 text-muted">
                            <h5 class="fw-bold">No Topic Quizzes Yet</h5>
                            <p class="mb-3">Test your conceptual knowledge from 3,000+ questions.</p>
                            <a href="/quiz.html" class="btn btn-success btn-sm px-3">Take Your First Quiz</a>
                        </td>
                    </tr>
                `;
            } else {
                quizTbody.innerHTML = quizAttempts.map(q => {
                    const pct = Number(q.percentage) || 0;
                    const badgeClass = pct >= 80 ? 'bg-success' : (pct >= 60 ? 'bg-primary' : 'bg-warning text-dark');
                    return `
                        <tr>
                            <td class="fw-bold">#Q${q.id}</td>
                            <td>${App.formatDate(q.created_at)}</td>
                            <td class="fw-medium">${App.escapeHtml(q.subject)}</td>
                            <td>${App.escapeHtml(q.topic)}</td>
                            <td>
                                <span class="badge bg-light text-dark border">
                                    ${q.score} / ${q.total_questions}
                                </span>
                            </td>
                            <td><span class="badge ${badgeClass}">${pct}%</span></td>
                            <td>${App.formatTime(q.time_spent)}</td>
                            <td>
                                <a href="/quiz.html" class="btn btn-sm btn-outline-success">
                                    Retake Topic
                                </a>
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        }

        // 2. Render Mock Practice Sessions Table
        if (attempts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5 text-muted">
                        <h5 class="fw-bold">No Practice Sessions Yet</h5>
                        <p class="mb-3">Launch a timed mock interview with self-evaluation checklist.</p>
                        <a href="/practice.html" class="btn btn-primary btn-sm px-3">Start Practice Session</a>
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = attempts.map(att => {
            const statusBadge = att.status === 'completed'
                ? '<span class="badge bg-success">Completed</span>'
                : '<span class="badge bg-warning text-dark">In Progress</span>';

            return `
                <tr>
                    <td class="fw-bold">#P${att.id}</td>
                    <td>${App.formatDate(att.started_at)}</td>
                    <td class="fw-medium">${App.escapeHtml(att.role_name || 'Mixed Practice')}</td>
                    <td>
                        <span class="badge bg-light text-dark border">
                            ${att.completed_questions || 0} / ${att.total_questions || 0}
                        </span>
                    </td>
                    <td>${App.formatTime(att.total_time)}</td>
                    <td>${statusBadge}</td>
                    <td>${App.getRatingBadge(att.average_rating)}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary btn-view-attempt" data-id="${att.id}">
                            Open Review
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        // Attach modal openers for practice sessions
        document.querySelectorAll('.btn-view-attempt').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                openAttemptModal(id);
            });
        });

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4 text-danger">
                    Failed to load attempt history. Please refresh the page.
                </td>
            </tr>
        `;
    }
}

async function openAttemptModal(attemptId) {
    const modalBody = document.getElementById('attempt-modal-body');
    const modalTitle = document.getElementById('attempt-modal-title');
    const modalSub = document.getElementById('attempt-modal-subtitle');

    modalTitle.textContent = `Practice Attempt #${attemptId}`;
    modalSub.textContent = 'Loading attempt questions and evaluations...';
    modalBody.innerHTML = '<div class="text-center py-5"><div class="spinner-border text-primary"></div></div>';
    attemptModal.show();

    try {
        const res = await fetch(`/api/attempts/${attemptId}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to load attempt details.');
        }

        const att = data.attempt;
        modalSub.textContent = `Date: ${App.formatDate(att.started_at)} | Time Spent: ${App.formatTime(att.total_time)} | Role: ${att.role_name || 'Mixed Practice'}`;

        if (!att.questions || att.questions.length === 0) {
            modalBody.innerHTML = '<div class="text-center py-4 text-muted">No questions recorded for this session.</div>';
            return;
        }

        modalBody.innerHTML = att.questions.map((q, idx) => {
            const evalData = q.evaluation_data || {};
            const checklistItems = [
                { key: 'concept', label: 'Covered main concept', checked: !!evalData.concept },
                { key: 'points', label: 'Explained important points', checked: !!evalData.points },
                { key: 'terminology', label: 'Used relevant terminology', checked: !!evalData.terminology },
                { key: 'clarity', label: 'Answer was clear', checked: !!evalData.clarity },
                { key: 'missed', label: 'Missed important points', checked: !!evalData.missed, isDanger: true }
            ];

            const pointsHtml = q.points && q.points.length > 0
                ? `<ul class="points-list mb-0 mt-1 small">${q.points.map(p => `<li>${App.escapeHtml(p)}</li>`).join('')}</ul>`
                : '<span class="text-muted small">None listed</span>';

            const keywordsHtml = q.expected_keywords
                ? `<div class="keywords-tag-cloud mt-1">${q.expected_keywords.split(',').map(k => `<span class="badge">${App.escapeHtml(k.trim())}</span>`).join('')}</div>`
                : '<span class="text-muted small">None</span>';

            return `
                <div class="card mb-4 border">
                    <div class="card-header bg-light d-flex justify-content-between align-items-center">
                        <div>
                            <span class="badge bg-secondary me-2">Q${idx + 1}</span>
                            <span class="badge bg-white text-dark border me-1">${App.escapeHtml(q.skill_name)}</span>
                            ${App.getDifficultyBadge(q.difficulty)}
                        </div>
                        <div>
                            <span class="small text-muted me-2">Self-Rating:</span>
                            ${App.getRatingBadge(q.self_rating)}
                        </div>
                    </div>
                    <div class="card-body">
                        <h5 class="fw-bold mb-3">${App.escapeHtml(q.question_text)}</h5>

                        <!-- Side by Side or Stacked: User Answer vs Model Answer -->
                        <div class="row g-3 mb-3">
                            <div class="col-md-6">
                                <div class="answer-comparison-box h-100">
                                    <h6 class="fw-bold text-dark border-bottom pb-2">Your Answer:</h6>
                                    <p class="small text-dark mb-0" style="white-space: pre-wrap;">${q.user_answer ? App.escapeHtml(q.user_answer) : '<em class="text-muted">No answer entered.</em>'}</p>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="model-answer-section h-100">
                                    <h6 class="fw-bold text-success border-bottom border-success-subtle pb-2">Model Answer:</h6>
                                    <p class="small text-dark mb-2">${App.escapeHtml(q.model_answer)}</p>
                                    <div class="fw-semibold text-success small">Key Points:</div>
                                    ${pointsHtml}
                                    <div class="mt-2 pt-2 border-top border-success-subtle">
                                        <div class="fw-semibold text-success small">Expected Keywords:</div>
                                        ${keywordsHtml}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Self-Evaluation Checklist Summary -->
                        <div class="p-3 bg-light rounded border">
                            <div class="fw-semibold small text-muted mb-2">Self-Evaluation Checklist Rubric:</div>
                            <div class="row g-2">
                                ${checklistItems.map(item => `
                                    <div class="col-sm-6 col-lg-4">
                                        <span class="small ${item.checked ? (item.isDanger ? 'text-danger fw-semibold' : 'text-success fw-semibold') : 'text-muted'}">
                                            [${item.checked ? 'Yes' : 'No'}] ${item.label}
                                        </span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        modalBody.innerHTML = `<div class="alert alert-danger">Error loading attempt details: ${err.message}</div>`;
    }
}
