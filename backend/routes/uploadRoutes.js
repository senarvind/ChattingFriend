const express = require('express');
const router = express.Router();
const { upload } = require('../config/cloudinary');
const { protect } = require('../middleware/authMiddleware');

// @desc    Upload an image
// @route   POST /api/upload
// @access  Private
router.post('/', protect, upload.single('image'), (req, res) => {
  if (req.file) {
    res.json({
      success: true,
      url: req.file.path,
    });
  } else {
    res.status(400).json({ success: false, message: 'Upload failed' });
  }
});

module.exports = router;
