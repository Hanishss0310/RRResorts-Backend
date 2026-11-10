const express = require("express");
const router = express.Router();
const SupportTicket = require("../Models/SupportTicket");
const Notification = require("../Models/Notification");
const { authenticateUser } = require("./authRoutes");

// Helper to extract user or optional authentication
const tryAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const jwt = require("jsonwebtoken");
      const User = require("../Models/User");
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || "rr_coorg_holidays_secret_key_2026_jwt_token");
      req.user = await User.findById(decoded.id);
    }
  } catch {
    // Ignore and proceed as unauthenticated
  }
  next();
};

// GET /api/support - List all tickets (Admin & Staff)
router.get("/", async (req, res) => {
  try {
    const { status, category, priority, search } = req.query;
    const filter = {};

    if (status && status !== "ALL" && status !== "all") {
      filter.status = status;
    }
    if (category && category !== "ALL" && category !== "all") {
      filter.category = category;
    }
    if (priority && priority !== "ALL" && priority !== "all") {
      filter.priority = priority;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { ticketId: regex },
        { subject: regex },
        { bookingId: regex },
        { "customer.name": regex },
        { "customer.email": regex },
        { "customer.phone": regex }
      ];
    }

    const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (err) {
    console.error("Fetch support tickets error:", err);
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch support tickets"
    });
  }
});

// GET /api/support/my - Fetch current user's tickets
router.get("/my", tryAuthenticate, async (req, res) => {
  try {
    const email = (req.query.email || req.user?.email || "").toLowerCase().trim();

    const query = {};
    if (req.user?._id) {
      query.$or = [{ userId: req.user._id }, { "customer.email": email }];
    } else if (email) {
      query["customer.email"] = email;
    }

    const tickets = await SupportTicket.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: tickets.length,
      data: tickets
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: err.message || "Failed to fetch user support tickets"
    });
  }
});

// GET /api/support/:id - Single ticket details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findOne({
      $or: [{ ticketId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.status(200).json({ success: true, data: ticket });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch ticket" });
  }
});

// POST /api/support - Create a new support ticket
router.post("/", tryAuthenticate, async (req, res) => {
  try {
    const { subject, category, bookingId, message, priority, customer, name, email, phone } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: "Subject and initial message are required."
      });
    }

    const customerName = customer?.name || name || req.user?.name || "Guest Traveler";
    const customerEmail = (customer?.email || email || req.user?.email || "guest@example.com").toLowerCase().trim();
    const customerPhone = customer?.phone || phone || req.user?.phone || "";

    const count = await SupportTicket.countDocuments();
    const ticketId = req.body.ticketId || `TKT-${1040 + count + 1}`;

    const newTicket = new SupportTicket({
      ticketId,
      userId: req.user?._id || null,
      customer: {
        name: customerName,
        email: customerEmail,
        phone: customerPhone
      },
      subject: subject.trim(),
      bookingId: bookingId || "General Inquiry",
      category: category || "General Inquiry",
      priority: priority || "Medium",
      status: "Open",
      assignedTo: "Unassigned",
      messages: [
        {
          sender: "Customer",
          name: customerName,
          time: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
          message: message.trim()
        }
      ]
    });

    await newTicket.save();

    // Trigger Admin Notification
    try {
      const notif = new Notification({
        notificationId: `NOTIF-${Date.now()}`,
        type: "SUPPORT_TICKET",
        title: "New Support Ticket Received",
        message: `Ticket #${ticketId} created by ${customerName}: '${subject.substring(0, 45)}...'`,
        link: "/support",
        targetRole: "admin"
      });
      await notif.save();
    } catch (notifErr) {
      console.warn("Notification error:", notifErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Support ticket #${newTicket.ticketId} created successfully.`,
      data: newTicket
    });
  } catch (err) {
    console.error("Create ticket error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create support ticket" });
  }
});

// POST /api/support/:id/reply - Add message reply to ticket
router.post("/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { message, sender, name } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: "Reply message cannot be empty" });
    }

    const ticket = await SupportTicket.findOne({
      $or: [{ ticketId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    const replyEntry = {
      sender: sender || "Staff",
      name: name || (sender === "Customer" ? ticket.customer.name : "Admin Concierge"),
      time: new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }),
      message: message.trim()
    };

    ticket.messages.push(replyEntry);
    if (ticket.status === "Open" && (sender === "Staff" || sender === "staff" || sender === "admin")) {
      ticket.status = "In Progress";
    }

    await ticket.save();

    return res.status(200).json({
      success: true,
      message: "Reply sent successfully",
      data: ticket
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to send reply" });
  }
});

// PUT /api/support/:id/status - Update ticket status
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Open", "In Progress", "Resolved", "Closed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status value" });
    }

    const ticket = await SupportTicket.findOne({
      $or: [{ ticketId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    ticket.status = status;
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket #${ticket.ticketId} marked as ${status}`,
      data: ticket
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update ticket status" });
  }
});

// PUT /api/support/:id/assign - Assign ticket to staff member
router.put("/:id/assign", async (req, res) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const ticket = await SupportTicket.findOne({
      $or: [{ ticketId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!ticket) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    ticket.assignedTo = assignedTo || "Unassigned";
    await ticket.save();

    return res.status(200).json({
      success: true,
      message: `Ticket assigned to ${ticket.assignedTo}`,
      data: ticket
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to assign ticket" });
  }
});

// DELETE /api/support/:id - Delete ticket
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await SupportTicket.findOneAndDelete({
      $or: [{ ticketId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!deleted) {
      return res.status(404).json({ success: false, message: "Ticket not found" });
    }

    return res.status(200).json({ success: true, message: "Support ticket deleted" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete ticket" });
  }
});

module.exports = router;
