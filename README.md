# Interview Practice Question Bank

An interactive, responsive, and robust web application designed for students and job seekers to prepare for technical interviews based on their targeted role, skill, and difficulty level.

Built with **HTML5, CSS3, Bootstrap 5, Vanilla JavaScript (DOM & Fetch API), Node.js, Express.js, and MySQL**.

---

## 🌟 Key Features

1. **Role & Skill-Based Question Bank**:
   - Filter interview questions by targeted job roles (Frontend, Backend, Full Stack, Java, Python, Tester), topics (JavaScript, SQL, OOP, DBMS, HTML, CSS, etc.), and difficulty levels (Easy, Medium, Hard).
   - Real-time keyword search and question preview.

2. **Interactive Timed Practice Module**:
   - Practice questions one-at-a-time with an active JavaScript countdown timer.
   - Built-in text editor with real-time word and character counters.
   - Reveal detailed **Model Answers**, **Model Answer Bullet Points**, and **Expected Technical Keywords** side-by-side with your typed response.
   - Objective **Self-Evaluation Rubric Checklist** and 4-point rating scale (`1-Poor`, `2-Average`, `3-Good`, `4-Excellent`).
   - Auto-submits and saves attempts when the countdown timer expires.

3. **Bookmarks**:
   - Save challenging questions for quick revision with duplicate prevention.
   - Launch custom practice sessions exclusively with bookmarked questions.

4. **Attempt History & Review**:
   - Detailed history of all completed and in-progress practice sessions.
   - Full review modal showing past answers, model answers, rubric checklist selections, and self-ratings.

5. **Weak-Topic Analysis (No Black-Box AI/ML)**:
   - Transparent analytics calculated via SQL aggregation and user self-ratings.
   - Identifies skills where average self-ratings drop below the proficiency threshold (&le; 2.5 / 4.0).
   - Calculates suggested practice quotas and offers one-click targeted drills.

6. **Personalised Practice Engine**:
   - Dynamically recommends questions prioritizing unattempted questions from weak topics, low-rated attempts, and saved bookmarks.

7. **Comprehensive Admin Panel**:
   - Secure role-based authorization for administrative users (`role = 'admin'`).
   - Full CRUD operations for Questions (with dynamic model answer bullet points), Roles, and Skills.
   - System-wide metrics dashboard, user account management, and attempt tracking.

---

## 🛠️ Technology Stack

- **Frontend**:
  - HTML5 & CSS3
  - Bootstrap 5 (Responsive Layout, Modals, Forms, Badges, Tables, Navbars)
  - Vanilla JavaScript (Event Listeners, DOM Manipulation, Fetch API)
- **Backend**:
  - Node.js & Express.js
  - Express-Session for session-based user authentication
  - bcrypt for password hashing
- **Database**:
  - MySQL with `mysql2/promise` connection pooling and parameterized queries
- **Architecture**:
  - MVC / Layered architecture (Controllers, Middleware, Routes, Database Pool)

---

## 📂 Project Structure

```
interview-practice-question-bank/
├── server/
│   ├── config/
│   │   └── db.js                 # MySQL connection pool
│   ├── middleware/
│   │   ├── auth.js               # Session & admin authorization
│   │   └── errorHandler.js       # Centralized error handler
│   ├── controllers/
│   │   ├── authController.js     # User registration, login, logout
│   │   ├── questionController.js # Question retrieval and CRUD
│   │   ├── roleController.js     # Interview roles CRUD
│   │   ├── skillController.js    # Skills/topics CRUD
│   │   ├── bookmarkController.js # Bookmark management
│   │   ├── attemptController.js  # Practice session orchestration
│   │   ├── dashboardController.js# User & Admin statistics
│   │   └── analyticsController.js# Weak-topic analysis & personalized recommendations
│   ├── routes/                   # Express REST API routes
│   ├── app.js                    # Express app configuration & middleware
│   └── server.js                 # HTTP server entry point
├── public/
│   ├── index.html                # Landing page
│   ├── login.html                # Login screen
│   ├── register.html             # User registration
│   ├── dashboard.html            # Student dashboard
│   ├── questions.html            # Question bank browser & filters
│   ├── practice.html             # Timed interactive practice module
│   ├── bookmarks.html            # Saved bookmarks page
│   ├── attempts.html             # Practice attempt history & review
│   ├── weak-topics.html          # Performance analysis & recommendations
│   ├── admin/
│   │   ├── dashboard.html        # Admin metrics & analytics
│   │   ├── questions.html        # Admin question CRUD
│   │   ├── roles.html            # Admin roles CRUD
│   │   ├── skills.html           # Admin skills CRUD
│   │   ├── users.html            # Registered users list
│   │   └── attempts.html         # All user attempts viewer
│   ├── css/
│   │   └── style.css             # Professional custom styling
│   └── js/
│       ├── main.js               # Common app utilities & navbar
│       ├── auth.js               # Login/Register validation & handlers
│       ├── dashboard.js          # Student dashboard logic
│       ├── questions.js          # Question browsing & bookmarking
│       ├── practice.js           # Timed practice engine
│       ├── bookmarks.js          # Bookmarks viewer & practice launcher
│       ├── attempts.js           # Attempt history & modal review
│       ├── weak-topics.js        # Analytics calculation & recommendations
│       └── admin.js              # Admin CRUD and dashboard operations
├── database/
│   ├── schema.sql                # Complete relational MySQL schema
│   ├── init-db.js                # Database creation & seeder script
│   └── import-dataset.js         # Flexible dataset JSON importer
├── .env                          # Environment variables
├── .env.example                  # Template configuration
├── package.json
└── README.md
```

