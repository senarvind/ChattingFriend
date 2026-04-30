const Message = require('../models/Message');
const Conversation = require('../models/Conversation');
const { cloudinary } = require('../config/cloudinary');

// @desc    Send a message
// @route   POST /api/messages
// @access  Private
exports.sendMessage = async (req, res) => {
  console.log('Incoming Message Request:', req.body);
  try {
    let { recipientId, text, imageUrl, fileUrl } = req.body;
    const senderId = req.user.id;

    // Upload to Cloudinary if base64
    if (imageUrl && imageUrl.startsWith('data:image')) {
      const uploadRes = await cloudinary.uploader.upload(imageUrl, {
        folder: 'chat_app/messages',
      });
      imageUrl = uploadRes.secure_url;
    }

    if (fileUrl && fileUrl.startsWith('data:')) {
      const uploadRes = await cloudinary.uploader.upload(fileUrl, {
        folder: 'chat_app/files',
        resource_type: 'auto',
      });
      fileUrl = uploadRes.secure_url;
    }
    
    if (!recipientId) {
      console.log('Error: Missing recipientId');
      return res.status(400).json({ success: false, message: 'Recipient ID is required' });
    }

    let conversation;

    // Check if recipientId is a Conversation ID (for groups)
    try {
      conversation = await Conversation.findById(recipientId);
    } catch (err) {
      // Not a valid ObjectId or not a conversation, continue to 1-on-1 check
    }

    // If not a group conversation, look for or create 1-on-1 conversation
    if (!conversation || !conversation.isGroup) {
      conversation = await Conversation.findOne({
        isGroup: { $ne: true },
        participants: { $all: [senderId, recipientId] },
      });

      if (!conversation) {
        conversation = await Conversation.create({
          participants: [senderId, recipientId],
        });
      }
    }

    const message = await Message.create({
      conversationId: conversation._id,
      sender: senderId,
      text,
      imageUrl,
      fileUrl,
    });

    // Update last message in conversation
    conversation.lastMessage = message._id;
    await conversation.save();

    // Populate sender for immediate use in frontend
    const populatedMessage = await Message.findById(message._id).populate('sender', 'name avatar');

    res.status(201).json(populatedMessage);
  } catch (error) {
    console.error('Send Message Error:', error);
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
    })
    .populate('sender', 'name avatar')
    .sort('createdAt');

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
    }).populate('participants', 'name avatar onlineStatus');

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

// @desc    Create a group conversation
// @route   POST /api/messages/group
// @access  Private
exports.createGroup = async (req, res) => {
  try {
    let { name, image, participants } = req.body;
    
    // Upload group image to cloudinary if base64
    if (image && image.startsWith('data:image')) {
      const uploadRes = await cloudinary.uploader.upload(image, {
        folder: 'chat_app/groups',
      });
      image = uploadRes.secure_url;
    }
    
    if (!name) {
      return res.status(400).json({ success: false, message: 'Group name is required' });
    }

    // Ensure participants includes the creator
    const allParticipants = Array.from(new Set([...(participants || []), req.user.id]));

    const conversation = await Conversation.create({
      name,
      image: image || '',
      participants: allParticipants,
      isGroup: true,
      admin: req.user.id
    });

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', 'name avatar onlineStatus');

    res.status(201).json({ success: true, data: populatedConversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all group conversations
// @route   GET /api/messages/groups
// @access  Public (or Private, depending on needs)
exports.getGroups = async (req, res) => {
  try {
    const groups = await Conversation.find({ isGroup: true })
      .populate('participants', 'name avatar')
      .sort('-createdAt');
    
    res.json({ success: true, data: groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Add a member to a group
// @route   PUT /api/messages/group/add
// @access  Private
exports.addMember = async (req, res) => {
  try {
    const { conversationId, userId } = req.body;
    
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }

    if (!conversation.isGroup) {
      return res.status(400).json({ success: false, message: 'Not a group conversation' });
    }

    // Check if user is already a member
    if (conversation.participants.includes(userId)) {
      return res.status(400).json({ success: false, message: 'User is already a member' });
    }

    conversation.participants.push(userId);
    await conversation.save();

    const updatedConversation = await Conversation.findById(conversationId)
      .populate('participants', 'name avatar onlineStatus');

    res.json({ success: true, data: updatedConversation });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
