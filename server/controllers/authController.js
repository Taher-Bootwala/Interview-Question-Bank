const bcrypt = require('bcrypt');
const db = require('../config/db');

// Regular expression for email validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function register(req, res, next) {
    try {
        const { name, email, password, confirmPassword } = req.body;

        if (!name || !email || !password || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All fields (Name, Email, Password, Confirm Password) are required.'
            });
        }

        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        if (trimmedName.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Name must be at least 2 characters long.'
            });
        }

        if (!EMAIL_REGEX.test(trimmedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address.'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long.'
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'Password and Confirm Password do not match.'
            });
        }

        // Check if email already exists
        const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [trimmedEmail]);
        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'An account with this email already exists.'
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await db.query(
            'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
            [trimmedName, trimmedEmail, hashedPassword, 'user']
        );

        const newUser = {
            id: result.insertId,
            name: trimmedName,
            email: trimmedEmail,
            role: 'user'
        };

        // Automatically log in newly registered user
        req.session.user = newUser;

        return res.status(201).json({
            success: true,
            message: 'Registration successful. Welcome to Interview Practice!',
            user: newUser
        });
    } catch (err) {
        next(err);
    }
}

async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Please provide both email and password.'
            });
        }

        const trimmedEmail = email.trim().toLowerCase();

        const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [trimmedEmail]);
        if (rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const user = rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password.'
            });
        }

        const sessionUser = {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role
        };

        req.session.user = sessionUser;

        return res.json({
            success: true,
            message: 'Login successful.',
            user: sessionUser,
            redirect: user.role === 'admin' ? '/admin/dashboard.html' : '/dashboard.html'
        });
    } catch (err) {
        next(err);
    }
}

function logout(req, res) {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: 'Failed to log out.'
            });
        }
        res.clearCookie('connect.sid');
        return res.json({
            success: true,
            message: 'Logged out successfully.'
        });
    });
}

function getMe(req, res) {
    if (req.session && req.session.user) {
        return res.json({
            success: true,
            user: req.session.user
        });
    }
    return res.status(401).json({
        success: false,
        message: 'Not logged in.'
    });
}

module.exports = {
    register,
    login,
    logout,
    getMe
};
