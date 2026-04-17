const Notification = require('../models/Notification');
const Conversation = require('../models/Conversation');

// Get all notifications for current user
exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .populate('sender', 'name avatar')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Create a notification
exports.createNotification = async (req, res) => {
  try {
    const { recipient, type, title, message, status } = req.body;
    
    // Validate recipient
    if (!recipient) {
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }
    
    const notification = await Notification.create({
      recipient,
      sender: req.user.id,
      type,
      title,
      message,
      status: status || 'none'
    });

    res.status(201).json({ success: true, data: notification });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Mark notification as read
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { read: true },
      { new: true }
    );
    
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Mark all as read
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user.id, read: false },
      { read: true }
    );
    
    res.json({ success: true, message: 'All notifications marked as read' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Check friendship status
exports.checkFriendship = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if there is an accepted request between these two users
    const friendship = await Notification.findOne({
      $or: [
        { recipient: req.user.id, sender: userId, type: 'request', status: 'accepted' },
        { recipient: userId, sender: req.user.id, type: 'request', status: 'accepted' }
      ]
    });

    res.json({ 
      success: true, 
      isFriends: !!friendship 
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update request status (Accept/Decline)
exports.updateStatus = async (req, res) => {
  try {
    const { status } = req.body;
    console.log(`[Notification] Updating status to: ${status} for ID: ${req.params.id}`);

    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { status, read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (status === 'accepted' || status === 'accept') {
      console.log(`[Friendship] Accepted! Sender: ${notification.sender}, Recipient: ${notification.recipient}`);
      
      // Create a conversation for the new friends if it doesn't exist
      const Conversation = require('../models/Conversation');
      const existingConv = await Conversation.findOne({
        participants: { $all: [notification.sender, notification.recipient] }
      });

      if (!existingConv) {
        await Conversation.create({
          participants: [notification.sender, notification.recipient]
        });
        console.log('[Friendship] Conversation created.');
      }

      // Increment friendsCount for both users
      const User = require('../models/User');
      const updateRes = await User.updateMany(
        { _id: { $in: [notification.sender, notification.recipient] } },
        { $inc: { friendsCount: 1 } }
      );
      console.log(`[Friendship] friendsCount updated for ${updateRes.modifiedCount} users.`);
    }
    
    res.json({ success: true, data: notification });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Delete a notification
exports.deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    // Ensure only the recipient or sender can delete it
    if (notification.recipient.toString() !== req.user.id && notification.sender.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'Not authorized' });
    }

    await Notification.findByIdAndDelete(req.params.id);

    res.json({ success: true, message: 'Notification removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
