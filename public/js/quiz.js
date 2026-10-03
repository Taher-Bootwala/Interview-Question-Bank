/**
 * Topic Quiz Client Engine
 * Handles Subject/Topic dynamic loading, multiple-choice quiz flow,
 * instant answer validation, scoring, and history tracking.
 * Strictly NO emojis.
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements - Setup
    const setupView = document.getElementById('quiz-setup-view');
    const selectSubject = document.getElementById('select-subject');
    const selectTopic = document.getElementById('select-topic');
    const topicHelpText = document.getElementById('topic-help-text');
    const btnStartQuiz = document.getElementById('btn-start-quiz');

    // DOM Elements - Active Quiz
    const activeView = document.getElementById('quiz-active-view');
    const badgeSubject = document.getElementById('quiz-badge-subject');
    const badgeTopic = document.getElementById('quiz-badge-topic');
    const currentNumSpan = document.getElementById('quiz-current-num');
    const totalNumSpan = document.getElementById('quiz-total-num');
    const timerText = document.getElementById('quiz-timer-text');
    const progressBar = document.getElementById('quiz-progress-bar');
    const questionTextEl = document.getElementById('quiz-question-text');
    const optionsContainer = document.getElementById('quiz-options-container');
    const feedbackBox = document.getElementById('quiz-feedback-box');
    const feedbackTitle = document.getElementById('quiz-feedback-title');
    const feedbackText = document.getElementById('quiz-feedback-text');
    const btnCheckAnswer = document.getElementById('btn-check-answer');
    const btnNextQuestion = document.getElementById('btn-next-question');
    const btnFinishQuiz = document.getElementById('btn-finish-quiz');
    const btnQuitQuiz = document.getElementById('btn-quit-quiz');

    // DOM Elements - Results
    const resultsView = document.getElementById('quiz-results-view');
    const resultScore = document.getElementById('quiz-result-score');
    const resultTotal = document.getElementById('quiz-result-total');
    const resultPercentage = document.getElementById('quiz-result-percentage');
    const resultBadge = document.getElementById('quiz-result-badge');
    const resultFeedback = document.getElementById('quiz-result-feedback');
    const reviewList = document.getElementById('quiz-review-list');
    const btnRetakeQuiz = document.getElementById('btn-retake-quiz');
    const btnNewQuiz = document.getElementById('btn-new-quiz');

    // DOM Elements - History
    const historyCard = document.getElementById('quiz-history-card');
    const historyTbody = document.getElementById('quiz-history-tbody');
    const historyCount = document.getElementById('quiz-history-count');

    // State Variables
    let currentSubject = '';
    let currentTopic = '';
    let quizQuestions = [];
    let currentQuestionIndex = 0;
    let selectedOptionId = null;
    let userAnswers = []; // { question_id, question_text, selected_option, correct_option, is_correct, explanation }
    let timerInterval = null;
    let secondsElapsed = 0;

    // Initialize Page
    initQuizPage();

    async function initQuizPage() {
        await App.init();
        if (!App.user) {
            const guestAlert = document.getElementById('quiz-guest-warning');
            if (guestAlert) guestAlert.classList.remove('d-none');
        }
        await loadSubjects();
        await loadHistory();
        setupEventListeners();
    }

    function setupEventListeners() {
        // Subject change
        selectSubject.addEventListener('change', async (e) => {
            currentSubject = e.target.value;
            if (currentSubject) {
                try { localStorage.setItem('quiz_preferred_subject', currentSubject); } catch (_) {}
                await loadTopics(currentSubject);
            } else {
                selectTopic.innerHTML = '<option value="" disabled selected>Select a subject first</option>';
                selectTopic.disabled = true;
                btnStartQuiz.disabled = true;
            }
        });

        // Topic change
        selectTopic.addEventListener('change', (e) => {
            currentTopic = e.target.value;
            btnStartQuiz.disabled = !currentTopic;
            if (currentTopic) {
                try { localStorage.setItem('quiz_preferred_topic', currentTopic); } catch (_) {}
            }
        });

        // Radio question count change
        document.querySelectorAll('input[name="quiz-count"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    try { localStorage.setItem('quiz_preferred_count', e.target.value); } catch (_) {}
                }
            });
        });

        // Start Quiz
        btnStartQuiz.addEventListener('click', startQuizSession);

        // Check Answer
        btnCheckAnswer.addEventListener('click', handleCheckAnswer);

        // Next Question
        btnNextQuestion.addEventListener('click', handleNextQuestion);

        // Finish Quiz
        btnFinishQuiz.addEventListener('click', handleFinishQuiz);

        // Exit Quiz
        btnQuitQuiz.addEventListener('click', () => {
            if (confirm('Are you sure you want to exit the current quiz? Progress will not be saved.')) {
                stopTimer();
                showSetupView();
            }
        });

        // Retake Quiz
        btnRetakeQuiz.addEventListener('click', () => {
            startQuizSession();
        });

        // New Quiz Topic
        btnNewQuiz.addEventListener('click', () => {
            showSetupView();
        });
    }

    /**
     * Load subjects from API
     */
    async function loadSubjects() {
        try {
            selectSubject.innerHTML = '<option value="" disabled selected>Loading subjects...</option>';
            const res = await fetch('/api/quiz/subjects');
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data)) {
                throw new Error(data.message || 'Failed to load subjects.');
            }

            selectSubject.innerHTML = '<option value="" disabled selected>-- Choose a Subject --</option>';
            data.data.forEach(sub => {
                const opt = document.createElement('option');
                opt.value = sub.name;
                opt.textContent = `${sub.name} (${sub.topicCount} Topics - ${sub.questionCount} Questions)`;
                selectSubject.appendChild(opt);
            });
            selectSubject.disabled = false;

            // Restore user preference from LocalStorage if available
            try {
                const savedSubject = localStorage.getItem('quiz_preferred_subject');
                if (savedSubject && data.data.some(s => s.name === savedSubject)) {
                    selectSubject.value = savedSubject;
                    currentSubject = savedSubject;
                    await loadTopics(savedSubject);
                }

                const savedCount = localStorage.getItem('quiz_preferred_count');
                if (savedCount) {
                    const countRadio = document.querySelector(`input[name="quiz-count"][value="${savedCount}"]`);
                    if (countRadio) countRadio.checked = true;
                }
            } catch (storageErr) {
                console.warn('LocalStorage not accessible:', storageErr);
            }
        } catch (err) {
            console.error('Error loading subjects:', err);
            selectSubject.innerHTML = '<option value="" disabled selected>Failed to load subjects</option>';
        }
    }

    /**
     * Load topics for chosen subject
     */
    async function loadTopics(subjectName) {
        try {
            selectTopic.disabled = true;
            selectTopic.innerHTML = '<option value="" disabled selected>Loading topics...</option>';
            btnStartQuiz.disabled = true;

            const res = await fetch(`/api/quiz/topics?subject=${encodeURIComponent(subjectName)}`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data)) {
                throw new Error(data.message || 'Failed to load topics.');
            }

            selectTopic.innerHTML = '<option value="" disabled selected>-- Choose a Topic --</option>';
            data.data.forEach(top => {
                const opt = document.createElement('option');
                opt.value = top.name;
                opt.textContent = `${top.name} (${top.questionCount} Questions)`;
                selectTopic.appendChild(opt);
            });

            selectTopic.disabled = false;
            topicHelpText.textContent = `${data.data.length} topics available for ${subjectName}.`;
        } catch (err) {
            console.error('Error loading topics:', err);
            selectTopic.innerHTML = '<option value="" disabled selected>Failed to load topics</option>';
            topicHelpText.textContent = 'Error loading topics. Please try again.';
        }
    }

    /**
     * Start Quiz Session
     */
    async function startQuizSession() {
        const selectedCountInput = document.querySelector('input[name="quiz-count"]:checked');
        const count = selectedCountInput ? selectedCountInput.value : 5;

        if (!currentSubject || !currentTopic) {
            alert('Please select both a subject and a topic.');
            return;
        }

        try {
            btnStartQuiz.disabled = true;
            btnStartQuiz.textContent = 'Loading Questions...';

            const res = await fetch(`/api/quiz/questions?subject=${encodeURIComponent(currentSubject)}&topic=${encodeURIComponent(currentTopic)}&limit=${count}`);
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                alert('No questions available for this topic. Please select another topic.');
                btnStartQuiz.disabled = false;
                btnStartQuiz.textContent = 'Start Quiz';
                return;
            }

            quizQuestions = data.data;
            currentQuestionIndex = 0;
            userAnswers = [];
            selectedOptionId = null;

            // Switch to Active View
            setupView.classList.add('d-none');
            resultsView.classList.add('d-none');
            if (historyCard) historyCard.classList.add('d-none');
            activeView.classList.remove('d-none');

            // Set Meta info
            badgeSubject.textContent = currentSubject;
            badgeTopic.textContent = currentTopic;
            totalNumSpan.textContent = quizQuestions.length;

            startTimer();
            renderQuestion(currentQuestionIndex);
        } catch (err) {
            console.error('Error starting quiz:', err);
            alert('An error occurred while loading quiz questions.');
        } finally {
            btnStartQuiz.disabled = false;
            btnStartQuiz.textContent = 'Start Quiz';
        }
    }

    /**
     * Render a question by index
     */
    function renderQuestion(index) {
        const q = quizQuestions[index];
        if (!q) return;

        currentNumSpan.textContent = index + 1;
        const progressPct = Math.round(((index + 1) / quizQuestions.length) * 100);
        progressBar.style.width = `${progressPct}%`;

        questionTextEl.textContent = `${index + 1}. ${q.question_text}`;

        // Reset option container
        optionsContainer.innerHTML = '';
        selectedOptionId = null;

        q.options.forEach(opt => {
            const item = document.createElement('div');
            item.className = 'quiz-option-item';
            item.dataset.optionId = opt.id;

            item.innerHTML = `
                <div class="quiz-badge-letter">${opt.id}</div>
                <div class="quiz-option-text">${opt.text}</div>
            `;

            item.addEventListener('click', () => {
                if (item.classList.contains('locked')) return;

                // Deselect all
                document.querySelectorAll('.quiz-option-item').forEach(el => el.classList.remove('selected'));
                item.classList.add('selected');
                selectedOptionId = opt.id;
                btnCheckAnswer.disabled = false;
            });

            optionsContainer.appendChild(item);
        });

        // Hide feedback
        feedbackBox.className = 'alert d-none mb-4';
        feedbackText.textContent = '';

        // Reset buttons
        btnCheckAnswer.classList.remove('d-none');
        btnCheckAnswer.disabled = true;
        btnNextQuestion.classList.add('d-none');
        btnFinishQuiz.classList.add('d-none');
    }

    /**
     * Handle Submit Answer / Check Answer
     */
    function handleCheckAnswer() {
        if (!selectedOptionId) return;

        const q = quizQuestions[currentQuestionIndex];
        const isCorrect = (selectedOptionId === q.correct_option);

        // Lock all options
        const optionEls = document.querySelectorAll('.quiz-option-item');
        optionEls.forEach(el => {
            el.classList.add('locked');
            const optId = el.dataset.optionId;
            if (optId === q.correct_option) {
                el.classList.add('correct');
            } else if (optId === selectedOptionId && !isCorrect) {
                el.classList.add('incorrect');
            }
        });

        // Record Answer
        const chosenOptObj = q.options.find(o => o.id === selectedOptionId);
        const correctOptObj = q.options.find(o => o.id === q.correct_option);

        userAnswers.push({
            question_id: q.id,
            question_text: q.question_text,
            selected_option: selectedOptionId,
            selected_text: chosenOptObj ? chosenOptObj.text : '',
            correct_option: q.correct_option,
            correct_text: correctOptObj ? correctOptObj.text : '',
            is_correct: isCorrect,
            explanation: q.explanation || 'No explanation provided.'
        });

        // Show feedback banner
        feedbackBox.classList.remove('d-none');
        if (isCorrect) {
            feedbackBox.className = 'alert alert-success mb-4';
            feedbackTitle.textContent = 'Correct Answer';
            feedbackText.textContent = q.explanation || 'Well done! You selected the right answer.';
        } else {
            feedbackBox.className = 'alert alert-danger mb-4';
            feedbackTitle.textContent = `Incorrect Answer (Correct: Option ${q.correct_option})`;
            feedbackText.textContent = q.explanation || 'Please review the correct option and explanation above.';
        }

        // Switch action buttons
        btnCheckAnswer.classList.add('d-none');
        if (currentQuestionIndex < quizQuestions.length - 1) {
            btnNextQuestion.classList.remove('d-none');
        } else {
            btnFinishQuiz.classList.remove('d-none');
        }
    }

    /**
     * Handle Next Question
     */
    function handleNextQuestion() {
        currentQuestionIndex++;
        renderQuestion(currentQuestionIndex);
    }

    /**
     * Handle Finish Quiz & Submit to Server
     */
    async function handleFinishQuiz() {
        stopTimer();

        const totalQuestions = quizQuestions.length;
        const score = userAnswers.filter(a => a.is_correct).length;
        const percentage = Math.round((score / totalQuestions) * 100);

        // Submit to API
        try {
            await fetch('/api/quiz/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: currentSubject,
                    topic: currentTopic,
                    score,
                    total_questions: totalQuestions,
                    time_spent: secondsElapsed,
                    answers: userAnswers
                })
            });
        } catch (err) {
            console.error('Error saving quiz attempt:', err);
        }

        // Show Results View
        activeView.classList.add('d-none');
        resultsView.classList.remove('d-none');

        resultScore.textContent = score;
        resultTotal.textContent = totalQuestions;
        resultPercentage.textContent = percentage;

        if (percentage >= 80) {
            resultBadge.className = 'badge bg-success px-3 py-2 text-uppercase mb-2';
            resultBadge.textContent = 'Mastery Achieved';
            resultFeedback.textContent = 'Excellent performance! You demonstrate strong technical clarity in this topic.';
        } else if (percentage >= 60) {
            resultBadge.className = 'badge bg-primary px-3 py-2 text-uppercase mb-2';
            resultBadge.textContent = 'Good Understanding';
            resultFeedback.textContent = 'Solid effort! Review the missed questions below to sharpen your concepts.';
        } else {
            resultBadge.className = 'badge bg-warning text-dark px-3 py-2 text-uppercase mb-2';
            resultBadge.textContent = 'Needs Review';
            resultFeedback.textContent = 'This topic requires additional practice. Examine each explanation below to master key concepts.';
        }

        // Render Review Cards
        renderReviewList();

        // Refresh History Table
        await loadHistory();
    }

    /**
     * Render Detailed Review of All Questions
     */
    function renderReviewList() {
        reviewList.innerHTML = '';

        userAnswers.forEach((ans, idx) => {
            const card = document.createElement('div');
            card.className = `card border p-3 ${ans.is_correct ? 'border-success' : 'border-danger'}`;

            const statusBadge = ans.is_correct
                ? '<span class="badge bg-success">Correct</span>'
                : '<span class="badge bg-danger">Incorrect</span>';

            card.innerHTML = `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <span class="fw-bold text-dark">Question ${idx + 1}</span>
                    ${statusBadge}
                </div>
                <div class="fw-semibold mb-2">${ans.question_text}</div>
                <div class="small mb-1">
                    <strong>Your Choice:</strong> 
                    <span class="${ans.is_correct ? 'text-success fw-medium' : 'text-danger fw-medium'}">
                        Option ${ans.selected_option}: ${ans.selected_text}
                    </span>
                </div>
                ${!ans.is_correct ? `
                    <div class="small mb-2">
                        <strong>Correct Answer:</strong> 
                        <span class="text-success fw-medium">
                            Option ${ans.correct_option}: ${ans.correct_text}
                        </span>
                    </div>
                ` : ''}
                <div class="alert alert-light border mt-2 mb-0 p-2 small">
                    <strong>Explanation:</strong> ${ans.explanation}
                </div>
            `;

            reviewList.appendChild(card);
        });
    }

    /**
     * Return to Setup View
     */
    function showSetupView() {
        activeView.classList.add('d-none');
        resultsView.classList.add('d-none');
        setupView.classList.remove('d-none');
        if (historyCard) historyCard.classList.remove('d-none');
    }

    /**
     * Load User Quiz History
     */
    async function loadHistory() {
        if (!historyTbody) return;
        try {
            const res = await fetch('/api/quiz/history');
            const data = await res.json();

            if (!data.success || !Array.isArray(data.data) || data.data.length === 0) {
                historyTbody.innerHTML = `
                    <tr>
                        <td colspan="6" class="text-center text-muted py-3">
                            No quiz attempts recorded yet. Take your first quiz above!
                        </td>
                    </tr>
                `;
                if (historyCount) historyCount.textContent = '0 Recorded';
                return;
            }

            if (historyCount) historyCount.textContent = `${data.data.length} Recorded`;
            historyTbody.innerHTML = '';

            data.data.forEach(item => {
                const tr = document.createElement('tr');
                const dateStr = item.created_at ? new Date(item.created_at).toLocaleDateString() : 'Recent';
                const timeStr = formatMinutes(item.time_spent);

                let badgeClass = 'bg-secondary';
                if (item.percentage >= 80) badgeClass = 'bg-success';
                else if (item.percentage >= 60) badgeClass = 'bg-primary';
                else badgeClass = 'bg-warning text-dark';

                tr.innerHTML = `
                    <td class="fw-semibold">${item.subject}</td>
                    <td>${item.topic}</td>
                    <td>${item.score} / ${item.total_questions}</td>
                    <td><span class="badge ${badgeClass}">${item.percentage}%</span></td>
                    <td class="text-muted small">${timeStr}</td>
                    <td class="text-muted small">${dateStr}</td>
                `;
                historyTbody.appendChild(tr);
            });
        } catch (err) {
            console.error('Error loading history:', err);
            historyTbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted py-3">
                        Sign in to view your persistent quiz history across sessions.
                    </td>
                </tr>
            `;
        }
    }

    // Timer Utilities
    function startTimer() {
        stopTimer();
        secondsElapsed = 0;
        updateTimerDisplay();
        timerInterval = setInterval(() => {
            secondsElapsed++;
            updateTimerDisplay();
        }, 1000);
    }

    function stopTimer() {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    function updateTimerDisplay() {
        if (timerText) {
            timerText.textContent = formatMinutes(secondsElapsed);
        }
    }

    function formatMinutes(totalSec) {
        const sec = totalSec || 0;
        const mins = Math.floor(sec / 60);
        const remSecs = sec % 60;
        return `${mins.toString().padStart(2, '0')}:${remSecs.toString().padStart(2, '0')}`;
    }
});
