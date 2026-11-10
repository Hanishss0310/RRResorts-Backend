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
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/jpg",
  "image/gif",
  "image/svg+xml"
];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    const safeBaseName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .slice(0, 30);
    const uniqueId = crypto.randomBytes(6).toString("hex");
    cb(null, `${safeBaseName}_${Date.now()}_${uniqueId}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.includes(file.mimetype.toLowerCase()) || file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file format. Only image files (JPEG, PNG, WebP, AVIF, GIF) are permitted."), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

function getBaseUrl(req) {
  const host = req.get("host") || "localhost:5002";
  const isHttps =
    req.secure ||
    req.headers["x-forwarded-proto"] === "https" ||
    host.includes("rrresortsandvillas.in") ||
    host.includes("web.app");
  const protocol = isHttps ? "https" : req.protocol;
  return `${protocol}://${host}`;
}

// POST /api/upload - Single or Multiple image upload directly from computer
router.post("/", (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || "Upload error" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No image file provided." });
    }

    const baseUrl = getBaseUrl(req);

    if (req.files.length === 1) {
      const file = req.files[0];
      const fileUrl = `${baseUrl}/uploads/${file.filename}`;
      return res.status(200).json({
        success: true,
        message: "Image uploaded successfully",
        url: fileUrl,
        urls: [fileUrl],
        filename: file.filename,
        size: file.size,
        mimetype: file.mimetype
      });
    }

    const uploaded = req.files.map((file) => ({
      url: `${baseUrl}/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    return res.status(200).json({
      success: true,
      message: `${uploaded.length} image(s) uploaded successfully`,
      url: uploaded[0].url,
      urls: uploaded.map((u) => u.url),
      data: uploaded
    });
  });
});

// POST /api/upload/screenshot - Explicit endpoint for payment screenshots
router.post("/screenshot", (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || "Screenshot upload failed" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No screenshot file provided." });
    }
    const baseUrl = getBaseUrl(req);
    const file = req.files[0];
    const fileUrl = `${baseUrl}/uploads/${file.filename}`;
    return res.status(200).json({
      success: true,
      message: "Screenshot uploaded successfully",
      url: fileUrl,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    });
  });
});

// POST /api/upload/multiple - Multiple images upload
router.post("/multiple", (req, res) => {
  upload.any()(req, res, (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || "Multiple upload failed" });
    }
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files provided." });
    }

    const baseUrl = getBaseUrl(req);
    const uploaded = req.files.map((file) => ({
      url: `${baseUrl}/uploads/${file.filename}`,
      filename: file.filename,
      size: file.size,
      mimetype: file.mimetype
    }));

    return res.status(200).json({
      success: true,
      message: `${uploaded.length} image(s) uploaded successfully`,
      url: uploaded[0].url,
      urls: uploaded.map((u) => u.url),
      data: uploaded
    });
  });
});

module.exports = router;
