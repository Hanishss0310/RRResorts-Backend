const express = require("express");
const router = express.Router();
const AuditLog = require("../Models/AuditLog");

// GET /api/audit-logs - Admin list of audit logs
router.get("/", async (req, res) => {
  try {
    const { action, targetType, limit = 50 } = req.query;
    const filter = {};

    if (action && action !== "all") filter.action = action;
    if (targetType && targetType !== "all") filter.targetType = targetType;

    const logs = await AuditLog.find(filter)
      .sort({ timestamp: -1 })
      .limit(Math.min(100, parseInt(limit, 10) || 50));

    return res.status(200).json({ success: true, count: logs.length, data: logs });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch audit logs" });
  }
});

module.exports = router;
