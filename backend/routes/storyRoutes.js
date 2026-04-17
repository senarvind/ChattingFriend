const express = require('express');
const router = express.Router();
const { addStory, getStories } = require('../controllers/storyController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(protect, addStory).get(protect, getStories);

module.exports = router;
