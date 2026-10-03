/**
 * Interactive Timed Practice Engine
 */

let attemptId = null;
let questions = [];
let currentIndex = 0;
let timeRemaining = 0;
let timerInterval = null;
let totalTimeTaken = 0;
let answersData = {}; // keyed by question.id: { user_answer, self_rating, evaluation_data, is_revealed }

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    if (!App.requireAuth()) return;

    // Attach Setup View Handlers
    document.getElementById('btn-start-session')?.addEventListener('click', () => handleSetupStart());

    // Attach Navigation and Practice Handlers
    document.getElementById('btn-prev-question')?.addEventListener('click', () => navigateQuestion(-1));
    document.getElementById('btn-next-question')?.addEventListener('click', () => navigateQuestion(1));
    document.getElementById('btn-finish-attempt')?.addEventListener('click', () => confirmFinishAttempt());
    document.getElementById('btn-reveal-answer')?.addEventListener('click', () => toggleRevealAnswer());
    document.getElementById('btn-bookmark-current')?.addEventListener('click', () => toggleBookmarkCurrent());

    // Textarea word/char count
    const answerInput = document.getElementById('user-answer-input');
    if (answerInput) {
        answerInput.addEventListener('input', () => {
            updateWordCount();
            saveCurrentStateInMemory();
        });
    }

    // Evaluation checkboxes & rating changes
    document.querySelectorAll('.eval-check').forEach(chk => {
        chk.addEventListener('change', () => {
            saveCurrentStateInMemory();
            syncQuestionWithServer();
        });
    });

    document.querySelectorAll('input[name="rating-group"]').forEach(r => {
        r.addEventListener('change', () => {
            saveCurrentStateInMemory();
            syncQuestionWithServer();
            renderNavigatorPills();
        });
    });

    // Check if URL parameters request an immediate start
    const params = new URLSearchParams(window.location.search);
    const questionId = params.get('question_id');
    const ids = params.get('ids');
    const mode = params.get('mode');
    const roleId = params.get('role_id');
    const skillId = params.get('skill_id');
    const difficulty = params.get('difficulty');

    if (questionId) {
        startPracticeSession({ question_ids: [Number(questionId)], limit: 1 });
    } else if (ids) {
        const idList = ids.split(',').map(Number).filter(n => !isNaN(n));
        startPracticeSession({ question_ids: idList });
    } else if (mode === 'bookmarks') {
        startPracticeSession({ mode: 'bookmarks', limit: 10 });
    } else if (roleId || skillId || difficulty) {
        startPracticeSession({
            role_id: roleId || undefined,
            skill_id: skillId || undefined,
            difficulty: difficulty || undefined,
            limit: 5
        });
    } else {
        // Show setup view & load dropdowns
        await loadSetupDropdowns();
    }
});

async function loadSetupDropdowns() {
    try {
        const [rolesRes, skillsRes] = await Promise.all([
            fetch('/api/roles'),
            fetch('/api/skills')
        ]);
        const rolesData = await rolesRes.json();
        const skillsData = await skillsRes.json();

        const roleSelect = document.getElementById('setup-role');
        if (rolesData.success) {
            rolesData.roles.forEach(r => {
                const opt = document.createElement('option');
                opt.value = r.id;
                opt.textContent = `${r.name} (${r.question_count || 0} questions)`;
                roleSelect.appendChild(opt);
            });
        }

        const skillSelect = document.getElementById('setup-skill');
        if (skillsData.success) {
            skillsData.skills.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = `${s.name} (${s.question_count || 0} questions)`;
                skillSelect.appendChild(opt);
            });
        }

        // Restore saved practice preferences from LocalStorage
        try {
            const savedRole = localStorage.getItem('practice_pref_role');
            if (savedRole && roleSelect) roleSelect.value = savedRole;

            const savedSkill = localStorage.getItem('practice_pref_skill');
            if (savedSkill && skillSelect) skillSelect.value = savedSkill;

            const savedDiff = localStorage.getItem('practice_pref_difficulty');
            if (savedDiff) {
                const diffSelect = document.getElementById('setup-difficulty');
                if (diffSelect) diffSelect.value = savedDiff;
            }

            const savedCount = localStorage.getItem('practice_pref_count');
            if (savedCount) {
                const countSelect = document.getElementById('setup-count');
                if (countSelect) countSelect.value = savedCount;
            }

            const savedTime = localStorage.getItem('practice_pref_time');
            if (savedTime) {
                const timeSelect = document.getElementById('setup-time');
                if (timeSelect) timeSelect.value = savedTime;
            }
        } catch (_) {}
    } catch (err) {
        console.error('Failed to load setup dropdowns:', err);
    }
}

