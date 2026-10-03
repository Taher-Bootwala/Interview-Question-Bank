/**
 * User Dashboard Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    if (!App.requireAuth()) return;

    // Set greeting name
    const greeting = document.getElementById('greeting-title');
    if (greeting && App.user) {
        greeting.textContent = `Welcome Back, ${App.user.name}!`;
    }

    await loadDashboardData();
});

async function loadDashboardData() {
    try {
        const res = await fetch('/api/dashboard/user');
        if (!res.ok) throw new Error('Failed to load dashboard data.');
        const data = await res.json();

        // Populate stats
        document.getElementById('stat-attempts').textContent = data.stats.totalAttempts || 0;
        document.getElementById('stat-questions').textContent = data.stats.questionsAttempted || 0;
        document.getElementById('stat-bookmarks').textContent = data.stats.bookmarkedQuestions || 0;
        document.getElementById('stat-weak-topics').textContent = data.stats.weakTopicsCount || 0;

        // Render Recent Attempts
        const attemptsTable = document.getElementById('recent-attempts-table');
        if (attemptsTable) {
            if (data.recentAttempts && data.recentAttempts.length > 0) {
                attemptsTable.innerHTML = data.recentAttempts.map(att => {
                    const isQuiz = att.attempt_type === 'Quiz';
                    const typeBadge = isQuiz 
                        ? '<span class="badge bg-primary-subtle text-primary me-1">Quiz</span>' 
                        : '<span class="badge bg-secondary-subtle text-secondary me-1">Practice</span>';

                    let scoreBadge = '';
                    if (isQuiz) {
                        const pct = Number(att.percentage) || 0;
                        const badgeColor = pct >= 80 ? 'bg-success' : (pct >= 60 ? 'bg-primary' : 'bg-warning text-dark');
                        scoreBadge = `<span class="badge ${badgeColor}">${pct}%</span>`;
                    } else {
                        scoreBadge = App.getRatingBadge(att.rating || att.average_rating);
                    }

                    const actionBtn = isQuiz
                        ? `<a href="/quiz.html" class="btn btn-sm btn-outline-primary">Take Quiz</a>`
                        : `<a href="/attempts.html?id=${att.id}" class="btn btn-sm btn-outline-secondary">Review</a>`;

                    return `
                        <tr>
                            <td class="fw-medium">
                                ${typeBadge}
                                ${App.escapeHtml(att.title || att.role_name || 'Practice Session')}
                            </td>
                            <td class="small text-muted">${App.formatDate(att.started_at)}</td>
                            <td>
                                <span class="badge bg-light text-dark border">
                                    ${att.completed_questions || 0} / ${att.total_questions || 0}
                                </span>
                            </td>
                            <td>${scoreBadge}</td>
                            <td>${actionBtn}</td>
                        </tr>
                    `;
                }).join('');
            } else {
                attemptsTable.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center py-4 text-muted">
                            No test attempts yet. <a href="/quiz.html" class="text-primary fw-medium">Take a Topic Quiz</a> or <a href="/practice.html" class="text-primary fw-medium">Start Practice Session</a>!
                        </td>
                    </tr>
                `;
            }
        }

        // Render Recent Bookmarks
        const bookmarksContainer = document.getElementById('recent-bookmarks-list');
        if (bookmarksContainer) {
            if (data.recentBookmarks && data.recentBookmarks.length > 0) {
                bookmarksContainer.innerHTML = data.recentBookmarks.map(bm => `
                    <div class="p-2 mb-2 border rounded bg-white">
                        <div class="d-flex justify-content-between align-items-start mb-1">
                            <span class="badge bg-secondary-subtle text-secondary small">${App.escapeHtml(bm.role_name)} &bull; ${App.escapeHtml(bm.skill_name)}</span>
                            ${App.getDifficultyBadge(bm.difficulty)}
                        </div>
                        <p class="small text-dark mb-2 text-truncate" title="${App.escapeHtml(bm.question_text)}">
                            ${App.escapeHtml(bm.question_text)}
                        </p>
                        <div class="d-flex justify-content-end">
                            <a href="/practice.html?question_id=${bm.id}" class="btn btn-sm btn-outline-primary py-0 px-2" style="font-size: 0.8rem;">Practice</a>
                        </div>
                    </div>
                `).join('');
            } else {
                bookmarksContainer.innerHTML = `
                    <div class="text-center py-4 text-muted">
                        No bookmarked questions yet. Browse the <a href="/questions.html" class="text-primary">Question Bank</a> to bookmark questions for revision.
                    </div>
                `;
            }
        }
    } catch (err) {
        console.error(err);
        App.showToast('Failed to load dashboard statistics.', 'error');
    }
}
