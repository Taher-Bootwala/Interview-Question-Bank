const fs = require('fs');
const path = require('path');

const questionsFilePath = path.join(__dirname, '..', '..', 'questions.txt');

// In-memory cache of parsed question bank
let parsedData = null;

function loadAndParseQuestions() {
    if (parsedData) return parsedData;

    if (!fs.existsSync(questionsFilePath)) {
        console.error('questions.txt not found at:', questionsFilePath);
        return {};
    }

    const content = fs.readFileSync(questionsFilePath, 'utf8');
    const lines = content.split('\n');

    const data = {};
    let currentSubject = '';
    let currentTopic = '';

    for (let line of lines) {
        const raw = line.trim();
        if (!raw) continue;

        if (raw.startsWith('# ') && (raw.toLowerCase().includes('question bank') || raw.toLowerCase().includes('language core'))) {
            let title = raw.replace(/^#+\s*/, '').replace(/\s*[—-]\s*\d+\s*Questions/i, '').trim();
            if (title.includes('C++')) {
                currentSubject = 'C++';
            } else if (title.includes('Java') && !title.includes('JavaScript')) {
                currentSubject = 'Java';
            } else {
                currentSubject = title.replace(/\s*Question Bank.*$/i, '').trim();
            }
            if (!data[currentSubject]) data[currentSubject] = {};
        } else if (raw.startsWith('## ') || (raw.startsWith('# ') && !raw.toLowerCase().includes('question bank'))) {
            if (currentSubject) {
                let topic = raw.replace(/^#+\s*/, '')
                               .replace(/\s*[—-].*$/, '')
                               .replace(/^\d+\.\s*/, '')
                               .trim();
                currentTopic = topic;
                if (!data[currentSubject][currentTopic]) {
                    data[currentSubject][currentTopic] = [];
                }
            }
        } else if (/^\d+\.\s+/.test(raw) && currentSubject && currentTopic) {
            const qText = raw.replace(/^\d+\.\s+/, '').trim();
            if (qText) {
                data[currentSubject][currentTopic].push(qText);
            }
        }
    }

    parsedData = data;
    console.log(`Loaded question bank: ${Object.keys(parsedData).length} subjects.`);
    return parsedData;
}

function getSubjects() {
    const data = loadAndParseQuestions();
    return Object.keys(data).map(subjectName => {
        const topics = Object.keys(data[subjectName]);
        let totalQuestions = 0;
        topics.forEach(t => totalQuestions += data[subjectName][t].length);
        return {
            name: subjectName,
            topicCount: topics.length,
            questionCount: totalQuestions
        };
    });
}

function getTopics(subjectName) {
    const data = loadAndParseQuestions();
    const subjectObj = data[subjectName];
    if (!subjectObj) return [];

    return Object.keys(subjectObj).map(topicName => ({
        name: topicName,
        questionCount: subjectObj[topicName].length
    }));
}

const { generateQuestionOptions } = require('./questionOptionRules');

/**
 * Generate 4 multiple-choice options for a specific question prompt
 */
function generateOptionsForQuestion(questionText, topicName, subjectName, questionIndex = 1) {
    return generateQuestionOptions(questionText, topicName, subjectName, questionIndex);
}

/**
 * Returns quiz questions with multiple choice options for a selected subject and topic
 */
function getQuizQuestions(subjectName, topicName, limit = 10) {
    const data = loadAndParseQuestions();
    const subjectObj = data[subjectName];
    if (!subjectObj) return [];

    let questionPool = subjectObj[topicName];
    if (!questionPool || questionPool.length === 0) {
        // Fallback to first topic if exact match not found
        const firstTopic = Object.keys(subjectObj)[0];
        questionPool = subjectObj[firstTopic] || [];
    }

    const maxLimit = Math.min(Number(limit) || 10, questionPool.length);
    const selected = questionPool.slice(0, maxLimit);

    return selected.map((qText, index) => {
        const generated = generateOptionsForQuestion(qText, topicName, subjectName, index + 1);
        return {
            id: index + 1,
            question_text: qText,
            subject: subjectName,
            topic: topicName,
            options: generated.options,
            correct_option: generated.correct_option,
            explanation: generated.explanation
        };
    });
}

module.exports = {
    loadAndParseQuestions,
    generateOptionsForQuestion,
    getSubjects,
    getTopics,
    getQuizQuestions
};

