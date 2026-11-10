const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Payment = require("../Models/Payment");
const Booking = require("../Models/Booking");
const Setting = require("../Models/Setting");
const Notification = require("../Models/Notification");
const AuditLog = require("../Models/AuditLog");
const {
  createRazorpayOrder,
  verifyPaymentSignature,
  verifyWebhookSignature,
  processRefund
} = require("../services/paymentService");
const {
  sendPaymentSuccessEmail,
  sendPaymentRefundEmail,
  sendPaymentSubmissionEmail,
  sendPaymentApprovalEmail,
  sendPaymentRejectionEmail,
  sendBookingConfirmationEmail,
  sendAdminPaymentVerificationAlert
} = require("../services/emailService");

// Optional or required authentication helper
const tryAuthenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const jwt = require("jsonwebtoken");
      const User = require("../Models/User");
      const token = authHeader.split(" ")[1];
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "rr_coorg_holidays_secret_key_2026_jwt_token"
      );
      req.user = await User.findById(decoded.id);
    }
  } catch {}
  next();
};

// =========================================================================
// 1. CONFIGURATION & PUBLIC METADATA
// =========================================================================

// GET /api/payments/upi-config - Secure backend UPI & pricing parameters
router.get("/upi-config", async (req, res) => {
  try {
    const setting = await Setting.findOne({ key: "general_config" });
    const upiId = setting?.upiId || process.env.MERCHANT_UPI_ID || "rrresorts@icici";
    const businessName = setting?.businessName || "RR Resorts and Villas";
    const merchantQrUrl = setting?.merchantQrCodeUrl || "";
    const cashSurchargeBase = setting?.cashSurchargeBase || 150;
    const cashSurchargePercent = setting?.cashSurchargePercent || 0.02;

    return res.status(200).json({
      success: true,
      data: {
        upiId,
        businessName,
        merchantQrUrl,
        cashSurchargeBase,
        cashSurchargePercent,
        supportedApps: ["PhonePe", "Google Pay", "Paytm", "BHIM", "CRED", "Other UPI Apps"]
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch UPI config" });
  }
});

// =========================================================================
// 2. CUSTOMER PAYMENT PROOF SUBMISSION (ONLINE UPI & QR SCAN)
// =========================================================================

// POST /api/payments/submit-verification - Guest submits UTR & screenshot for verification
router.post("/submit-verification", tryAuthenticate, async (req, res) => {
  try {
    const {
      bookingId,
      paymentMethod = "ONLINE_UPI",
      transactionId,
      utrNumber,
      payerUpiId = "",
      screenshotUrl = "",
      amount,
      notes = ""
    } = req.body;

    const utr = (utrNumber || transactionId || "").trim();

    if (!bookingId) {
      return res.status(400).json({ success: false, message: "Booking ID is required." });
    }

    if (!utr || utr.length < 6) {
      return res.status(400).json({
        success: false,
        message: "A valid Transaction Reference / UTR Number (minimum 6 characters) is required."
      });
    }

    // 1. Locate booking
    const booking = await Booking.findOne({
      $or: [
        { bookingId },
        { bookingRef: bookingId },
        ...(bookingId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: bookingId }] : [])
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking reservation not found." });
    }

    // 2. Check for duplicate UTR / transaction ID
    const duplicatePayment = await Payment.findOne({
      $or: [{ utrNumber: utr }, { transactionId: utr }],
      paymentStatus: { $in: ["PAID", "PENDING_VERIFICATION", "Success", "Successful"] },
      bookingId: { $ne: booking.bookingId }
    });

    if (duplicatePayment) {
      return res.status(409).json({
        success: false,
        message: "This UTR / Transaction ID has already been submitted for another booking. Please check your transaction details."
      });
    }

    const paymentAmount = Number(amount) || booking.totalAmount;
    const paymentId = `PAY-${booking.bookingId}-${Date.now().toString().slice(-5)}`;

    // 3. Create or update payment record with status PENDING_VERIFICATION
    let payment = await Payment.findOne({ bookingId: booking.bookingId });

    if (payment) {
      payment.paymentMethod = paymentMethod;
      payment.transactionId = utr;
      payment.utrNumber = utr;
      payment.payerUpiId = payerUpiId;
      payment.screenshotUrl = screenshotUrl || payment.screenshotUrl;
      payment.amount = paymentAmount;
      payment.paymentStatus = "PENDING_VERIFICATION";
      payment.verificationStatus = "PENDING";
      payment.auditTrail.push({
        action: "PAYMENT_PROOF_SUBMITTED",
        performedBy: req.user?.name || booking.guest.name || "Customer",
        performedAt: new Date(),
        notes: notes || `Customer submitted payment proof with UTR ${utr}`,
        newStatus: "PENDING_VERIFICATION"
      });
    } else {
      payment = new Payment({
        paymentId,
        bookingId: booking.bookingId,
        customerId: req.user?._id || booking.userId || null,
        propertyName: booking.propertyName,
        guestName: booking.guest.name,
        guestEmail: booking.guest.email,
        guestPhone: booking.guest.phone || "",
        amount: paymentAmount,
        currency: "INR",
        paymentMethod,
        gateway: paymentMethod === "QR_SCAN" ? "QR_MERCHANT" : "DIRECT_UPI",
        transactionId: utr,
        utrNumber: utr,
        payerUpiId,
        screenshotUrl,
        paymentStatus: "PENDING_VERIFICATION",
        verificationStatus: "PENDING",
        auditTrail: [
          {
            action: "PAYMENT_PROOF_SUBMITTED",
            performedBy: req.user?.name || booking.guest.name || "Customer",
            performedAt: new Date(),
            notes: notes || `Customer submitted payment proof with UTR ${utr}`,
            newStatus: "PENDING_VERIFICATION"
          }
        ]
      });
    }

    await payment.save();

    // 4. Update booking
    booking.paymentStatus = "PENDING_VERIFICATION";
    booking.utrNumber = utr;
    booking.transactionId = utr;
    booking.payerUpiId = payerUpiId;
    booking.paymentScreenshotUrl = screenshotUrl || booking.paymentScreenshotUrl;
    booking.paymentMethod = paymentMethod;

    booking.statusHistory.push({
      status: "Payment Verification Pending",
      changedAt: new Date(),
      changedBy: req.user?.name || "Customer",
      note: `Guest submitted payment proof with UTR: ${utr}. Awaiting merchant reconciliation.`
    });

    await booking.save();

    // 5. Notify admin & send email to guest
    try {
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}`,
        type: "PAYMENT_VERIFICATION_REQUESTED",
        title: `Payment Proof Submitted (#${booking.bookingId})`,
        message: `${booking.guest.name} submitted UTR #${utr} for ₹${paymentAmount.toLocaleString("en-IN")}.`,
        link: "/payments",
        targetRole: "admin"
      });
    } catch {}

    try {
      await sendPaymentSubmissionEmail(payment, booking);
      await sendAdminPaymentVerificationAlert(payment, booking);
    } catch (mailErr) {
      console.warn("Payment submission email notice:", mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Payment proof submitted successfully. Your booking is under verification.",
      data: {
        paymentId: payment.paymentId,
        bookingId: payment.bookingId,
        paymentStatus: payment.paymentStatus,
        verificationStatus: payment.verificationStatus,
        utrNumber: payment.utrNumber
      }
    });
  } catch (err) {
    console.error("Submit verification error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to submit payment verification" });
  }
});

