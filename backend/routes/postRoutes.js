const express = require('express');
const router = express.Router();
const { createPost, getPosts, toggleLike } = require('../controllers/postController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').get(protect, getPosts).post(protect, createPost);
router.put('/like/:id', protect, toggleLike);

module.exports = router;
