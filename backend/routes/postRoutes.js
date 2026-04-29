const express = require('express');
const router = express.Router();
const { createPost, getPosts, toggleLike, deletePost, addComment } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getPosts).post(protect, createPost);
router.route('/:id').delete(protect, deletePost);
router.put('/like/:id', protect, toggleLike);
router.post('/:id/comments', protect, addComment);

module.exports = router;
