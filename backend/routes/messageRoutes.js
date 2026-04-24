const express = require('express');
const router = express.Router();
const {
  sendMessage,
  getMessages,
  getConversations,
  getConversationWithUser,
  getConversationById,
  deleteMessage,
  markAsRead,
  createGroup,
  getGroups,
  addMember,
} = require('../controllers/messageController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, sendMessage);
router.post('/group', protect, createGroup);
router.put('/group/add', protect, addMember);
router.get('/groups', getGroups); // Publicly accessible to see trending groups
router.get('/conversations', protect, getConversations);
router.get('/conversation/:id', protect, getConversationById);
router.get('/user/:userId', protect, getConversationWithUser);
router.get('/:conversationId', protect, getMessages);
router.delete('/:id', protect, deleteMessage);
router.put('/read/:conversationId', protect, markAsRead);

module.exports = router;
