const Post = require('../models/Post');
const User = require('../models/User');
const { cloudinary } = require('../config/cloudinary');

// @desc    Create a post
// @route   POST /api/posts
// @access  Private
exports.createPost = async (req, res) => {
  try {
    let { image, title } = req.body;
    
    // Upload image to cloudinary if base64
    if (image && image.startsWith('data:image')) {
      const uploadRes = await cloudinary.uploader.upload(image, {
        folder: 'chat_app/posts',
      });
      image = uploadRes.secure_url;
    }

    const post = await Post.create({
      user: req.user.id,
      image,
      title,
    });

    const populatedPost = await Post.findById(post._id).populate('user', 'name avatar');
    
    // Emit new post event
    const io = req.app.get('socketio');
    if (io) {
      io.emit('new_post', populatedPost);
    }

    res.status(201).json({ success: true, data: populatedPost });
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
    
    // Emit like update event
    const io = req.app.get('socketio');
    if (io) {
      io.emit('post_updated', { 
        postId: post._id, 
        likes: post.likes, 
        comments: post.comments 
      });
    }

    res.json({ success: true, likes: post.likes.length, isLiked: !isLiked });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private
exports.deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    if (post.user.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized to delete this post' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add a comment to a post
// @route   POST /api/posts/:id/comments
// @access  Private
exports.addComment = async (req, res) => {
  try {
    const { text } = req.body;
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ success: false, message: 'Post not found' });
    }

    const newComment = {
      user: req.user.id,
      text
    };

    post.comments.push(newComment);
    await post.save();

    // Populate user details for the new comment before sending back
    await post.populate('comments.user', 'name avatar');

    // Emit comment update event
    const io = req.app.get('socketio');
    if (io) {
      io.emit('post_updated', { 
        postId: post._id, 
        likes: post.likes, 
        comments: post.comments 
      });
    }

    res.status(201).json({ success: true, data: post.comments });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
