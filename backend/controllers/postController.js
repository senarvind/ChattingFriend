const Post = require('../models/Post');
const User = require('../models/User');

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    const { image, title } = req.body;
    const post = await Post.create({
      user: req.user.id,
      image,
      title,
    });
    res.status(201).json({ success: true, data: post });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get posts from followed users and self
// @route   GET /api/posts
// @access  Private
exports.getPosts = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Include self and followed users
    const following = [...user.following, req.user.id];

    const posts = await Post.find({ user: { $in: following } })
      .populate('user', 'name avatar')
      .sort('-createdAt');
      
    res.json({ success: true, data: posts });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Like/Unlike a post
// @route   PUT /api/posts/like/:id
// @access  Private
exports.toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const isLiked = post.likes.includes(req.user.id);
    if (isLiked) {
      post.likes = post.likes.filter((id) => id.toString() !== req.user.id);
    } else {
      post.likes.push(req.user.id);
    }

    await post.save();
    res.json({ success: true, likes: post.likes.length, isLiked: !isLiked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
