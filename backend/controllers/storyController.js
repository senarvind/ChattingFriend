const Story = require('../models/Story');

// @desc    Add a story
// @route   POST /api/stories
// @access  Private
exports.addStory = async (req, res) => {
  try {
    const { imageUrl } = req.body;
    const story = await Story.create({
      user: req.user.id,
      imageUrl,
    });
    res.status(201).json(story);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all stories
// @route   GET /api/stories
// @access  Private
exports.getStories = async (req, res) => {
  try {
    const stories = await Story.find()
      .populate('user', 'name avatar')
      .sort('-createdAt');
    res.json(stories);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