async function handleSetupStart() {
    const roleId = document.getElementById('setup-role').value;
    const skillId = document.getElementById('setup-skill').value;
    const difficulty = document.getElementById('setup-difficulty').value;
    const limit = document.getElementById('setup-count').value;
    const timeLimitMinutes = document.getElementById('setup-time').value;

    // Save preferences in LocalStorage
    try {
        localStorage.setItem('practice_pref_role', roleId);
        localStorage.setItem('practice_pref_skill', skillId);
        localStorage.setItem('practice_pref_difficulty', difficulty);
        localStorage.setItem('practice_pref_count', limit);
        localStorage.setItem('practice_pref_time', timeLimitMinutes);
    } catch (_) {}

    const payload = {
        role_id: roleId || undefined,
        skill_id: skillId || undefined,
        difficulty: difficulty || undefined,
        limit: Number(limit) || 5,
        time_limit_minutes: Number(timeLimitMinutes) || 15
    };

    const startBtn = document.getElementById('btn-start-session');
    startBtn.disabled = true;
    startBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Preparing questions...';

    await startPracticeSession(payload);
    startBtn.disabled = false;
    startBtn.innerHTML = 'Begin Practice Session';
}

async function startPracticeSession(payload) {
    try {
        const res = await fetch('/api/attempts/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            App.showToast(data.message || 'Could not start practice session.', 'error');
            document.getElementById('setup-view').classList.remove('d-none');
            return;
        }

        attemptId = data.attemptId;
        questions = data.questions;
        timeRemaining = data.timeLimitSeconds || (questions.length * 180);
        totalTimeTaken = 0;
        currentIndex = 0;

        // Initialize answer storage
        answersData = {};
        questions.forEach(q => {
            answersData[q.id] = {
                user_answer: '',
                self_rating: null,
                evaluation_data: {
                    concept: false,
                    points: false,
                    terminology: false,
                    clarity: false,
                    missed: false
                },
                is_revealed: false
            };
        });

        // Hide setup view, show practice view
        document.getElementById('setup-view').classList.add('d-none');
        document.getElementById('complete-view').classList.add('d-none');
        document.getElementById('practice-view').classList.remove('d-none');

        // Start countdown timer
        startTimer();

        // Render first question
        renderCurrentQuestion();

    } catch (err) {
        console.error(err);
        App.showToast('Network error starting practice session.', 'error');
    }
}

function startTimer() {
    if (timerInterval) clearInterval(timerInterval);

    updateTimerDisplay();

    timerInterval = setInterval(() => {
        timeRemaining--;
        totalTimeTaken++;
        updateTimerDisplay();

        if (timeRemaining <= 0) {
            clearInterval(timerInterval);
            App.showToast('Time is up! Submitting practice session...', 'warning');
            autoSubmitOnTimeout();
        }
    }, 1000);
}

function updateTimerDisplay() {
    const mins = Math.floor(timeRemaining / 60);
    const secs = timeRemaining % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    const display = document.getElementById('timer-display');
    const container = document.getElementById('timer-container');

    if (display) display.textContent = formatted;

    if (container) {
        if (timeRemaining <= 60) {
            container.classList.add('timer-warning');
        } else {
            container.classList.remove('timer-warning');
        }
    }
}

