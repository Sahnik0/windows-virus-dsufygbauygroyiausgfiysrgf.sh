const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Absolute target directory for storing uploaded vehicle driving license files
const uploadDir = path.join(__dirname, '../../uploads/vehicle-licenses');

// Create upload directory recursively if it does not exist
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer disk storage engine
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir); // Save to uploads/vehicle-licenses folder
  },
  filename: (req, file, cb) => {
    const userId = req.user ? req.user.id : 'unknown';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `license-${userId}-${timestamp}${ext}`);
  },
});

// File type validation filter (allows JPG, JPEG, PNG, and PDF)
const fileFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true); // Accept file
  } else {
    cb(new Error('Invalid file type. Only JPG, JPEG, PNG, and PDF files are allowed.'), false); // Reject file
  }
};

// Configured Multer upload middleware with 5MB size limit
const uploadLicense = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB maximum file size
  },
});

module.exports = uploadLicense;
