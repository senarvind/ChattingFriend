const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getNotifications,
  createNotification,
  markAsRead,
  markAllRead,
  updateStatus,
  checkFriendship,
  deleteNotification
} = require('../controllers/notificationController');

router.use(protect);

router.get('/', getNotifications);
router.post('/', createNotification);
router.get('/check/:userId', checkFriendship);
router.put('/mark-all', markAllRead);
router.put('/:id/read', markAsRead);
router.put('/:id/status', updateStatus);
router.delete('/:id', deleteNotification);

module.exports = router;
