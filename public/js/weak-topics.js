/**
 * Weak Topic Analysis & Personalised Practice Logic
 */

let weakSkillsList = [];
let personalisedQuestions = [];

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    if (!App.requireAuth()) return;

    document.getElementById('btn-practice-weak-topics')?.addEventListener('click', () => {
        if (weakSkillsList.length === 0) {
            App.showToast('No weak topics currently identified.', 'info');
            return;
        }
        const skillIds = weakSkillsList.map(s => s.skill_id).join(',');
        window.location.href = `/practice.html?skill_id=${weakSkillsList[0].skill_id}`;
    });

    document.getElementById('btn-start-personalised-session')?.addEventListener('click', () => {
        if (personalisedQuestions.length === 0) {
            App.showToast('No questions available for recommendation.', 'warning');
            return;
        }
        const ids = personalisedQuestions.map(q => q.id).join(',');
        window.location.href = `/practice.html?ids=${ids}`;
    });

    await loadWeakTopics();
    await loadPersonalisedQuestions();
});

async function loadWeakTopics() {
    const tbody = document.getElementById('topics-analysis-tbody');
    const banner = document.getElementById('weak-topics-summary-banner');
    const bannerText = document.getElementById('banner-text');

    try {
        const res = await fetch('/api/analytics/weak-topics');
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to load topic analysis.');
        }

        weakSkillsList = data.weak_topics || [];
        const allTopics = data.all_topics || [];

        if (allTopics.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5 text-muted">
                        <h5>No Attempt Data Available Yet</h5>
                        <p class="mb-3">Take a practice session and self-evaluate your answers to generate your weak-topic report.</p>
                        <a href="/practice.html" class="btn btn-primary btn-sm">Start Practice Session</a>
                    </td>
                </tr>
            `;
            banner.classList.add('d-none');
            return;
        }

        if (weakSkillsList.length > 0) {
            banner.classList.remove('d-none');
            const weakNames = weakSkillsList.map(s => s.skill_name).join(', ');
            bannerText.innerHTML = `You have <strong>${weakSkillsList.length}</strong> focus topic(s) needing attention: <strong>${App.escapeHtml(weakNames)}</strong>. Suggested targeted practice is recommended below.`;
        } else {
            banner.classList.remove('d-none');
            banner.className = 'alert alert-success border shadow-sm mb-4';
            bannerText.innerHTML = `Great work! All your evaluated topics currently meet the target rating threshold (&ge; 2.5/4).`;
            document.getElementById('btn-practice-weak-topics').classList.add('d-none');
        }

        tbody.innerHTML = allTopics.map(t => {
            const isWeak = t.is_weak;
            const avg = Number(t.average_rating);
            let ratingColor = 'text-success';
            if (avg < 2.0) ratingColor = 'text-danger fw-bold';
            else if (avg < 3.0) ratingColor = 'text-warning fw-bold';

            const statusBadge = isWeak
                ? '<span class="badge bg-danger">Needs Practice</span>'
                : '<span class="badge bg-success">Proficient</span>';

            return `
                <tr>
                    <td class="fw-bold text-dark">${App.escapeHtml(t.skill_name)}</td>
                    <td>${t.attempts_count}</td>
                    <td>${t.questions_attempted}</td>
                    <td class="${ratingColor} fs-6">${avg.toFixed(1)} / 4.0</td>
                    <td>${statusBadge}</td>
                    <td>
                        <span class="badge bg-light text-dark border">
                            ${t.suggested_practice_count} questions
                        </span>
                    </td>
                    <td>
                        <a href="/practice.html?skill_id=${t.skill_id}" class="btn btn-sm ${isWeak ? 'btn-danger' : 'btn-outline-primary'}">
                            Practice This Topic
                        </a>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (err) {
        console.error(err);
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center py-4 text-danger">
                    Failed to calculate topic analytics. Please try again.
                </td>
            </tr>
        `;
    }
}

async function loadPersonalisedQuestions() {
    const container = document.getElementById('personalised-questions-container');
    try {
        const res = await fetch('/api/analytics/personalised');
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to load recommendations.');
        }

        personalisedQuestions = data.questions || [];

        if (personalisedQuestions.length === 0) {
            container.innerHTML = `
                <div class="card p-4 text-center text-muted">
                    No personalized recommendations found. Browse the <a href="/questions.html" class="text-primary">Question Bank</a> to practice available questions.
                </div>
            `;
            document.getElementById('btn-start-personalised-session').disabled = true;
            return;
        }

        document.getElementById('btn-start-personalised-session').disabled = false;

        container.innerHTML = personalisedQuestions.map((q, idx) => `
            <div class="card mb-3 card-hover border">
                <div class="card-body">
                    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                            <span class="badge bg-primary-subtle text-primary border">Recommendation #${idx + 1}</span>
                            <span class="badge bg-light text-dark border">${App.escapeHtml(q.role_name)}</span>
                            <span class="badge bg-light text-dark border">${App.escapeHtml(q.skill_name)}</span>
                            ${App.getDifficultyBadge(q.difficulty)}
                        </div>
                        <span class="badge bg-info-subtle text-dark border">
                            ${App.escapeHtml(q.recommendation_reason)}
                        </span>
                    </div>
                    <h5 class="card-title fw-bold text-dark mb-2">${App.escapeHtml(q.question_text)}</h5>
                    <div class="d-flex justify-content-between align-items-center mt-3 pt-2 border-top">
                        <span class="small text-muted">
                            ${q.expected_keywords ? `Keywords: ${App.escapeHtml(q.expected_keywords)}` : ''}
                        </span>
                        <a href="/practice.html?question_id=${q.id}" class="btn btn-sm btn-outline-primary">
                            Practice This Now
                        </a>
                    </div>
                </div>
            </div>
        `).join('');

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                Failed to load personalised practice questions.
            </div>
        `;
    }
}
