const express = require("express");
const router = express.Router();
const Enquiry = require("../Models/Enquiry");
const Notification = require("../Models/Notification");
const {
  sendEnquiryAcknowledgementEmail,
  sendAdminNotificationEmail,
  sendMail,
  wrapHtmlEmail
} = require("../services/emailService");

// POST /api/enquiries (and /api/contact) - Submit guest enquiry / contact message
const handleEnquirySubmit = async (req, res) => {
  try {
    const {
      resortId,
      resortName,
      name,
      email,
      phone,
      topic,
      subject,
      message,
      source
    } = req.body;

    const senderName = name ? String(name).trim() : "";
    const senderEmail = email ? String(email).toLowerCase().trim() : "";
    const senderPhone = phone ? String(phone).trim() : "";
    const senderTopic = topic || subject || "General Enquiry";
    const senderSubject = subject || topic || "";
    const senderMessage = message ? String(message).trim() : "";

    if (!senderName || !senderEmail || !senderMessage) {
      return res.status(400).json({
        success: false,
        message: "Full name, email address, and message are required."
      });
    }

    // Determine enquiry source
    let detectedSource = "contact_form";
    if (source) {
      detectedSource = source;
    } else if (resortId && resortId !== "general" && resortId !== "concierge") {
      detectedSource = "custom_enquiry";
    }

    const enquiry = new Enquiry({
      resortId: resortId || "",
      resortName: resortName || (detectedSource === "custom_enquiry" ? "Property Custom Enquiry" : "RR Resorts Concierge"),
      name: senderName,
      email: senderEmail,
      phone: senderPhone,
      topic: senderTopic,
      subject: senderSubject,
      message: senderMessage,
      source: detectedSource,
      status: "Pending"
    });

    await enquiry.save();

    // Trigger Notification for Admin in DB
    try {
      const isCustom = detectedSource === "custom_enquiry";
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}`,
        type: "SYSTEM_ALERT",
        title: isCustom ? "New Custom Stay Enquiry" : "New Contact Form Message",
        message: `${enquiry.name} submitted an enquiry regarding ${enquiry.resortName} (${enquiry.topic}).`,
        link: isCustom ? "/custom-enquiries" : "/contact-messages",
        targetRole: "admin"
      });
    } catch {}

    // Dispatch transactional acknowledgement to customer & notification to admin email
    try {
      await sendEnquiryAcknowledgementEmail(enquiry);
      await sendAdminNotificationEmail({
        subject: `New Guest ${detectedSource === "custom_enquiry" ? "Custom Stay Enquiry" : "Contact Message"} from ${enquiry.name}`,
        title: `Guest Message Received: ${enquiry.topic}`,
        detailsHtml: `
          <p><strong>From:</strong> ${enquiry.name} (${enquiry.email}, ${enquiry.phone})</p>
          <p><strong>Type:</strong> ${detectedSource === "custom_enquiry" ? "Custom Property Enquiry" : "Contact Us Form"}</p>
          <p><strong>Property:</strong> ${enquiry.resortName || "General Concierge"}</p>
          <p><strong>Topic / Subject:</strong> ${enquiry.topic}</p>
          <p><strong>Message:</strong></p>
          <blockquote style="background: #F3F4F6; padding: 12px; border-left: 4px solid #12372A; border-radius: 4px; font-style: italic;">"${enquiry.message}"</blockquote>
        `,
        textContent: `From: ${enquiry.name} (${enquiry.email}, ${enquiry.phone}) | Type: ${detectedSource} | Topic: ${enquiry.topic} | Message: ${enquiry.message}`
      });
    } catch (mailErr) {
      console.warn("Enquiry email dispatch notice:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Message transmitted successfully! Our travel concierge will connect with you shortly.",
      data: enquiry
    });
  } catch (err) {
    console.error("Enquiry error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to submit enquiry" });
  }
};

router.post("/", handleEnquirySubmit);

// GET /api/enquiries/stats - Summary counts for sidebar and dashboards
router.get("/stats", async (req, res) => {
  try {
    const [total, pending, contactTotal, contactPending, customTotal, customPending] = await Promise.all([
      Enquiry.countDocuments(),
      Enquiry.countDocuments({ status: "Pending" }),
      Enquiry.countDocuments({ source: "contact_form" }),
      Enquiry.countDocuments({ source: "contact_form", status: "Pending" }),
      Enquiry.countDocuments({ source: "custom_enquiry" }),
      Enquiry.countDocuments({ source: "custom_enquiry", status: "Pending" })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        total,
        pending,
        contactTotal,
        contactPending,
        customTotal,
        customPending
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch stats" });
  }
});

// GET /api/enquiries - Admin list with search and filters
router.get("/", async (req, res) => {
  try {
    const { status, topic, source, search } = req.query;
    const filter = {};

    if (source && source !== "ALL" && source !== "all") {
      filter.source = source;
    }

    if (status && status !== "ALL" && status !== "all") {
      filter.status = status;
    }

    if (topic && topic !== "ALL" && topic !== "all") {
      filter.topic = topic;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { name: regex },
        { email: regex },
        { phone: regex },
        { resortName: regex },
        { topic: regex },
        { subject: regex },
        { message: regex }
      ];
    }

    const enquiries = await Enquiry.find(filter).sort({ createdAt: -1 });

    // Aggregate statistics across categories
    const [pendingCount, contactPendingCount, customPendingCount] = await Promise.all([
      Enquiry.countDocuments({ status: "Pending" }),
      Enquiry.countDocuments({ source: "contact_form", status: "Pending" }),
      Enquiry.countDocuments({ source: "custom_enquiry", status: "Pending" })
    ]);

    return res.status(200).json({
      success: true,
      count: enquiries.length,
      stats: {
        pendingCount,
        contactPendingCount,
        customPendingCount
      },
      data: enquiries
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch enquiries" });
  }
});

// GET /api/enquiries/:id - Single enquiry
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.status(200).json({ success: true, data: enquiry });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch enquiry" });
  }
});

// PUT /api/enquiries/:id/status (or PUT /api/enquiries/:id) - Update enquiry status / notes
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, repliedBy } = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    if (status) enquiry.status = status;
    if (adminNotes !== undefined) enquiry.adminNotes = adminNotes;
    if (repliedBy) enquiry.repliedBy = repliedBy;

    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: `Enquiry status updated to ${enquiry.status}`,
      data: enquiry
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update enquiry" });
  }
});

// PUT /api/enquiries/:id - Direct update
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes, repliedBy } = req.body;

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    if (status) enquiry.status = status;
    if (adminNotes !== undefined) enquiry.adminNotes = adminNotes;
    if (repliedBy) enquiry.repliedBy = repliedBy;

    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: "Enquiry updated successfully",
      data: enquiry
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update enquiry" });
  }
});

// POST /api/enquiries/:id/reply - Send direct email reply to guest from Admin Concierge
router.post("/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { replyMessage, senderName } = req.body;

    if (!replyMessage || !replyMessage.trim()) {
      return res.status(400).json({ success: false, message: "Reply message cannot be empty" });
    }

    const enquiry = await Enquiry.findById(id);
    if (!enquiry) return res.status(404).json({ success: false, message: "Enquiry not found" });

    const responder = senderName || "RR Resorts Estate Concierge";

    // Send email to customer
    try {
      const subject = `Response to Your Inquiry: ${enquiry.topic || "RR Resorts Stay"}`;
      const preheader = `A response from the RR Resorts & Luxury Sanctuaries Concierge team regarding your inquiry.`;
      const bodyContent = `
        <h2>Concierge Response</h2>
        <p>Dear <strong>${enquiry.name}</strong>,</p>
        <p>Thank you for inquiring with RR Resorts and Villas regarding <strong>${enquiry.resortName || "our properties"}</strong>.</p>

        <div class="info-box" style="background: #FAF8F5; border: 1px solid #DFBE76; padding: 16px; border-radius: 8px;">
          <p style="margin: 0 0 8px 0; font-weight: bold; color: #12372A;">Concierge Reply from ${responder}:</p>
          <p style="margin: 0; white-space: pre-line; color: #1F2937;">${replyMessage.trim()}</p>
        </div>

        <div style="margin-top: 16px; padding: 12px; background: #F3F4F6; border-radius: 6px; font-size: 12px; color: #6B7280;">
          <p style="margin: 0 0 4px 0;"><strong>Original Inquiry Message:</strong></p>
          <p style="margin: 0; font-style: italic;">"${enquiry.message}"</p>
        </div>

        <p style="margin-top: 16px;">If you have any further questions or wish to proceed with reservations, please feel free to reply directly to this email or call us at <strong>+91 98765 43210</strong>.</p>
      `;

      const text = `
Dear ${enquiry.name},

${replyMessage.trim()}

— ${responder}
RR Resorts & Villas Concierge
      `.trim();

      const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
      await sendMail({ to: enquiry.email, subject, text, html });
    } catch (mailErr) {
      console.warn("Direct reply email dispatch error:", mailErr.message);
    }

    // Update enquiry record
    enquiry.status = "Contacted";
    enquiry.repliedBy = responder;
    enquiry.repliedAt = new Date();
    enquiry.replyHistory.push({
      message: replyMessage.trim(),
      repliedBy: responder,
      sentAt: new Date()
    });

    await enquiry.save();

    return res.status(200).json({
      success: true,
      message: "Reply sent to customer successfully!",
      data: enquiry
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to send reply" });
  }
});

// DELETE /api/enquiries/:id - Delete enquiry
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Enquiry.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Enquiry not found" });
    return res.status(200).json({ success: true, message: "Enquiry removed successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete enquiry" });
  }
});

module.exports = router;
module.exports.handleEnquirySubmit = handleEnquirySubmit;
