const User = require('../models/User');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// @desc    Register user
// @route   POST /api/auth/signup
// @access  Public
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      name,
      email,
      password,
    });

    if (user) {
      res.status(201).json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Check for user email
    const user = await User.findOne({ email }).select('+password');

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (user) {
      // Check if email is being changed and if new email belongs to another user
      if (req.body.email && req.body.email !== user.email) {
        const emailExists = await User.findOne({ email: req.body.email });
        if (emailExists) {
          return res.status(400).json({ success: false, message: 'Email address already in use' });
        }
      }

      user.name = req.body.name || user.name;
      user.email = req.body.email || user.email;
      user.avatar = req.body.avatar || user.avatar;
      user.bio = req.body.bio || user.bio;

      const updatedUser = await user.save();

      res.json({
        success: true,
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        bio: updatedUser.bio,
        token: generateToken(updatedUser._id),
      });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    // Recalculate counts for accuracy
    const friendsCount = await Notification.countDocuments({
      type: 'request',
      status: 'accepted',
      $or: [{ sender: req.user.id }, { recipient: req.user.id }]
    });

    const followersCount = await User.findById(req.user.id).then(u => u.followersCount || 0);
    const followingCount = user.following ? user.following.length : 0;

    // Merge counts into response
    const userData = user.toObject();
    userData.friendsCount = friendsCount;
    userData.followingCount = followingCount;

    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all users
// @route   GET /api/auth/users
// @access  Private
exports.getUsers = async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const users = await User.find({ _id: { $ne: currentUserId } });
    
    // Find all requests involving current user
    const notifications = await Notification.find({
      $or: [
        { sender: currentUserId, type: 'request' },
        { recipient: currentUserId, type: 'request' }
      ]
    });

    const usersWithStatus = users.map(user => {
      const relevantNotif = notifications.find(n => 
        (n.sender.toString() === user._id.toString() && n.recipient.toString() === currentUserId) ||
        (n.recipient.toString() === user._id.toString() && n.sender.toString() === currentUserId)
      );

      return {
        ...user._doc,
        isFriend: relevantNotif?.status === 'accepted',
        isPending: relevantNotif?.status === 'pending'
      };
    });

    res.json({
      success: true,
      data: usersWithStatus,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

// @desc    Follow a user
// @route   POST /api/auth/follow/:id
// @access  Private
exports.followUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    if (targetUserId === currentUserId) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const currentUser = await User.findById(currentUserId);
    if (currentUser.following.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: 'Already following this user' });
    }

    // Add to following list
    await User.findByIdAndUpdate(currentUserId, { 
      $push: { following: targetUserId },
      $inc: { followingCount: 1 } // Increment your following count
    });
    
    // Increment followersCount for target user
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: 1 } });
    
    res.json({ success: true, message: 'User followed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unfollow a user
// @route   POST /api/auth/unfollow/:id
// @access  Private
exports.unfollowUser = async (req, res) => {
  try {
    const targetUserId = req.params.id;
    const currentUserId = req.user.id;

    const currentUser = await User.findById(currentUserId);
    if (!currentUser.following.includes(targetUserId)) {
      return res.status(400).json({ success: false, message: 'You are not following this user' });
    }

    // Remove from following list
    await User.findByIdAndUpdate(currentUserId, { 
      $pull: { following: targetUserId },
      $inc: { followingCount: -1 } // Decrement your following count
    });
    
    // Decrement followersCount for target user
    await User.findByIdAndUpdate(targetUserId, { $inc: { followersCount: -1 } });
    
    res.json({ success: true, message: 'User unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get user by ID
// @route   GET /api/auth/users/:id
// @access  Private
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
