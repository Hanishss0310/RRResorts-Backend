const express = require("express");
const router = express.Router();
const Notification = require("../Models/Notification");

// GET /api/notifications - List all notifications
router.get("/", async (req, res) => {
  try {
    const { unreadOnly, role } = req.query;
    const filter = {};

    if (unreadOnly === "true") {
      filter.read = false;
    }

    if (role && role !== "all") {
      filter.$or = [{ targetRole: "all" }, { targetRole: role }];
    }

    const notifications = await Notification.find(filter).sort({ createdAt: -1 }).limit(50);
    const unreadCount = await Notification.countDocuments({ read: false });

    return res.status(200).json({
      success: true,
      count: notifications.length,
      unreadCount,
      data: notifications
    });
  } catch (err) {
    console.error("Fetch notifications error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch notifications" });
  }
});

// POST /api/notifications - Create notification
router.post("/", async (req, res) => {
  try {
    const { type, title, message, link, targetRole, userId } = req.body;

    if (!title || !message) {
      return res.status(400).json({ success: false, message: "Title and message are required" });
    }

    const notificationId = req.body.notificationId || `NOTIF-${Date.now()}`;

    const newNotification = new Notification({
      notificationId,
      type: type || "SYSTEM_ALERT",
      title,
      message,
      link: link || "/dashboard",
      targetRole: targetRole || "all",
      userId: userId || null,
      read: false
    });

    await newNotification.save();

    return res.status(201).json({
      success: true,
      message: "Notification created",
      data: newNotification
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to create notification" });
  }
});

// PUT /api/notifications/read-all - Mark all as read
router.put("/read-all", async (req, res) => {
  try {
    await Notification.updateMany({ read: false }, { $set: { read: true } });
    const all = await Notification.find().sort({ createdAt: -1 }).limit(50);

    return res.status(200).json({
      success: true,
      message: "All notifications marked as read",
      data: all
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to mark notifications read" });
  }
});

// PUT /api/notifications/:id/read - Mark single notification as read
router.put("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;

    const notif = await Notification.findOne({
      $or: [{ notificationId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    notif.read = true;
    await notif.save();

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
      data: notif
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update notification" });
  }
});

// DELETE /api/notifications/:id - Delete single notification
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Notification.findOneAndDelete({
      $or: [{ notificationId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    return res.status(200).json({ success: true, message: "Notification deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete notification" });
  }
});

// DELETE /api/notifications - Clear all read notifications
router.delete("/", async (req, res) => {
  try {
    await Notification.deleteMany({ read: true });
    return res.status(200).json({ success: true, message: "Cleared read notifications" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to clear notifications" });
  }
});

module.exports = router;
