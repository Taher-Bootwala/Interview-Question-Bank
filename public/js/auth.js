/**
 * Authentication Form Handlers & Validation
 */

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();

    // If user is already logged in, redirect away from login/register
    if (App.user) {
        if (App.user.role === 'admin') {
            window.location.href = '/admin/dashboard.html';
        } else {
            window.location.href = '/dashboard.html';
        }
        return;
    }

    // Login Form Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('login-alert');
            const submitBtn = document.getElementById('btn-submit');
            alertBox.classList.add('d-none');

            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');

            const email = emailInput.value.trim();
            const password = passwordInput.value;

            // Simple validation
            let isValid = true;
            if (!email || !email.includes('@')) {
                emailInput.classList.add('is-invalid');
                isValid = false;
            } else {
                emailInput.classList.remove('is-invalid');
            }

            if (!password) {
                passwordInput.classList.add('is-invalid');
                isValid = false;
            } else {
                passwordInput.classList.remove('is-invalid');
            }

            if (!isValid) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Logging in...';

            try {
                const res = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    App.showToast('Login successful!', 'success');
                    // Check URL params for redirect
                    const urlParams = new URLSearchParams(window.location.search);
                    const redirectUrl = urlParams.get('redirect') || data.redirect || '/dashboard.html';
                    setTimeout(() => {
                        window.location.href = redirectUrl;
                    }, 400);
                } else {
                    alertBox.textContent = data.message || 'Login failed. Please check your credentials.';
                    alertBox.classList.remove('d-none');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Login';
                }
            } catch (err) {
                console.error(err);
                alertBox.textContent = 'Network or server error occurred. Please try again.';
                alertBox.classList.remove('d-none');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
            }
        });
    }

    // Register Form Handler
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const alertBox = document.getElementById('register-alert');
            const submitBtn = document.getElementById('btn-submit');
            alertBox.classList.add('d-none');

            const nameInput = document.getElementById('name');
            const emailInput = document.getElementById('email');
            const passwordInput = document.getElementById('password');
            const confirmInput = document.getElementById('confirmPassword');

            const name = nameInput.value.trim();
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            const confirmPassword = confirmInput.value;

            let isValid = true;

            if (!name || name.length < 2) {
                nameInput.classList.add('is-invalid');
                isValid = false;
            } else {
                nameInput.classList.remove('is-invalid');
            }

            if (!email || !email.includes('@')) {
                emailInput.classList.add('is-invalid');
                isValid = false;
            } else {
                emailInput.classList.remove('is-invalid');
            }

            if (!password || password.length < 6) {
                passwordInput.classList.add('is-invalid');
                isValid = false;
            } else {
                passwordInput.classList.remove('is-invalid');
            }

            if (password !== confirmPassword) {
                confirmInput.classList.add('is-invalid');
                isValid = false;
            } else {
                confirmInput.classList.remove('is-invalid');
            }

            if (!isValid) return;

            submitBtn.disabled = true;
            submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Creating account...';

            try {
                const res = await fetch('/api/auth/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password, confirmPassword })
                });

                const data = await res.json();
                if (res.ok && data.success) {
                    alertBox.className = 'alert alert-success';
                    alertBox.textContent = 'Registration successful! Redirecting to your dashboard...';
                    alertBox.classList.remove('d-none');
                    setTimeout(() => {
                        window.location.href = '/dashboard.html';
                    }, 800);
                } else {
                    alertBox.className = 'alert alert-danger';
                    alertBox.textContent = data.message || 'Registration failed.';
                    alertBox.classList.remove('d-none');
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Register Account';
                }
            } catch (err) {
                console.error(err);
                alertBox.className = 'alert alert-danger';
                alertBox.textContent = 'Network or server error occurred. Please try again.';
                alertBox.classList.remove('d-none');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register Account';
            }
        });
    }
});
