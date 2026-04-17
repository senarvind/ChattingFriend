const Message = require('../models/Message');
const Conversation = require('../models/Conversation');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  console.log('Incoming Message Request:', req.body);
  try {
    const { recipientId, text } = req.body;
    const senderId = req.user.id;
    
    if (!recipientId) {
      console.log('Error: Missing recipientId');
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }

    // Check if conversation exists
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, recipientId],
      });
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: senderId,
      text,
    });

    // Update last message in conversation
    conversation.lastMessage = message._id;
    await conversation.save();

    res.status(201).json(message);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
exports.getMessages = async (req, res) => {
  try {
    const messages = await Message.find({
      conversationId: req.params.conversationId,
    }).sort('createdAt');

    res.json(messages);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all conversations for a user (Chat List)
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: { $in: [req.user.id] },
    })
      .populate('participants', 'name email avatar onlineStatus')
      .populate('lastMessage')
      .sort('-updatedAt');

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Get or create conversation and its messages with a specific user
// @route   GET /api/messages/user/:userId
// @access  Private
exports.getConversationWithUser = async (req, res) => {
  try {
    const recipientId = req.params.userId;
    const senderId = req.user.id;

    // Find conversation
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, recipientId] },
    });

    if (!conversation) {
      // Return empty messages if it's a new conversation (don't create yet to save DB space)
      return res.json({
        conversation: null,
        messages: [],
      });
    }

    const messages = await Message.find({
      conversationId: conversation._id,
    }).sort('createdAt');

    res.json({
      conversation,
      messages,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Delete a message
// @route   DELETE /api/messages/:id
// @access  Private
exports.deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Check if user is the sender
    if (message.sender.toString() !== req.user.id) {
      return res.status(401).json({ success: false, message: 'User not authorized to delete this message' });
    }

    await message.deleteOne();

    res.json({ success: true, message: 'Message removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
// @desc    Mark messages as read
// @route   PUT /api/messages/read/:conversationId
// @access  Private
exports.markAsRead = async (req, res) => {
  try {
    await Message.updateMany(
      { 
        conversationId: req.params.conversationId, 
        sender: { $ne: req.user.id }, 
        isRead: false 
      },
      { $set: { isRead: true } }
    );

    res.json({ success: true, message: 'Messages marked as read' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a single conversation by ID
// @route   GET /api/messages/conversation/:id
// @access  Private
exports.getConversationById = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'name avatar onlineStatus');
    
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    res.json(conversation);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
