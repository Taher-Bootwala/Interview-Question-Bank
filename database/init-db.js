const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function initDB() {
    console.log('--- Initializing MySQL Database ---');
    const {
        DB_HOST = 'localhost',
        DB_PORT = 3306,
        DB_USER = 'root',
        DB_PASSWORD = '',
        DB_NAME = 'interview_practice'
    } = process.env;

    let connection;
    try {
        // Connect to server without database to create it if not exists
        connection = await mysql.createConnection({
            host: DB_HOST,
            port: Number(DB_PORT),
            user: DB_USER,
            password: DB_PASSWORD,
            multipleStatements: true
        });

        console.log(`Connected to MySQL server at ${DB_HOST}:${DB_PORT}`);

        // Create Database and use it
        await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
        await connection.query(`USE \`${DB_NAME}\`;`);
        console.log(`Database '${DB_NAME}' created or verified.`);

        // Read and execute schema.sql
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
        await connection.query(schemaSQL);
        console.log('Database tables successfully verified/created.');

        // Seed default Admin and User if not already present
        const [adminRows] = await connection.query('SELECT id FROM users WHERE email = ?', ['admin@example.com']);
        if (adminRows.length === 0) {
            const adminPassHash = await bcrypt.hash('AdminPassword123', 10);
            await connection.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['System Administrator', 'admin@example.com', adminPassHash, 'admin']
            );
            console.log('Default Admin created: admin@example.com / AdminPassword123');
        }

        const [userRows] = await connection.query('SELECT id FROM users WHERE email = ?', ['user@example.com']);
        if (userRows.length === 0) {
            const userPassHash = await bcrypt.hash('UserPassword123', 10);
            await connection.query(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                ['Sample Student', 'user@example.com', userPassHash, 'user']
            );
            console.log('Default User created: user@example.com / UserPassword123');
        }

        // Seed default Roles
        const defaultRoles = [
            'Frontend Developer',
            'Backend Developer',
            'Full Stack Developer',
            'Java Developer',
            'Python Developer',
            'Android Developer',
            'Software Tester'
        ];
        for (const roleName of defaultRoles) {
            await connection.query('INSERT IGNORE INTO interview_roles (name) VALUES (?)', [roleName]);
        }
        console.log('Default interview roles verified.');

        // Seed default Skills
        const defaultSkills = [
            'HTML',
            'CSS',
            'JavaScript',
            'Bootstrap',
            'Node.js',
            'Express.js',
            'Java',
            'Python',
            'SQL',
            'OOP',
            'Data Structures',
            'DBMS'
        ];
        for (const skillName of defaultSkills) {
            await connection.query('INSERT IGNORE INTO skills (name) VALUES (?)', [skillName]);
        }
        console.log('Default skills verified.');

        // Fetch IDs for roles and skills
        const [roles] = await connection.query('SELECT id, name FROM interview_roles');
        const [skills] = await connection.query('SELECT id, name FROM skills');
        const roleMap = {};
        roles.forEach(r => { roleMap[r.name] = r.id; });
        const skillMap = {};
        skills.forEach(s => { skillMap[s.name] = s.id; });

        // Check if questions exist
        const [qCount] = await connection.query('SELECT COUNT(*) as count FROM questions');
        if (qCount[0].count === 0) {
            console.log('Seeding initial questions...');
            const starterQuestions = [
                {
                    role: 'Frontend Developer',
                    skill: 'JavaScript',
                    difficulty: 'Medium',
                    question_text: 'What is the difference between let, var, and const in JavaScript?',
                    model_answer: 'var is function-scoped and hoisted with undefined initialization. let and const are block-scoped and live in the Temporal Dead Zone (TDZ) before declaration. let permits reassignment, whereas const enforces constant binding and cannot be reassigned.',
                    expected_keywords: 'scope, hoisting, temporal dead zone, reassignment, block scope',
                    points: [
                        'var is function-scoped, whereas let and const are block-scoped.',
                        'var declarations are hoisted and initialized to undefined.',
                        'let and const are hoisted but remain in the Temporal Dead Zone (TDZ).',
                        'var allows redeclaration in the same scope, let and const do not.',
                        'let variables can be reassigned; const identifiers cannot be reassigned after declaration.'
                    ]
                },
                {
                    role: 'Frontend Developer',
                    skill: 'JavaScript',
                    difficulty: 'Easy',
                    question_text: 'Explain the concept of closures in JavaScript with an example.',
                    model_answer: 'A closure is the combination of a function bundled together with references to its surrounding lexical environment. In JavaScript, closures give an inner function access to an outer function’s scope even after the outer function has finished executing.',
                    expected_keywords: 'closure, lexical environment, inner function, scope chain, encapsulation',
                    points: [
                        'Inner functions retain access to outer function variables even after execution finishes.',
                        'Helps in data hiding, encapsulation, and creating private variables.',
                        'Commonly used in event listeners, callbacks, and factory functions.',
                        'Maintains state across multiple invocations.'
                    ]
                },
                {
                    role: 'Frontend Developer',
                    skill: 'HTML',
                    difficulty: 'Easy',
                    question_text: 'What are semantic HTML tags and why should you use them?',
                    model_answer: 'Semantic HTML tags clearly describe their meaning to both the browser and developer (e.g., <header>, <nav>, <main>, <article>, <section>, <footer>) instead of generic <div> or <span>. They improve accessibility for screen readers and boost SEO ranking.',
                    expected_keywords: 'semantic tags, accessibility, screen readers, SEO, document structure',
                    points: [
                        'Tags like <header>, <article>, <section>, <footer> provide semantic meaning.',
                        'Enhance web accessibility (a11y) and screen-reader navigation.',
                        'Improve search engine optimization (SEO) by defining clear content structure.',
                        'Makes code cleaner, more readable, and easier to maintain.'
                    ]
                },
                {
                    role: 'Frontend Developer',
                    skill: 'CSS',
                    difficulty: 'Medium',
                    question_text: 'What is the CSS Box Model and what are its components?',
                    model_answer: 'The CSS Box Model is a container that wraps around every HTML element. It consists of four distinct layers from inside out: Content, Padding, Border, and Margin. Understanding box-sizing: border-box is essential for calculating element dimensions accurately.',
                    expected_keywords: 'content, padding, border, margin, box-sizing, border-box',
                    points: [
                        'Content: The actual text, image, or media content.',
                        'Padding: Transparent area surrounding the content inside the border.',
                        'Border: Line wrapping around the padding and content.',
                        'Margin: Clear space outside the border separating elements from neighbors.',
                        'box-sizing: border-box includes padding and border within the specified width and height.'
                    ]
                },
                {
                    role: 'Frontend Developer',
                    skill: 'Bootstrap',
                    difficulty: 'Easy',
                    question_text: 'How does the Bootstrap 5 Grid System work?',
                    model_answer: 'Bootstrap’s grid system uses containers, rows, and columns to layout and align content. It is built with flexbox and allows up to 12 columns across a page with responsive breakpoints (xs, sm, md, lg, xl, xxl).',
                    expected_keywords: 'container, row, column, 12 columns, breakpoints, flexbox',
                    points: [
                        'Based on a 12-column responsive layout.',
                        'Uses .container or .container-fluid, followed by .row and .col-* classes.',
                        'Built on CSS Flexbox for automatic alignment and equal height columns.',
                        'Supports responsive breakpoints from extra small (xs) to extra extra large (xxl).'
                    ]
                },
                {
                    role: 'Backend Developer',
                    skill: 'Node.js',
                    difficulty: 'Medium',
                    question_text: 'Explain the Node.js Event Loop and non-blocking I/O.',
                    model_answer: 'Node.js operates on a single-threaded event loop that handles asynchronous operations using libuv. When non-blocking I/O tasks (file reading, network queries) are initiated, they are offloaded to worker threads or OS kernel. Once completed, their callbacks are queued in phases (timers, poll, check) and executed by the event loop.',
                    expected_keywords: 'event loop, single-threaded, libuv, call stack, callback queue, non-blocking I/O',
                    points: [
                        'Node.js runs single-threaded for JS execution but delegates I/O to libuv thread pool.',
                        'Non-blocking I/O ensures operations do not freeze the main thread.',
                        'The event loop continuously monitors the Call Stack and Callback Queues.',
                        'Phases include Timers, I/O callbacks, Idle/Prepare, Poll, Check (setImmediate), and Close callbacks.',
                        'Microtasks (process.nextTick and Promise callbacks) execute immediately after the current phase.'
                    ]
                },
                {
                    role: 'Backend Developer',
                    skill: 'Express.js',
                    difficulty: 'Easy',
                    question_text: 'What is middleware in Express.js and what parameters does it accept?',
                    model_answer: 'Middleware functions are functions that have access to the request object (req), response object (res), and the next middleware function in the application’s request-response cycle. They can execute code, modify req/res, end the cycle, or call next() to pass control.',
                    expected_keywords: 'req, res, next, request-response cycle, pipeline, error handling',
                    points: [
                        'Receives req, res, and next as arguments.',
                        'Can modify request and response objects or perform logging/authentication.',
                        'Must call next() to pass control to the subsequent middleware or handler.',
                        'Can terminate the request cycle by sending a response (res.send/res.json).',
                        'Error-handling middleware takes four arguments: (err, req, res, next).'
                    ]
                },
                {
                    role: 'Backend Developer',
                    skill: 'SQL',
                    difficulty: 'Medium',
                    question_text: 'What is the difference between INNER JOIN, LEFT JOIN, and RIGHT JOIN in SQL?',
                    model_answer: 'An INNER JOIN returns only records that have matching values in both tables. A LEFT JOIN returns all rows from the left table and matched rows from the right table (NULL where no match). A RIGHT JOIN returns all rows from the right table and matched rows from the left table.',
                    expected_keywords: 'inner join, left join, right join, matching records, null values, cartesian',
                    points: [
                        'INNER JOIN returns rows only when there is a match in both joined tables.',
                        'LEFT JOIN (LEFT OUTER JOIN) retains all rows from the left table, populating right table columns with NULL if no match.',
                        'RIGHT JOIN retains all rows from the right table, populating left table columns with NULL if unmatched.',
                        'FULL OUTER JOIN combines both LEFT and RIGHT join results.',
                        'Proper indexes on foreign keys significantly optimize join performance.'
                    ]
                },
                {
                    role: 'Full Stack Developer',
                    skill: 'OOP',
                    difficulty: 'Medium',
                    question_text: 'What are the four pillars of Object-Oriented Programming (OOP)?',
                    model_answer: 'The four fundamental pillars of OOP are Encapsulation (bundling data and methods while restricting direct access), Abstraction (hiding implementation details and showing only essentials), Inheritance (acquiring properties and behaviors from a parent class), and Polymorphism (ability of an entity to take multiple forms through overloading or overriding).',
                    expected_keywords: 'encapsulation, abstraction, inheritance, polymorphism, classes, objects',
                    points: [
                        'Encapsulation: Bundles data and methods into a single unit and hides internal state using access specifiers.',
                        'Abstraction: Exposes high-level functionality while hiding complex internal mechanics.',
                        'Inheritance: Enables code reusability by allowing child classes to derive properties from a parent class.',
                        'Polymorphism: Allows identical method names to behave differently depending on the invoking object (method overriding and overloading).'
                    ]
                },
                {
                    role: 'Full Stack Developer',
                    skill: 'DBMS',
                    difficulty: 'Hard',
                    question_text: 'What are ACID properties in database management systems?',
                    model_answer: 'ACID properties ensure database transaction reliability: Atomicity (all operations succeed or all fail together), Consistency (transactions preserve database invariants and constraints), Isolation (concurrent transactions execute independently without interfering), and Durability (committed changes persist even in system crashes).',
                    expected_keywords: 'atomicity, consistency, isolation, durability, transactions, rollback, commit',
                    points: [
                        'Atomicity: Entire transaction succeeds or is completely rolled back (All-or-Nothing).',
                        'Consistency: Transaction brings database from one valid state to another, respecting all constraints.',
                        'Isolation: Prevents dirty reads, non-repeatable reads, and phantom reads in concurrent environments.',
                        'Durability: Committed transactions are permanently recorded in non-volatile storage.',
                        'Implemented via write-ahead logging (WAL) and locking mechanisms.'
                    ]
                },
                {
                    role: 'Python Developer',
                    skill: 'Python',
                    difficulty: 'Easy',
                    question_text: 'What is the difference between lists and tuples in Python?',
                    model_answer: 'Lists are mutable sequences defined with square brackets [], meaning elements can be added, updated, or removed after creation. Tuples are immutable sequences defined with parentheses (), cannot be modified after creation, use less memory, and can be used as dictionary keys.',
                    expected_keywords: 'mutable, immutable, lists, tuples, memory efficiency, hashable',
                    points: [
                        'Lists are mutable; elements can be modified in-place.',
                        'Tuples are immutable; once instantiated, their elements cannot be changed.',
                        'Tuples consume less memory and offer faster iteration than lists.',
                        'Because tuples are immutable and hashable, they can serve as dictionary keys, whereas lists cannot.'
                    ]
                },
                {
                    role: 'Java Developer',
                    skill: 'Java',
                    difficulty: 'Medium',
                    question_text: 'What is the difference between == and .equals() in Java?',
                    model_answer: 'In Java, the == operator is a reference equality comparison that checks whether two variable references point to the exact same memory address. The .equals() method is designed to evaluate logical value or content equality, which can be overridden in custom classes.',
                    expected_keywords: 'reference equality, memory address, content equality, equals method, override',
                    points: [
                        '== tests primitive values for equality or object references for identical heap memory location.',
                        '.equals() checks logical or semantic content equivalence between objects.',
                        'The Object class default .equals() implementation behaves like == until overridden.',
                        'String class overrides .equals() to compare character-by-character values.',
                        'Whenever overriding equals(), hashCode() must also be overridden.'
                    ]
                },
                {
                    role: 'Software Tester',
                    skill: 'Data Structures',
                    difficulty: 'Easy',
                    question_text: 'What is the difference between a Stack and a Queue data structure?',
                    model_answer: 'A Stack follows the Last-In-First-Out (LIFO) order where insertion and deletion occur at the top. A Queue follows the First-In-First-Out (FIFO) order where insertion occurs at the rear and deletion happens at the front.',
                    expected_keywords: 'LIFO, FIFO, push, pop, enqueue, dequeue, top, front, rear',
                    points: [
                        'Stack follows Last-In-First-Out (LIFO); Queue follows First-In-First-Out (FIFO).',
                        'Stack operations are push() and pop() at one end (top).',
                        'Queue operations are enqueue() at rear and dequeue() from front.',
                        'Stack is used in function call stacks and undo mechanisms; Queue is used in scheduling and printer buffers.'
                    ]
                }
            ];

            for (const item of starterQuestions) {
                const roleId = roleMap[item.role];
                const skillId = skillMap[item.skill];
                if (roleId && skillId) {
                    const [res] = await connection.query(
                        `INSERT INTO questions (role_id, skill_id, difficulty, question_text, model_answer, expected_keywords, status)
                         VALUES (?, ?, ?, ?, ?, ?, 'active')`,
                        [roleId, skillId, item.difficulty, item.question_text, item.model_answer, item.expected_keywords]
                    );
                    const qId = res.insertId;
                    for (const pt of item.points) {
                        await connection.query(
                            'INSERT INTO answer_points (question_id, point_text) VALUES (?, ?)',
                            [qId, pt]
                        );
                    }
                }
            }
            console.log(`Successfully seeded ${starterQuestions.length} starter questions with model answer points.`);
        } else {
            console.log(`Questions table already contains ${qCount[0].count} questions.`);
        }

        // Check quiz_questions table
        const [quizQCount] = await connection.query('SELECT COUNT(*) as count FROM quiz_questions');
        if (quizQCount[0].count === 0) {
            console.log('Seeding quiz_questions table from questions.txt...');
            const uploadQuestions = require('./upload-questions');
            await uploadQuestions();
        } else {
            console.log(`quiz_questions table already contains ${quizQCount[0].count} questions.`);
        }

        console.log('Database initialization completed successfully.');
    } catch (err) {
        console.error('Database initialization failed:', err);
        process.exit(1);
    } finally {
        if (connection) await connection.end();
    }
}

if (require.main === module) {
    initDB();
}

module.exports = initDB;