// =========================================================================
// 3. ADMIN PAYMENT VERIFICATION & AUDIT WORKFLOW
// =========================================================================

// GET /api/payments/pending-verifications - Fetch payments awaiting administrative action
router.get("/pending-verifications", tryAuthenticate, async (req, res) => {
  try {
    const pendingPayments = await Payment.find({
      paymentStatus: { $in: ["PENDING_VERIFICATION", "CASH_PENDING"] }
    }).sort({ createdAt: -1 });

    const bookingIds = pendingPayments.map((p) => p.bookingId);
    const bookings = await Booking.find({ bookingId: { $in: bookingIds } });
    const bookingMap = new Map(bookings.map((b) => [b.bookingId, b]));

    const combined = pendingPayments.map((p) => ({
      ...p.toObject(),
      booking: bookingMap.get(p.bookingId) || null
    }));

    return res.status(200).json({
      success: true,
      count: combined.length,
      data: combined
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch pending verifications" });
  }
});

// POST /api/payments/:id/verify-admin - Admin verifies payment against bank records
router.post("/:id/verify-admin", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationNotes = "", verifiedBy = "Admin" } = req.body;

    const payment = await Payment.findOne({
      $or: [
        { paymentId: id },
        { transactionId: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }

    const previousStatus = payment.paymentStatus;
    const verifierName = req.user?.name || verifiedBy;

    payment.paymentStatus = "PAID";
    payment.verificationStatus = "VERIFIED";
    payment.verifiedBy = verifierName;
    payment.verificationNotes = verificationNotes || "Verified against merchant account statements.";
    payment.verifiedAt = new Date();

    payment.auditTrail.push({
      action: "PAYMENT_VERIFIED",
      performedBy: verifierName,
      performedAt: new Date(),
      notes: payment.verificationNotes,
      previousStatus,
      newStatus: "PAID"
    });

    await payment.save();

    // Update associated booking
    const booking = await Booking.findOne({ bookingId: payment.bookingId });
    if (booking) {
      booking.paymentStatus = "PAID";
      booking.paidAmount = payment.amount;
      booking.pendingAmount = Math.max(0, booking.totalAmount - payment.amount);
      booking.bookingStatus = "Confirmed";
      booking.holdExpiresAt = null; // Clear temporary hold

      booking.statusHistory.push({
        status: "Confirmed (Payment Verified)",
        changedAt: new Date(),
        changedBy: verifierName,
        note: `Payment verified by ${verifierName}. ${verificationNotes}`
      });

      await booking.save();

      // Send confirmation emails
      try {
        await sendPaymentApprovalEmail(payment, booking);
        await sendBookingConfirmationEmail(booking);
      } catch (mErr) {
        console.warn("Payment approval email notice:", mErr.message);
      }
    }

    // Create Audit Log
    try {
      await AuditLog.create({
        action: "PAYMENT_APPROVAL",
        userId: req.user?._id || null,
        userName: verifierName,
        target: `Payment #${payment.paymentId} (Booking #${payment.bookingId})`,
        details: `Verified ₹${payment.amount} (Txn: ${payment.transactionId || payment.utrNumber})`,
        ipAddress: req.ip
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Payment of ₹${payment.amount} successfully verified and booking confirmed!`,
      data: payment
    });
  } catch (err) {
    console.error("Admin verify payment error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to verify payment" });
  }
});

// POST /api/payments/:id/reject-admin - Admin rejects fraudulent or unverified payment
router.post("/:id/reject-admin", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason = "Transaction could not be verified in bank records", verificationNotes = "" } = req.body;

    const payment = await Payment.findOne({
      $or: [
        { paymentId: id },
        { transactionId: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!payment) {
      return res.status(404).json({ success: false, message: "Payment record not found." });
    }

    const previousStatus = payment.paymentStatus;
    const verifierName = req.user?.name || "Admin";

    payment.paymentStatus = "REJECTED";
    payment.verificationStatus = "REJECTED";
    payment.verifiedBy = verifierName;
    payment.verificationNotes = `${rejectionReason}. ${verificationNotes}`.trim();
    payment.verifiedAt = new Date();

    payment.auditTrail.push({
      action: "PAYMENT_REJECTED",
      performedBy: verifierName,
      performedAt: new Date(),
      notes: payment.verificationNotes,
      previousStatus,
      newStatus: "REJECTED"
    });

    await payment.save();

    // Update associated booking
    const booking = await Booking.findOne({ bookingId: payment.bookingId });
    if (booking) {
      booking.paymentStatus = "REJECTED";
      booking.bookingStatus = "Rejected";

      booking.statusHistory.push({
        status: "Payment Rejected",
        changedAt: new Date(),
        changedBy: verifierName,
        note: `Payment rejected by ${verifierName}: ${rejectionReason}`
      });

      await booking.save();

      try {
        await sendPaymentRejectionEmail(payment, booking, rejectionReason);
      } catch (mErr) {
        console.warn("Payment rejection email notice:", mErr.message);
      }
    }

    try {
      await AuditLog.create({
        action: "PAYMENT_REJECTION",
        userId: req.user?._id || null,
        userName: verifierName,
        target: `Payment #${payment.paymentId} (Booking #${payment.bookingId})`,
        details: `Rejected: ${rejectionReason}`,
        ipAddress: req.ip
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: "Payment submission rejected and customer notified.",
      data: payment
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to reject payment" });
  }
});

// POST /api/payments/:id/cash-collected - Admin marks cash collected at front desk
router.post("/:id/cash-collected", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { collectedAmount, notes = "Cash settled in full at reception" } = req.body;

    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking reservation not found." });
    }

    const verifierName = req.user?.name || "Receptionist";
    const amount = Number(collectedAmount) || booking.totalAmount;

    // Create or update payment
    let payment = await Payment.findOne({ bookingId: booking.bookingId });
    if (!payment) {
      payment = new Payment({
        paymentId: `PAY-CASH-${booking.bookingId}`,
        bookingId: booking.bookingId,
        customerId: booking.userId || null,
        propertyName: booking.propertyName,
        guestName: booking.guest.name,
        guestEmail: booking.guest.email,
        guestPhone: booking.guest.phone || "",
        amount,
        currency: "INR",
        paymentMethod: "CASH",
        gateway: "CASH",
        transactionId: `CASH-${Date.now().toString().slice(-6)}`,
        paymentStatus: "PAID",
        verificationStatus: "VERIFIED",
        verifiedBy: verifierName,
        verificationNotes: notes,
        verifiedAt: new Date()
      });
    } else {
      payment.paymentStatus = "PAID";
      payment.verificationStatus = "VERIFIED";
      payment.verifiedBy = verifierName;
      payment.verificationNotes = notes;
      payment.verifiedAt = new Date();
    }

    payment.auditTrail.push({
      action: "CASH_COLLECTED",
      performedBy: verifierName,
      performedAt: new Date(),
      notes,
      newStatus: "PAID"
    });

    await payment.save();

    booking.paymentStatus = "PAID";
    booking.paidAmount = amount;
    booking.pendingAmount = Math.max(0, booking.totalAmount - amount);
    booking.bookingStatus = booking.bookingStatus === "Pending" ? "Confirmed" : booking.bookingStatus;

    booking.statusHistory.push({
      status: "Cash Collected (Paid)",
      changedAt: new Date(),
      changedBy: verifierName,
      note: `Cash payment of ₹${amount.toLocaleString("en-IN")} received at reception desk.`
    });

    await booking.save();

    try {
      await sendPaymentSuccessEmail(payment, booking);
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Cash payment of ₹${amount.toLocaleString("en-IN")} recorded successfully.`,
      data: { payment, booking }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to record cash collection" });
  }
});

// =========================================================================
// 4. RAZORPAY GATEWAY INTEGRATION
// =========================================================================

// POST /api/payments/create-order - Create Razorpay payment order
router.post("/create-order", tryAuthenticate, async (req, res) => {
  try {
    const { bookingId, amount, currency = "INR" } = req.body;

    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: "Valid payment amount is required." });
    }

    const orderData = await createRazorpayOrder({
      amount: Number(amount),
      currency,
      receipt: bookingId ? `rcpt_${bookingId}` : `rcpt_${Date.now()}`,
      notes: { bookingId: bookingId || "" }
    });

    return res.status(200).json({
      success: true,
      message: "Payment order created successfully",
      data: orderData
    });
  } catch (err) {
    console.error("Create payment order error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create payment order" });
  }
});

// POST /api/payments/verify - Secure Razorpay payment verification
router.post("/verify", tryAuthenticate, async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature,
      bookingId,
      amount,
      method = "Razorpay"
    } = req.body;

    const verification = verifyPaymentSignature({
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    });

    if (!verification.isValid) {
      return res.status(400).json({
        success: false,
        message: verification.message || "Payment signature verification failed."
      });
    }

    let booking = null;
    if (bookingId) {
      booking = await Booking.findOne({
        $or: [
          { bookingId },
          { bookingRef: bookingId },
          ...(bookingId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: bookingId }] : [])
        ]
      });
    }

    const transactionId = razorpayPaymentId || `TXN-${Date.now().toString().slice(-6)}`;
    const paymentAmount = Number(amount) || booking?.totalAmount || 0;
    const paymentId = `PAY-${booking?.bookingId || "GATEWAY"}-${Date.now().toString().slice(-5)}`;

    let payment = await Payment.findOne({ transactionId });
    if (!payment) {
      payment = new Payment({
        paymentId,
        transactionId,
        bookingId: booking?.bookingId || bookingId || "BK-MANUAL",
        propertyName: booking?.propertyName || "RR Luxury Stay",
        guestName: booking?.guest?.name || req.user?.name || "Guest",
        guestEmail: booking?.guest?.email || req.user?.email || "guest@example.com",
        amount: paymentAmount,
        currency: "INR",
        paymentMethod: "RAZORPAY",
        gateway: "RAZORPAY",
        paymentStatus: "PAID",
        verificationStatus: "VERIFIED",
        razorpayOrderId: razorpayOrderId || "",
        razorpayPaymentId: razorpayPaymentId || "",
        gatewaySignature: razorpaySignature || "",
        gatewayResponse: { verified: true, verifiedAt: new Date().toISOString() },
        auditTrail: [
          {
            action: "GATEWAY_PAYMENT_VERIFIED",
            performedBy: "Razorpay Gateway",
            performedAt: new Date(),
            notes: `Signature verified cryptographically for Payment ID ${razorpayPaymentId}`,
            newStatus: "PAID"
          }
        ]
      });
      await payment.save();
    }

    if (booking) {
      booking.paidAmount = (booking.paidAmount || 0) + paymentAmount;
      booking.pendingAmount = Math.max(0, (booking.totalAmount || 0) - booking.paidAmount);
      booking.paymentStatus = "PAID";
      booking.bookingStatus = "Confirmed";
      booking.razorpayOrderId = razorpayOrderId || booking.razorpayOrderId;
      booking.razorpayPaymentId = razorpayPaymentId || booking.razorpayPaymentId;
      booking.paymentMethod = "Razorpay Online";
      booking.holdExpiresAt = null;

      booking.statusHistory.push({
        status: "Payment Verified",
        changedAt: new Date(),
        changedBy: "Razorpay Gateway",
        note: `Payment of ₹${paymentAmount.toLocaleString("en-IN")} confirmed (Txn #${transactionId}).`
      });

      await booking.save();
    }

    try {
      await sendPaymentSuccessEmail(payment, booking);
    } catch (mailErr) {
      console.warn("Payment confirmation email notice:", mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: "Payment verified and recorded successfully.",
      data: {
        transactionId: payment.transactionId,
        bookingId: payment.bookingId,
        paymentStatus: payment.paymentStatus,
        amount: payment.amount
      }
    });
  } catch (err) {
    console.error("Payment verification error:", err);
    return res.status(500).json({ success: false, message: err.message || "Payment verification failed" });
  }
});

// POST /api/payments/webhook - Idempotent Razorpay Webhook Handler
router.post("/webhook", async (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = JSON.stringify(req.body);

    const isValid = verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === "payment.captured") {
      const paymentEntity = payload.payment.entity;
      const orderId = paymentEntity.order_id;
      const paymentId = paymentEntity.id;
      const amount = paymentEntity.amount / 100;

      const booking = await Booking.findOne({ razorpayOrderId: orderId });
      if (booking) {
        booking.paidAmount = amount;
        booking.pendingAmount = Math.max(0, booking.totalAmount - amount);
        booking.paymentStatus = "PAID";
        booking.bookingStatus = "Confirmed";
        booking.razorpayPaymentId = paymentId;
        booking.holdExpiresAt = null;
        await booking.save();
      }

      await Payment.findOneAndUpdate(
        { transactionId: paymentId },
        {
          paymentId: `PAY-${booking?.bookingId || orderId}-${Date.now().toString().slice(-4)}`,
          transactionId: paymentId,
          bookingId: booking?.bookingId || orderId,
          propertyName: booking?.propertyName || "RR Luxury Stay",
          guestName: booking?.guest?.name || paymentEntity.email || "Guest",
          guestEmail: booking?.guest?.email || paymentEntity.email || "guest@example.com",
          amount,
          paymentMethod: "RAZORPAY",
          gateway: "RAZORPAY",
          paymentStatus: "PAID",
          verificationStatus: "VERIFIED",
          razorpayOrderId: orderId,
          razorpayPaymentId: paymentId
        },
        { upsert: true, new: true }
      );
    }

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// =========================================================================
// 5. QUERY LISTING & HISTORICAL AUDIT
// =========================================================================

// GET /api/payments - Admin list of transactions
router.get("/", async (req, res) => {
  try {
    const { status, method, search } = req.query;
    const filter = {};

    if (status && status !== "ALL" && status !== "all") {
      if (status === "Successful") {
        filter.paymentStatus = { $in: ["PAID", "Success", "Successful"] };
      } else if (status === "Pending") {
        filter.paymentStatus = { $in: ["PENDING_VERIFICATION", "CASH_PENDING", "INITIATED", "Pending"] };
      } else if (status === "Refunded") {
        filter.paymentStatus = { $in: ["REFUNDED", "Refunded"] };
      } else {
        filter.paymentStatus = status;
      }
    }

    if (method && method !== "ALL" && method !== "all") {
      filter.paymentMethod = method;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { transactionId: regex },
        { utrNumber: regex },
        { bookingId: regex },
        { guestName: regex },
        { guestEmail: regex },
        { propertyName: regex }
      ];
    }

    const payments = await Payment.find(filter).sort({ createdAt: -1 });
    const totalAmount = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

    return res.status(200).json({
      success: true,
      count: payments.length,
      totalAmount,
      data: payments
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch payments" });
  }
});

// GET /api/payments/my - User payment history
router.get("/my", tryAuthenticate, async (req, res) => {
  try {
    const email = (req.query.email || req.user?.email || "").toLowerCase().trim();

    if (!email && !req.user) {
      return res.status(401).json({ success: false, message: "Email required for payment history" });
    }

    const query = {};
    if (req.user?._id) {
      query.$or = [{ customerId: req.user._id }, { guestEmail: email }];
    } else {
      query.guestEmail = email;
    }

    const payments = await Payment.find(query).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch payment history" });
  }
});

// GET /api/payments/:id - Single payment transaction
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findOne({
      $or: [
        { paymentId: id },
        { transactionId: id },
        { utrNumber: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!payment) return res.status(404).json({ success: false, message: "Payment transaction not found" });

    return res.status(200).json({ success: true, data: payment });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch payment details" });
  }
});

// POST & PUT /api/payments/:id/refund - Process refund
const handleRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, amount } = req.body;

    const payment = await Payment.findOne({
      $or: [
        { paymentId: id },
        { transactionId: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!payment) return res.status(404).json({ success: false, message: "Payment record not found" });

    if (payment.razorpayPaymentId) {
      await processRefund({
        paymentId: payment.razorpayPaymentId,
        amount: amount || payment.amount,
        notes: { reason: reason || "Customer requested refund" }
      });
    }

    payment.paymentStatus = "REFUNDED";
    payment.refundReason = reason || "Refund approved by management";
    payment.refundDate = new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    payment.auditTrail.push({
      action: "PAYMENT_REFUNDED",
      performedBy: req.user?.name || "Admin",
      performedAt: new Date(),
      notes: payment.refundReason,
      newStatus: "REFUNDED"
    });

    await payment.save();

    let booking = null;
    if (payment.bookingId) {
      booking = await Booking.findOneAndUpdate(
        { bookingId: payment.bookingId },
        {
          paymentStatus: "REFUNDED",
          bookingStatus: "Cancelled",
          statusCategory: "old",
          cancellationReason: reason || "Refund processed"
        },
        { new: true }
      );
    }

    try {
      await sendPaymentRefundEmail(payment, booking, reason);
    } catch (mailErr) {
      console.warn("Refund email notice:", mailErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Refund of ₹${payment.amount} processed successfully`,
      data: payment
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to process refund" });
  }
};

router.post("/:id/refund", handleRefund);
router.put("/:id/refund", handleRefund);

module.exports = router;
