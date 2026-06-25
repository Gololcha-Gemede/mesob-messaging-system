const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadDir } = require('../config/paths');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter(req, file, cb) {
    const allowed = /^(image\/(jpeg|png|gif|webp)|application\/pdf)$/i;
    if (allowed.test(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only images (JPEG, PNG, GIF, WebP) and PDF files are allowed'));
  }
});

module.exports = upload;
