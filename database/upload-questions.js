/**
 * Database Migration Script: Upload All Questions to MySQL
 * Reads questions.txt, parses subjects and topics, generates 4 MC options,
 * and bulk uploads all 3,015 questions into the `quiz_questions` table in MySQL.
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const quizService = require('../server/services/quizService');

async function uploadQuestionsToDatabase() {
    console.log('=== UPLOADING QUESTIONS TO MYSQL DATABASE ===\n');

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

    console.log(`Connected to MySQL database '${DB_NAME}' at ${DB_HOST}:${DB_PORT}`);

    // Ensure quiz_questions table exists
    await connection.query(`
        CREATE TABLE IF NOT EXISTS quiz_questions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            subject VARCHAR(100) NOT NULL,
            topic VARCHAR(150) NOT NULL,
            question_text TEXT NOT NULL,
            option_a TEXT NOT NULL,
            option_b TEXT NOT NULL,
            option_c TEXT NOT NULL,
            option_d TEXT NOT NULL,
            correct_option CHAR(1) NOT NULL,
            explanation TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_qq_subject (subject),
            INDEX idx_qq_topic (topic),
            INDEX idx_qq_sub_top (subject, topic)
        ) ENGINE=InnoDB;
    `);

    // Parse questions from questions.txt
    const parsedData = quizService.loadAndParseQuestions();
    const subjects = Object.keys(parsedData);
    console.log(`Parsed ${subjects.length} subjects from questions.txt`);

    // Flatten all questions with generated options
    const rowsToInsert = [];

    for (const subject of subjects) {
        const topics = Object.keys(parsedData[subject]);
        for (const topic of topics) {
            const questionList = parsedData[subject][topic];
            questionList.forEach((qText, qIdx) => {
                // Generate 4 multiple-choice options, correct option, and explanation with index rotation
                const gen = quizService.generateOptionsForQuestion(qText, topic, subject, qIdx + 1);
                
                const optA = gen.options.find(o => o.id === 'A')?.text || '';
                const optB = gen.options.find(o => o.id === 'B')?.text || '';
                const optC = gen.options.find(o => o.id === 'C')?.text || '';
                const optD = gen.options.find(o => o.id === 'D')?.text || '';

                rowsToInsert.push([
                    subject,
                    topic,
                    qText,
                    optA,
                    optB,
                    optC,
                    optD,
                    gen.correct_option,
                    gen.explanation
                ]);
            });
        }
    }

    console.log(`Total questions prepared for MySQL upload: ${rowsToInsert.length}`);

    // Clear existing questions to prevent duplicates on rerun
    await connection.query('TRUNCATE TABLE quiz_questions;');
    console.log('Cleared existing rows in quiz_questions table.');

    // Batch insert (250 questions per batch for optimal performance)
    const batchSize = 250;
    let insertedCount = 0;

    for (let i = 0; i < rowsToInsert.length; i += batchSize) {
        const batch = rowsToInsert.slice(i, i + batchSize);
        const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
        const flatValues = batch.flat();

        const sql = `
            INSERT INTO quiz_questions 
            (subject, topic, question_text, option_a, option_b, option_c, option_d, correct_option, explanation)
            VALUES ${placeholders}
        `;

        await connection.query(sql, flatValues);
        insertedCount += batch.length;
        process.stdout.write(`Uploaded ${insertedCount} / ${rowsToInsert.length} questions...\r`);
    }

    console.log(`\n\nSUCCESS: Uploaded all ${insertedCount} questions to MySQL quiz_questions table!`);

    // Verify row count and subject distribution in MySQL
    const [stats] = await connection.query(`
        SELECT subject, COUNT(DISTINCT topic) AS topics, COUNT(*) AS total_questions 
        FROM quiz_questions 
        GROUP BY subject 
        ORDER BY total_questions DESC;
    `);

    console.log('\n--- MySQL Database Question Distribution ---');
    console.table(stats);

    await connection.end();
    console.log('Database connection closed.');
}

if (require.main === module) {
    uploadQuestionsToDatabase()
        .then(() => process.exit(0))
        .catch(err => {
            console.error('Migration failed:', err);
            process.exit(1);
        });
}

module.exports = uploadQuestionsToDatabase;
