const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

// Ensure upload directory exists
const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Allowed MIME types
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    const uniqueId = crypto.randomBytes(6).toString("hex");
    cb(null, `${safeBaseName}_${Date.now()}_${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only JPEG, PNG, and WebP images are permitted."), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

// POST /api/upload - Single image or screenshot upload
router.post("/", (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) {
      // Try with 'screenshot' field
      return upload.single("screenshot")(req, res, (err2) => {
        if (err2) {
          return upload.single("file")(req, res, (err3) => {
            if (err3) {
              return res.status(400).json({ success: false, message: err3.message || "Upload error" });
            }
            return handleUploadedFile(req, res);
          });
        }
        return handleUploadedFile(req, res);
      });
    }
    return handleUploadedFile(req, res);
  });
});

function handleUploadedFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file provided." });
    }

    const host = req.get("host");
    const protocol = req.protocol;
    const fileUrl = `${protocol}://${host}/uploads/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      url: fileUrl,
      filename: req.file.filename,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Upload failed" });
  }
}

// POST /api/upload/screenshot - Explicit endpoint for payment screenshots
router.post("/screenshot", (req, res) => {
  upload.single("screenshot")(req, res, (err) => {
    if (err) {
      return upload.single("image")(req, res, (err2) => {
        if (err2) {
          return res.status(400).json({ success: false, message: err2.message || "Screenshot upload failed" });
        }
        return handleUploadedFile(req, res);
      });
    }
    return handleUploadedFile(req, res);
  });
});

// POST /api/upload/multiple - Multiple images upload
router.post("/multiple", upload.array("images", 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files provided." });
    }

    const host = req.get("host");
    const protocol = req.protocol;

    const uploaded = req.files.map((file) => ({
      url: `${protocol}://${host}/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    return res.status(200).json({
      success: true,
      message: `${uploaded.length} image(s) uploaded successfully`,
      data: uploaded
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Multiple upload failed" });
  }
});

module.exports = router;
