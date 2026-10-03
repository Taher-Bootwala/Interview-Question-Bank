/**
 * Automated Verification Test Suite
 * Tests all endpoints: Auth, Questions, Filters, Bookmarks, Practice, Self-Evaluation,
 * Weak Topics, Personalised Practice, and Admin Operations.
 */

const http = require('http');

function request(options, data = null, cookie = '') {
    return new Promise((resolve, reject) => {
        const headers = { ...options.headers };
        if (cookie) headers['Cookie'] = cookie;
        if (data) {
            headers['Content-Type'] = 'application/json';
        }

        const req = http.request({
            hostname: 'localhost',
            port: 3000,
            path: options.path,
            method: options.method || 'GET',
            headers
        }, (res) => {
            let body = '';
            const setCookieHeader = res.headers['set-cookie'];
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch {
                    parsed = body;
                }
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    cookies: setCookieHeader,
                    body: parsed
                });
            });
        });

        req.on('error', reject);
        if (data) req.write(JSON.stringify(data));
        req.end();
    });
}

function extractCookie(res) {
    if (!res.cookies) return '';
    const cookieStr = Array.isArray(res.cookies) ? res.cookies[0] : res.cookies;
    return cookieStr.split(';')[0];
}

async function runTests() {
    console.log('=== STARTING TEST SUITE FOR INTERVIEW PRACTICE QUESTION BANK ===\n');
    let passed = 0;
    let failed = 0;

    function assert(condition, testName) {
        if (condition) {
            console.log(`[PASS] ${testName}`);
            passed++;
        } else {
            console.error(`[FAIL] ${testName}`);
            failed++;
        }
    }

    try {
        // 1. Test Static files
        const indexRes = await request({ path: '/index.html' });
        assert(indexRes.statusCode === 200, 'Serve landing page (index.html)');

        // 2. Test Invalid Login
        const badLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
            email: 'wrong@example.com',
            password: 'badpassword'
        });
        assert(badLogin.statusCode === 401 && badLogin.body.success === false, 'Invalid login rejected (401)');

        // 3. Test Student Login
        const userLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
            email: 'user@example.com',
            password: 'UserPassword123'
        });
        assert(userLogin.statusCode === 200 && userLogin.body.success === true, 'Student login successful');
        const userCookie = extractCookie(userLogin);

        // 4. Test Student Auth Status
        const userMe = await request({ path: '/api/auth/me' }, null, userCookie);
        assert(userMe.body.user && userMe.body.user.role === 'user', 'Check session for student (/api/auth/me)');

        // 5. Test Non-Admin blocked from Admin endpoint
        const adminBlock = await request({ path: '/api/dashboard/admin' }, null, userCookie);
        assert(adminBlock.statusCode === 403, 'Normal student forbidden from admin endpoints (403)');

        // 6. Test Admin Login
        const adminLogin = await request({ path: '/api/auth/login', method: 'POST' }, {
            email: 'admin@example.com',
            password: 'AdminPassword123'
        });
        assert(adminLogin.statusCode === 200 && adminLogin.body.user.role === 'admin', 'Admin login successful');
        const adminCookie = extractCookie(adminLogin);

        // 7. Test Admin Dashboard Access
        const adminDash = await request({ path: '/api/dashboard/admin' }, null, adminCookie);
        assert(adminDash.body.success === true && adminDash.body.stats.totalQuestions > 0, 'Admin dashboard stats returned');

        // 8. Test Questions API & Filtering
        const allQuestions = await request({ path: '/api/questions' });
        assert(allQuestions.body.success === true && allQuestions.body.questions.length > 0, `Fetch questions bank (found ${allQuestions.body.questions.length})`);

        const filterSkill = await request({ path: '/api/questions?skill_id=3' }); // JavaScript
        assert(filterSkill.body.success === true, 'Filter questions by skill');

        const searchKeyword = await request({ path: '/api/questions?search=closure' });
        assert(searchKeyword.body.success === true && searchKeyword.body.questions.length >= 1, 'Search questions by keyword');

        // 9. Test Bookmarks
        const firstQId = allQuestions.body.questions[0].id;
        const addBm = await request({ path: '/api/bookmarks', method: 'POST' }, { question_id: firstQId }, userCookie);
        assert(addBm.statusCode === 201 || (addBm.statusCode === 200 && addBm.body.is_bookmarked), 'Add bookmark');

        const getBms = await request({ path: '/api/bookmarks' }, null, userCookie);
        assert(getBms.body.bookmarks.some(b => b.id === firstQId), 'Verify bookmarked question appears in bookmarks list');

        // 10. Test Practice Attempt Workflow
        const startAttempt = await request({ path: '/api/attempts/start', method: 'POST' }, {
            limit: 2
        }, userCookie);
        assert(startAttempt.statusCode === 201 && startAttempt.body.questions.length > 0, 'Start mock practice attempt');
        const attemptId = startAttempt.body.attemptId;
        const practiceQ = startAttempt.body.questions[0];

        // 11. Save Question Answer & Self-Evaluation
        const saveQ = await request({ path: `/api/attempts/${attemptId}/save-question`, method: 'POST' }, {
            question_id: practiceQ.id,
            user_answer: 'My test student explanation for this question.',
            self_rating: 2, // Rating 2 (Average) for weak topic test
            evaluation_data: {
                concept: true,
                points: true,
                terminology: false,
                clarity: true,
                missed: true
            }
        }, userCookie);
        assert(saveQ.body.success === true, 'Save answer and self-evaluation to MySQL');

        // 12. Finish Practice Attempt
        const finishAttempt = await request({ path: `/api/attempts/${attemptId}/finish`, method: 'POST' }, {
            total_time: 75,
            status: 'completed'
        }, userCookie);
        assert(finishAttempt.body.success === true && finishAttempt.body.summary.completedQuestions >= 1, 'Complete practice attempt with timing and rating');

        // 13. Test Attempt Details
        const attemptDetails = await request({ path: `/api/attempts/${attemptId}` }, null, userCookie);
        assert(attemptDetails.body.attempt.questions.length >= 1 && attemptDetails.body.attempt.questions[0].self_rating === 2, 'Fetch attempt review with recorded answer & rating');

        // 14. Test Weak Topic Analytics
        const weakTopics = await request({ path: '/api/analytics/weak-topics' }, null, userCookie);
        assert(weakTopics.body.success === true && weakTopics.body.all_topics.length > 0, 'Calculate weak-topic analysis from attempt history');

        // 15. Test Personalised Practice Recommendation
        const personalised = await request({ path: '/api/practice/personalised' }, null, userCookie);
        assert(personalised.body.success === true && personalised.body.questions.length > 0, 'Generate personalised practice recommendations');

        // 16. Test Admin Role CRUD
        const newRole = await request({ path: '/api/roles', method: 'POST' }, { name: 'DevOps Engineer ' + Date.now() }, adminCookie);
        assert(newRole.statusCode === 201, 'Admin create new role');
        const roleId = newRole.body.role.id;

        const updateRole = await request({ path: `/api/roles/${roleId}`, method: 'PUT' }, { name: 'Senior DevOps ' + Date.now() }, adminCookie);
        assert(updateRole.statusCode === 200, 'Admin update role');

        const deleteRole = await request({ path: `/api/roles/${roleId}`, method: 'DELETE' }, null, adminCookie);
        assert(deleteRole.statusCode === 200, 'Admin delete role');

        // 17. Test Admin Skill CRUD
        const newSkill = await request({ path: '/api/skills', method: 'POST' }, { name: 'Kubernetes ' + Date.now() }, adminCookie);
        assert(newSkill.statusCode === 201, 'Admin create new skill');
        const skillId = newSkill.body.skill.id;

        const deleteSkill = await request({ path: `/api/skills/${skillId}`, method: 'DELETE' }, null, adminCookie);
        assert(deleteSkill.statusCode === 200, 'Admin delete skill');

        // 18. Test Admin Question CRUD
        const newQuestion = await request({ path: '/api/questions', method: 'POST' }, {
            role_id: 1,
            skill_id: 3,
            difficulty: 'Hard',
            question_text: 'Explain Prototypes and Prototypal Inheritance in JavaScript.',
            model_answer: 'Every JavaScript object has an internal hidden prototype property pointing to another object or null. Properties are looked up along the prototype chain.',
            expected_keywords: 'prototype, prototype chain, __proto__, Object.create',
            status: 'active',
            points: [
                'Objects inherit properties via prototype chain.',
                'Object.getPrototypeOf() inspects the prototype.',
                'The chain terminates at Object.prototype whose prototype is null.'
            ]
        }, adminCookie);
        assert(newQuestion.statusCode === 201, 'Admin create question with model answer points');
        const createdQId = newQuestion.body.questionId;

        const updateQuestion = await request({ path: `/api/questions/${createdQId}`, method: 'PUT' }, {
            role_id: 1,
            skill_id: 3,
            difficulty: 'Hard',
            question_text: 'Explain Prototypes and Prototypal Inheritance in JavaScript (Updated).',
            model_answer: 'Updated model answer explanation.',
            expected_keywords: 'prototype, prototype chain, inheritance',
            status: 'active',
            points: ['Point 1 updated', 'Point 2 updated']
        }, adminCookie);
        assert(updateQuestion.statusCode === 200, 'Admin update question and points');

        const deleteQuestion = await request({ path: `/api/questions/${createdQId}?permanent=true`, method: 'DELETE' }, null, adminCookie);
        assert(deleteQuestion.statusCode === 200, 'Admin delete question');

        // Quiz System Tests
        const quizSubjects = await request({ path: '/api/quiz/subjects', method: 'GET' });
        assert(quizSubjects.statusCode === 200 && quizSubjects.body.count >= 10, 'Fetch quiz subjects from questions.txt (10 subjects)');

        const quizTopics = await request({ path: '/api/quiz/topics?subject=DBMS', method: 'GET' });
        assert(quizTopics.statusCode === 200 && quizTopics.body.count >= 10, 'Fetch quiz topics for DBMS');

        const quizQuestions = await request({ path: '/api/quiz/questions?subject=DBMS&topic=ACID%20Properties&limit=5', method: 'GET' });
        assert(quizQuestions.statusCode === 200 && quizQuestions.body.count === 5 && quizQuestions.body.data[0].options.length === 4, 'Fetch 5 quiz questions with 4 options and explanation');

        const quizSubmit = await request({ path: '/api/quiz/submit', method: 'POST' }, {
            subject: 'DBMS',
            topic: 'ACID Properties',
            score: 5,
            total_questions: 5,
            time_spent: 42,
            answers: [
                { question_id: 1, selected_option: 'A', correct_option: 'A' },
                { question_id: 2, selected_option: 'A', correct_option: 'A' },
                { question_id: 3, selected_option: 'A', correct_option: 'A' },
                { question_id: 4, selected_option: 'C', correct_option: 'C' },
                { question_id: 5, selected_option: 'D', correct_option: 'D' }
            ]
        }, userCookie);
        assert(quizSubmit.statusCode === 201 && quizSubmit.body.data.percentage === 100, 'Submit quiz attempt and verify 100% calculation');

        const quizHistory = await request({ path: '/api/quiz/history', method: 'GET' }, null, userCookie);
        assert(quizHistory.statusCode === 200 && quizHistory.body.data.length >= 1, 'Fetch student quiz history');

        console.log(`\n========================================`);
        console.log(`TOTAL TESTS: ${passed + failed}`);
        console.log(`PASSED: ${passed}`);
        console.log(`FAILED: ${failed}`);
        console.log(`========================================\n`);

    } catch (e) {
        console.error('Fatal error during test suite:', e);
    }
}

runTests();
