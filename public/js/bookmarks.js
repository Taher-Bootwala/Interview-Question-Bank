/**
 * Bookmarks Page Logic
 */

let userBookmarks = [];

document.addEventListener('DOMContentLoaded', async () => {
    await App.init();
    if (!App.requireAuth()) return;

    document.getElementById('btn-practice-all-bookmarks')?.addEventListener('click', () => {
        if (userBookmarks.length === 0) {
            App.showToast('You currently have no bookmarked questions to practice.', 'warning');
            return;
        }
        window.location.href = '/practice.html?mode=bookmarks';
    });

    await loadBookmarks();
});

async function loadBookmarks() {
    const container = document.getElementById('bookmarks-container');
    container.innerHTML = `
        <div class="text-center py-5 text-muted">
            <div class="spinner-border spinner-border-sm text-primary me-2"></div>
            Loading saved bookmarks...
        </div>
    `;

    try {
        const res = await fetch('/api/bookmarks');
        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || 'Failed to load bookmarks.');
        }

        userBookmarks = data.bookmarks || [];

        if (userBookmarks.length === 0) {
            container.innerHTML = `
                <div class="card p-5 text-center text-muted">
                    <h5>No Bookmarked Questions</h5>
                    <p class="mb-3">You haven't bookmarked any interview questions yet. Browse the Question Bank and bookmark questions you want to revise later.</p>
                    <div><a href="/questions.html" class="btn btn-primary">Browse Question Bank</a></div>
                </div>
            `;
            document.getElementById('btn-practice-all-bookmarks').disabled = true;
            return;
        }

        document.getElementById('btn-practice-all-bookmarks').disabled = false;

        container.innerHTML = userBookmarks.map((bm, idx) => `
            <div class="card mb-3 card-hover border">
                <div class="card-body">
                    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-2">
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                            <span class="badge bg-secondary-subtle text-secondary border">#${idx + 1}</span>
                            <span class="badge bg-light text-dark border">${App.escapeHtml(bm.role_name)}</span>
                            <span class="badge bg-light text-dark border">${App.escapeHtml(bm.skill_name)}</span>
                            ${App.getDifficultyBadge(bm.difficulty)}
                            <span class="text-muted small ms-2">Saved on ${App.formatDate(bm.bookmarked_at)}</span>
                        </div>
                        <div class="d-flex gap-2">
                            <button class="btn btn-sm btn-outline-danger btn-remove-bm" data-id="${bm.id}">
                                Remove
                            </button>
                            <a href="/practice.html?question_id=${bm.id}" class="btn btn-sm btn-primary">
                                Practice This
                            </a>
                        </div>
                    </div>
                    <h5 class="card-title text-dark fw-bold mb-2">${App.escapeHtml(bm.question_text)}</h5>
                    <div class="p-3 bg-light rounded border text-muted small">
                        <strong class="text-dark">Model Answer Preview:</strong> ${App.escapeHtml(bm.model_answer)}
                    </div>
                </div>
            </div>
        `).join('');

        // Attach Remove Handlers
        document.querySelectorAll('.btn-remove-bm').forEach(btn => {
            btn.addEventListener('click', async () => {
                const qId = btn.getAttribute('data-id');
                await removeBookmark(qId);
            });
        });

    } catch (err) {
        console.error(err);
        container.innerHTML = `
            <div class="alert alert-danger" role="alert">
                Failed to load bookmarks. Please try again.
            </div>
        `;
    }
}

async function removeBookmark(questionId) {
    try {
        const res = await fetch(`/api/bookmarks/${questionId}`, { method: 'DELETE' });
        const data = await res.json();
        if (data.success) {
            App.showToast('Bookmark removed.', 'info');
            await loadBookmarks();
        } else {
            App.showToast(data.message || 'Failed to remove bookmark.', 'error');
        }
    } catch (err) {
        console.error(err);
        App.showToast('Network error removing bookmark.', 'error');
    }
}