function renderCurrentQuestion() {
    if (!questions || questions.length === 0) return;
    const q = questions[currentIndex];
    const qData = answersData[q.id];

    // Counter and Badges
    document.getElementById('q-counter-badge').textContent = `Question ${currentIndex + 1} of ${questions.length}`;
    document.getElementById('q-role-badge').textContent = q.role_name;
    document.getElementById('q-skill-badge').textContent = q.skill_name;
    document.getElementById('q-diff-badge').innerHTML = App.getDifficultyBadge(q.difficulty);

    // Question Text
    document.getElementById('practice-q-text').textContent = q.question_text;

    // User Answer Textarea
    const answerInput = document.getElementById('user-answer-input');
    if (!qData.user_answer) {
        try {
            const draft = localStorage.getItem('practice_draft_answer_' + q.id);
            if (draft) qData.user_answer = draft;
        } catch (_) {}
    }
    answerInput.value = qData.user_answer || '';
    updateWordCount();

    // Model Answer Details
    document.getElementById('model-answer-text').textContent = q.model_answer;

    const pointsList = document.getElementById('model-points-list');
    if (q.points && q.points.length > 0) {
        pointsList.innerHTML = q.points.map(pt => `<li>${App.escapeHtml(pt)}</li>`).join('');
    } else {
        pointsList.innerHTML = '<li class="text-muted">No additional points recorded.</li>';
    }

    const keywordsCloud = document.getElementById('expected-keywords-cloud');
    if (q.expected_keywords) {
        keywordsCloud.innerHTML = q.expected_keywords.split(',').map(k => 
            `<span class="badge">${App.escapeHtml(k.trim())}</span>`
        ).join('');
    } else {
        keywordsCloud.innerHTML = '<span class="text-muted small">None specified</span>';
    }

    // Restore Checklist & Ratings
    document.getElementById('eval-concept').checked = !!qData.evaluation_data.concept;
    document.getElementById('eval-points').checked = !!qData.evaluation_data.points;
    document.getElementById('eval-terminology').checked = !!qData.evaluation_data.terminology;
    document.getElementById('eval-clarity').checked = !!qData.evaluation_data.clarity;
    document.getElementById('eval-missed').checked = !!qData.evaluation_data.missed;

    document.querySelectorAll('input[name="rating-group"]').forEach(r => {
        r.checked = (qData.self_rating !== null && Number(r.value) === Number(qData.self_rating));
    });

    // Check revealed state
    const revealedSection = document.getElementById('revealed-section');
    const revealBtn = document.getElementById('btn-reveal-answer');
    if (qData.is_revealed) {
        revealedSection.classList.remove('d-none');
        revealBtn.textContent = 'Hide Model Answer';
    } else {
        revealedSection.classList.add('d-none');
        revealBtn.textContent = 'Reveal Model Answer & Evaluation Rubric';
    }

    // Navigation buttons state
    document.getElementById('btn-prev-question').disabled = (currentIndex === 0);
    const nextBtn = document.getElementById('btn-next-question');
    if (currentIndex === questions.length - 1) {
        nextBtn.classList.add('d-none');
    } else {
        nextBtn.classList.remove('d-none');
    }

    renderNavigatorPills();
}

function renderNavigatorPills() {
    const container = document.getElementById('question-navigator-pills');
    if (!container) return;

    container.innerHTML = questions.map((q, idx) => {
        const isCurrent = (idx === currentIndex);
        const hasRated = answersData[q.id] && answersData[q.id].self_rating;
        const hasAnswer = answersData[q.id] && answersData[q.id].user_answer && answersData[q.id].user_answer.trim().length > 0;

        let btnClass = 'btn-outline-secondary';
        if (isCurrent) {
            btnClass = 'btn-primary text-white';
        } else if (hasRated) {
            btnClass = 'btn-success text-white';
        } else if (hasAnswer) {
            btnClass = 'btn-info text-dark';
        }

        return `
            <button type="button" class="btn btn-sm ${btnClass} px-2 py-1" onclick="jumpToQuestion(${idx})">
                ${idx + 1}
            </button>
        `;
    }).join('');
}

window.jumpToQuestion = function(index) {
    if (index >= 0 && index < questions.length) {
        saveCurrentStateInMemory();
        syncQuestionWithServer();
        currentIndex = index;
        renderCurrentQuestion();
    }
};

function navigateQuestion(step) {
    saveCurrentStateInMemory();
    syncQuestionWithServer();

    const target = currentIndex + step;
    if (target >= 0 && target < questions.length) {
        currentIndex = target;
        renderCurrentQuestion();
    }
}

