/**
 * Dataset Importer for Interview Practice Question Bank
 * Supports importing question data from a JSON file.
 * Usage: node database/import-dataset.js [path-to-json-file]
 * 
 * Expected JSON Format:
 * [
 *   {
 *     "role": "Frontend Developer",
 *     "skill": "JavaScript",
 *     "difficulty": "Medium",
 *     "question_text": "...",
 *     "model_answer": "...",
 *     "expected_keywords": "keyword1, keyword2",
 *     "points": ["Point 1", "Point 2", "Point 3"]
 *   }
 * ]
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function importDataset() {
    const inputFilePath = process.argv[2] || path.join(__dirname, 'dataset.json');

    if (!fs.existsSync(inputFilePath)) {
        console.log(`[Notice] Dataset file not found at: ${inputFilePath}`);
        console.log('To import questions, supply a valid JSON file:');
        console.log('node database/import-dataset.js <path-to-file.json>');
        return;
    }

    console.log(`Reading dataset from ${inputFilePath}...`);
    let data;
    try {
        const raw = fs.readFileSync(inputFilePath, 'utf8');
        data = JSON.parse(raw);
        if (!Array.isArray(data)) {
            throw new Error('Dataset root must be an array of question objects.');
        }
    } catch (e) {
        console.error('Error reading/parsing JSON dataset:', e.message);
        process.exit(1);
    }

    const {
        DB_HOST = 'localhost',
        DB_PORT = 3306,
        DB_USER = 'root',
        DB_PASSWORD = '',
        DB_NAME = 'interview_practice'
    } = process.env;

    const connection = await mysql.createConnection({
        host: DB_HOST,
        port: Number(DB_PORT),
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    });

    console.log(`Connected to MySQL database ${DB_NAME}. Importing ${data.length} records...`);

    let importedCount = 0;
    for (const item of data) {
        const roleName = (item.role || item.role_name || 'General').trim();
        const skillName = (item.skill || item.topic || item.skill_name || 'General').trim();
        const difficulty = ['Easy', 'Medium', 'Hard'].includes(item.difficulty) ? item.difficulty : 'Medium';
        const questionText = item.question || item.question_text || item.title || '';
        const modelAnswer = item.model_answer || item.answer || '';
        const expectedKeywords = Array.isArray(item.expected_keywords) 
            ? item.expected_keywords.join(', ') 
            : (item.expected_keywords || '');

        if (!questionText || !modelAnswer) {
            console.warn('Skipping item missing question_text or model_answer:', item);
            continue;
        }

        // Upsert Role
        await connection.query('INSERT IGNORE INTO interview_roles (name) VALUES (?)', [roleName]);
        const [[roleRow]] = await connection.query('SELECT id FROM interview_roles WHERE name = ?', [roleName]);

        // Upsert Skill
        await connection.query('INSERT IGNORE INTO skills (name) VALUES (?)', [skillName]);
        const [[skillRow]] = await connection.query('SELECT id FROM skills WHERE name = ?', [skillName]);

        // Insert Question
        const [qRes] = await connection.query(
            `INSERT INTO questions (role_id, skill_id, difficulty, question_text, model_answer, expected_keywords, status)
             VALUES (?, ?, ?, ?, ?, ?, 'active')`,
            [roleRow.id, skillRow.id, difficulty, questionText, modelAnswer, expectedKeywords]
        );
        const questionId = qRes.insertId;

        // Insert Points
        const points = Array.isArray(item.points || item.model_answer_points) 
            ? (item.points || item.model_answer_points)
            : [];
        for (const pt of points) {
            if (pt && typeof pt === 'string' && pt.trim()) {
                await connection.query(
                    'INSERT INTO answer_points (question_id, point_text) VALUES (?, ?)',
                    [questionId, pt.trim()]
                );
            }
        }
        importedCount++;
    }

    console.log(`Successfully imported ${importedCount} questions with points.`);
    await connection.end();
}

if (require.main === module) {
    importDataset();
}

module.exports = importDataset;
