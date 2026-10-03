const express = require('express');
const router = express.Router();
const bookmarkController = require('../controllers/bookmarkController');
const { isAuthenticated } = require('../middleware/auth');

router.use(isAuthenticated);

router.get('/', bookmarkController.getBookmarks);
router.get('/ids', bookmarkController.getBookmarkedIds);
router.post('/', bookmarkController.addBookmark);
router.delete('/:questionId', bookmarkController.removeBookmark);

module.exports = router;
