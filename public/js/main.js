/**
 * Shared Application Utilities & Auth State Management
 */

const App = {
    user: null,

    // Initialize session and navbar
    async init() {
        await this.checkAuth();
        this.renderNavbar();
    },

    // Check user authentication
    async checkAuth() {
        try {
            const res = await fetch('/api/auth/me');
            if (res.ok) {
                const data = await res.json();
                this.user = data.user;
            } else {
                this.user = null;
            }
        } catch {
            this.user = null;
        }
    },

    // Guard pages requiring authentication
    requireAuth(requireAdmin = false) {
        if (!this.user) {
            window.location.href = `/login.html?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`;
            return false;
        }
        if (requireAdmin && this.user.role !== 'admin') {
            window.location.href = '/dashboard.html';
            return false;
        }
        return true;
    },

    // Render dynamic navbar based on user session
    renderNavbar() {
        const navContainer = document.getElementById('navbar-auth-section');
        if (!navContainer) return;

        if (this.user) {
            const isAdmin = this.user.role === 'admin';
            navContainer.innerHTML = `
                <ul class="navbar-nav ms-auto align-items-center">
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/dashboard.html')}" href="/dashboard.html">Dashboard</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/quiz.html')}" href="/quiz.html">Topic Quiz</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/questions.html')}" href="/questions.html">Question Bank</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/practice.html')}" href="/practice.html">Practice</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/bookmarks.html')}" href="/bookmarks.html">Bookmarks</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/attempts.html')}" href="/attempts.html">History</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/weak-topics.html')}" href="/weak-topics.html">Weak Topics</a>
                    </li>
                    ${isAdmin ? `
                    <li class="nav-item dropdown">
                        <a class="nav-link dropdown-toggle text-danger fw-semibold" href="#" id="adminDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Admin Panel
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="adminDropdown">
                            <li><a class="dropdown-item" href="/admin/dashboard.html">Admin Dashboard</a></li>
                            <li><a class="dropdown-item" href="/admin/questions.html">Manage Questions</a></li>
                            <li><a class="dropdown-item" href="/admin/roles.html">Manage Roles</a></li>
                            <li><a class="dropdown-item" href="/admin/skills.html">Manage Skills</a></li>
                            <li><a class="dropdown-item" href="/admin/users.html">View Users</a></li>
                            <li><a class="dropdown-item" href="/admin/attempts.html">All Attempts</a></li>
                        </ul>
                    </li>
                    ` : ''}
                    <li class="nav-item ms-lg-2 dropdown">
                        <a class="nav-link dropdown-toggle btn btn-light px-3 py-1 border" href="#" id="userDropdown" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                            <span class="text-dark fw-medium">${this.escapeHtml(this.user.name)}</span>
                            ${isAdmin ? '<span class="badge bg-danger ms-1">Admin</span>' : ''}
                        </a>
                        <ul class="dropdown-menu dropdown-menu-end shadow-sm" aria-labelledby="userDropdown">
                            <li><span class="dropdown-item-text text-muted small">${this.escapeHtml(this.user.email)}</span></li>
                            <li><hr class="dropdown-divider"></li>
                            <li><a class="dropdown-item text-danger" href="#" id="btn-logout">Logout</a></li>
                        </ul>
                    </li>
                </ul>
            `;

            document.getElementById('btn-logout')?.addEventListener('click', (e) => {
                e.preventDefault();
                App.logout();
            });
        } else {
            navContainer.innerHTML = `
                <ul class="navbar-nav ms-auto align-items-center">
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/quiz.html')}" href="/quiz.html">Topic Quiz</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link ${this.isActive('/questions.html')}" href="/questions.html">Browse Questions</a>
                    </li>
                    <li class="nav-item ms-lg-2">
                        <a class="btn btn-outline-primary btn-sm px-3" href="/login.html">Login</a>
                    </li>
                    <li class="nav-item ms-2">
                        <a class="btn btn-primary btn-sm px-3" href="/register.html">Register</a>
                    </li>
                </ul>
            `;
        }
    },

    isActive(path) {
        return window.location.pathname.endsWith(path) ? 'active' : '';
    },

    async logout() {
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
            App.showToast('Logged out successfully.', 'info');
            setTimeout(() => {
                window.location.href = '/index.html';
            }, 600);
        } catch {
            window.location.href = '/index.html';
        }
    },

    showToast(message, type = 'info') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }

        const bgClass = {
            success: 'text-bg-success',
            error: 'text-bg-danger',
            warning: 'text-bg-warning',
            info: 'text-bg-primary'
        }[type] || 'text-bg-primary';

        const toastEl = document.createElement('div');
        toastEl.className = `toast align-items-center ${bgClass} border-0 shadow`;
        toastEl.setAttribute('role', 'alert');
        toastEl.setAttribute('aria-live', 'assertive');
        toastEl.setAttribute('aria-atomic', 'true');
        toastEl.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">${this.escapeHtml(message)}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;

        container.appendChild(toastEl);
        const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
        toast.show();
        toastEl.addEventListener('hidden.bs.toast', () => toastEl.remove());
    },

    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        if (mins === 0) return `${secs}s`;
        return `${mins}m ${secs}s`;
    },

    formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    },

    getDifficultyBadge(diff) {
        const cls = {
            'Easy': 'badge-easy',
            'Medium': 'badge-medium',
            'Hard': 'badge-hard'
        }[diff] || 'bg-secondary';
        return `<span class="badge ${cls}">${this.escapeHtml(diff)}</span>`;
    },

    getRatingBadge(rating) {
        const num = Number(rating);
        if (!num) return '<span class="text-muted small">Not rated</span>';
        if (num === 1) return '<span class="badge bg-danger">1 - Poor</span>';
        if (num === 2) return '<span class="badge bg-warning text-dark">2 - Average</span>';
        if (num === 3) return '<span class="badge bg-info text-dark">3 - Good</span>';
        if (num === 4) return '<span class="badge bg-success">4 - Excellent</span>';
        return `<span class="badge bg-secondary">${num}/4</span>`;
    },

    escapeHtml(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};