function saveCurrentStateInMemory() {
    if (!questions || questions.length === 0) return;
    const q = questions[currentIndex];
    const answerText = document.getElementById('user-answer-input').value;

    const checkedRating = document.querySelector('input[name="rating-group"]:checked');
    const selfRating = checkedRating ? Number(checkedRating.value) : null;

    const evalData = {
        concept: document.getElementById('eval-concept').checked,
        points: document.getElementById('eval-points').checked,
        terminology: document.getElementById('eval-terminology').checked,
        clarity: document.getElementById('eval-clarity').checked,
        missed: document.getElementById('eval-missed').checked
    };

    answersData[q.id].user_answer = answerText;
    answersData[q.id].self_rating = selfRating;
    answersData[q.id].evaluation_data = evalData;

    try {
        if (answerText && answerText.trim().length > 0) {
            localStorage.setItem('practice_draft_answer_' + q.id, answerText);
        } else {
            localStorage.removeItem('practice_draft_answer_' + q.id);
        }
    } catch (_) {}
}

async function syncQuestionWithServer() {
    if (!attemptId || !questions || questions.length === 0) return;
    const q = questions[currentIndex];
    const qData = answersData[q.id];

    try {
        await fetch(`/api/attempts/${attemptId}/save-question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question_id: q.id,
                user_answer: qData.user_answer,
                self_rating: qData.self_rating,
                evaluation_data: qData.evaluation_data
            })
        });
    } catch (err) {
        console.error('Failed to sync question answer:', err);
    }
}

function toggleRevealAnswer() {
    const q = questions[currentIndex];
    const revealedSection = document.getElementById('revealed-section');
    const revealBtn = document.getElementById('btn-reveal-answer');

    if (answersData[q.id].is_revealed) {
        answersData[q.id].is_revealed = false;
        revealedSection.classList.add('d-none');
        revealBtn.textContent = 'Reveal Model Answer & Evaluation Rubric';
    } else {
        answersData[q.id].is_revealed = true;
        revealedSection.classList.remove('d-none');
        revealBtn.textContent = 'Hide Model Answer';
    }
}

async function toggleBookmarkCurrent() {
    const q = questions[currentIndex];
    try {
        const res = await fetch('/api/bookmarks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ question_id: q.id })
        });
        const data = await res.json();
        if (data.success) {
            App.showToast(data.message, 'success');
            document.getElementById('btn-bookmark-current').textContent = 'Bookmarked';
        }
    } catch (err) {
        console.error(err);
        App.showToast('Failed to bookmark question.', 'error');
    }
}

function updateWordCount() {
    const text = document.getElementById('user-answer-input').value.trim();
    const words = text.length === 0 ? 0 : text.split(/\s+/).length;
    const chars = text.length;
    document.getElementById('word-char-count').textContent = `${words} words | ${chars} chars`;
}

function confirmFinishAttempt() {
    saveCurrentStateInMemory();

    // Check if any question has not been evaluated
    let unratedCount = 0;
    questions.forEach(q => {
        if (!answersData[q.id] || answersData[q.id].self_rating === null) {
            unratedCount++;
        }
    });

    let message = 'Are you ready to submit and complete this practice session?';
    if (unratedCount > 0) {
        message = `You have ${unratedCount} question(s) without a self-rating. Do you still wish to submit?`;
    }

    if (confirm(message)) {
        finishPracticeSession();
    }
}

async function autoSubmitOnTimeout() {
    saveCurrentStateInMemory();
    await syncQuestionWithServer();
    await finishPracticeSession();
}

async function finishPracticeSession() {
    if (timerInterval) clearInterval(timerInterval);

    // Save final active question
    await syncQuestionWithServer();

    try {
        const res = await fetch(`/api/attempts/${attemptId}/finish`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                total_time: totalTimeTaken,
                status: 'completed'
            })
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to complete session.');
        }

        // Clear drafts from LocalStorage
        questions.forEach(q => {
            try { localStorage.removeItem('practice_draft_answer_' + q.id); } catch (_) {}
        });

        // Show Summary View
        document.getElementById('practice-view').classList.add('d-none');
        document.getElementById('complete-view').classList.remove('d-none');

        document.getElementById('res-total-q').textContent = data.summary.totalQuestions;
        document.getElementById('res-completed-q').textContent = data.summary.completedQuestions;
        document.getElementById('res-avg-rating').textContent = data.summary.averageRating 
            ? `${data.summary.averageRating} / 4` 
            : 'N/A';

        document.getElementById('btn-view-detailed-review').href = `/attempts.html?id=${attemptId}`;

        App.showToast('Practice session saved successfully!', 'success');

    } catch (err) {
        console.error(err);
        App.showToast('Error saving attempt results.', 'error');
    }
}