---

## 🚀 Installation & Setup Instructions

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **MySQL Server** (MySQL 8.0 or MariaDB via XAMPP/WAMP)

### 2. Clone / Open Project
Open a terminal in the project directory:
```bash
cd "d:\GTU\Degree\Sem_5\Manuals\WAD\Prac_12 mini project"
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Configure Environment Variables
Verify or update `.env` in the root directory:
```env
PORT=3000
SESSION_SECRET=interview_secret_key_session_2026_secured

# MySQL Connection Details
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=interview_practice
```

### 5. Initialize the MySQL Database
Run the automated initialization script to create the `interview_practice` database, tables, default user accounts, roles, skills, and starter questions:
```bash
npm run init-db
```

### 6. Start the Web Server
```bash
npm start
```
Or for auto-reloading in development:
```bash
npm run dev
```

Visit the application in your browser:
👉 **`http://localhost:3000`**

---

## 🔑 Default Accounts

| Role | Email | Password | Access |
|---|---|---|---|
| **Administrator** | `admin@example.com` | `AdminPassword123` | Full Admin Console & Student Features |
| **Student / User** | `user@example.com` | `UserPassword123` | Student Dashboard & Practice Modules |

---

## 📥 Importing Your Custom Question Dataset

When you have a question dataset file, you can import it into MySQL using the included import utility.

### Supported JSON Format (`database/dataset.json` or custom path):
```json
[
  {
    "role": "Frontend Developer",
    "skill": "JavaScript",
    "difficulty": "Medium",
    "question_text": "What is the difference between let, var and const in JavaScript?",
    "model_answer": "var is function-scoped while let and const are block-scoped...",
    "expected_keywords": "scope, hoisting, temporal dead zone, reassignment",
    "points": [
      "var is function-scoped, let/const are block-scoped.",
      "let can be reassigned; const cannot be reassigned.",
      "let/const live in temporal dead zone before declaration."
    ]
  }
]
```

### Run the Import Command:
```bash
node database/import-dataset.js [path-to-your-dataset.json]
```
The importer automatically creates any new roles and skills as needed and associates all answer points with foreign keys.

---

## 📡 REST API Summary

### Authentication
- `POST /api/auth/register` - Create student account
- `POST /api/auth/login` - Authenticate user & start session
- `POST /api/auth/logout` - Destroy session
- `GET /api/auth/me` - Get current session user

### Questions & Bank
- `GET /api/questions` - List questions with filters (`role_id`, `skill_id`, `difficulty`, `search`, `status`)
- `GET /api/questions/:id` - Get question with model answer points
- `POST /api/questions` *(Admin)* - Create new question with points
- `PUT /api/questions/:id` *(Admin)* - Update question & points
- `DELETE /api/questions/:id` *(Admin)* - Soft archive or permanent delete

### Practice Attempts
- `POST /api/attempts/start` - Initialize mock practice attempt with timer
- `POST /api/attempts/:id/save-question` - Save answer, self-rating & evaluation rubric
- `POST /api/attempts/:id/finish` - Complete attempt & calculate time
- `GET /api/attempts` - List user practice history
- `GET /api/attempts/:id` - Detailed review of an attempt

### Bookmarks & Analytics
- `GET /api/bookmarks` - View bookmarked questions
- `POST /api/bookmarks` - Save bookmark (duplicate safe)
- `DELETE /api/bookmarks/:questionId` - Remove bookmark
- `GET /api/analytics/weak-topics` - Performance analysis per topic
- `GET /api/practice/personalised` - Smart question recommendations
