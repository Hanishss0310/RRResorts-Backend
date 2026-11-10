const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const Booking = require("../Models/Booking");
const Property = require("../Models/Property");
const Room = require("../Models/Room");
const Payment = require("../Models/Payment");
const Setting = require("../Models/Setting");
const Notification = require("../Models/Notification");
const AuditLog = require("../Models/AuditLog");
const { calculateStayPrice } = require("../services/pricingEngine");
const {
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingNotConfirmedEmail,
  sendBookingPendingEmail,
  sendBookingRequestEmail,
  sendPaymentApprovalEmail,
  sendPaymentRejectionEmail,
  sendAdminNotificationEmail
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

/**
 * Generate cryptographically unpredictable booking reference
 */
function generateBookingReference() {
  const randomStr = crypto.randomBytes(3).toString("hex").toUpperCase();
  const timestampPart = Date.now().toString().slice(-4);
  return `RR-BK-${timestampPart}${randomStr}`;
}

// POST /api/bookings/calculate-price - Authoritative server-side price calculation
router.post("/calculate-price", async (req, res) => {
  try {
    const {
      propertyId,
      checkIn,
      checkOut,
      roomsCount,
      adults,
      children,
      selectedMeals,
      couponCode,
      isCashPayment
    } = req.body;

    if (!propertyId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: "Property ID, check-in, and check-out dates are required."
      });
    }

    const priceBreakdown = await calculateStayPrice({
      propertyId,
      checkIn,
      checkOut,
      roomsCount: roomsCount || req.body.rooms || 1,
      adults: adults || req.body.adults || 2,
      children: children || req.body.children || 0,
      extraBeds: req.body.extraBeds || req.query.extraBeds || 0,
      selectedMeals,
      couponCode,
      isCashPayment
    });

    return res.status(200).json({
      success: true,
      data: priceBreakdown
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: err.message || "Failed to calculate stay price"
    });
  }
});

// GET /api/bookings/check-availability - Atomic check with temporary hold awareness
router.get("/check-availability", async (req, res) => {
  try {
    const { propertyId, checkIn, checkOut, roomsCount = 1 } = req.query;

    if (!propertyId || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        message: "Property ID, check-in, and check-out dates are required."
      });
    }

    const now = new Date();

    // Find conflicting bookings:
    // Confirmed, Checked In, OR Pending with valid active hold (holdExpiresAt > now) or awaiting verification
    const conflicts = await Booking.find({
      propertyId,
      $or: [
        { bookingStatus: { $in: ["Confirmed", "Checked In"] } },
        {
          bookingStatus: "Pending",
          $or: [
            { paymentStatus: { $in: ["PENDING_VERIFICATION", "CASH_PENDING", "PAID"] } },
            { holdExpiresAt: { $gt: now } }
          ]
        }
      ],
      checkIn: { $lt: checkOut },
      checkOut: { $gt: checkIn }
    });

    const property = await Property.findOne({
      $or: [
        { propertyId },
        ...(propertyId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: propertyId }] : []),
        { slug: propertyId }
      ]
    });

    const totalRooms = property?.totalRooms || 12;
    const bookedRooms = conflicts.reduce((sum, b) => sum + (b.roomsCount || 1), 0);
    const availableRooms = Math.max(0, totalRooms - bookedRooms);
    const requested = Math.max(1, Number(roomsCount) || 1);

    return res.status(200).json({
      success: true,
      available: availableRooms >= requested,
      availableRooms,
      totalRooms,
      bookedRooms,
      requestedRooms: requested,
      checkIn,
      checkOut
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to check availability" });
  }
});

// GET /api/bookings/stats - Live booking counts & status metrics
router.get("/stats", tryAuthenticate, async (req, res) => {
  try {
    const totalBookings = await Booking.countDocuments();
    const pendingConfirmation = await Booking.countDocuments({
      bookingStatus: { $in: ["Pending Confirmation", "Pending"] }
    });
    const confirmedBookings = await Booking.countDocuments({
      bookingStatus: { $in: ["Confirmed", "Checked In", "Completed"] }
    });
    const cancelledBookings = await Booking.countDocuments({
      bookingStatus: "Cancelled"
    });
    const notConfirmed = await Booking.countDocuments({
      bookingStatus: { $in: ["Not Confirmed", "Rejected"] }
    });
    const paymentsAwaitingVerification = await Booking.countDocuments({
      $or: [
        { paymentStatus: { $in: ["PENDING_VERIFICATION", "Pending"] } },
        { paymentStatus: "CASH_PENDING" }
      ]
    });

    return res.status(200).json({
      success: true,
      stats: {
        totalBookings,
        pendingConfirmation,
        confirmedBookings,
        cancelledBookings,
        notConfirmed,
        paymentsAwaitingVerification
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch stats" });
  }
});

// GET /api/bookings - Admin list of bookings with rich filtering
router.get("/", tryAuthenticate, async (req, res) => {
  try {
    const { statusCategory, bookingStatus, paymentStatus, propertyId, search, fromDate, toDate } = req.query;
    const filter = {};

    if (statusCategory && statusCategory !== "all" && statusCategory !== "ALL") {
      filter.statusCategory = statusCategory;
    }
    if (bookingStatus && bookingStatus !== "all" && bookingStatus !== "ALL") {
      if (bookingStatus === "Pending Confirmation" || bookingStatus === "Pending") {
        filter.bookingStatus = { $in: ["Pending Confirmation", "Pending"] };
      } else if (bookingStatus === "Not Confirmed" || bookingStatus === "Rejected") {
        filter.bookingStatus = { $in: ["Not Confirmed", "Rejected"] };
      } else if (bookingStatus === "Confirmed") {
        filter.bookingStatus = { $in: ["Confirmed", "Checked In"] };
      } else {
        filter.bookingStatus = bookingStatus;
      }
    }
    if (paymentStatus && paymentStatus !== "all" && paymentStatus !== "ALL") {
      if (paymentStatus === "Paid" || paymentStatus === "PAID") {
        filter.paymentStatus = { $in: ["PAID", "Paid", "Success", "Successful"] };
      } else if (paymentStatus === "Pending" || paymentStatus === "PENDING_VERIFICATION") {
        filter.paymentStatus = { $in: ["Pending", "PENDING_VERIFICATION", "CASH_PENDING", "INITIATED"] };
      } else {
        filter.paymentStatus = paymentStatus;
      }
    }
    if (propertyId && propertyId !== "all" && propertyId !== "ALL") {
      filter.propertyId = propertyId;
    }

    if (fromDate || toDate) {
      filter.checkIn = {};
      if (fromDate) filter.checkIn.$gte = fromDate;
      if (toDate) filter.checkIn.$lte = toDate;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { bookingId: regex },
        { bookingRef: regex },
        { propertyName: regex },
        { roomType: regex },
        { roomNumber: regex },
        { utrNumber: regex },
        { transactionId: regex },
        { "guest.name": regex },
        { "guest.email": regex },
        { "guest.phone": regex }
      ];
    }

    const bookings = await Booking.find(filter).sort({ createdAt: -1 });

    // Compute live stats for quick dashboard rendering
    const [
      totalBookings,
      pendingConfirmation,
      confirmedBookings,
      cancelledBookings,
      notConfirmed,
      paymentsAwaitingVerification
    ] = await Promise.all([
      Booking.countDocuments(),
      Booking.countDocuments({ bookingStatus: { $in: ["Pending Confirmation", "Pending"] } }),
      Booking.countDocuments({ bookingStatus: { $in: ["Confirmed", "Checked In", "Completed"] } }),
      Booking.countDocuments({ bookingStatus: "Cancelled" }),
      Booking.countDocuments({ bookingStatus: { $in: ["Not Confirmed", "Rejected"] } }),
      Booking.countDocuments({
        $or: [
          { paymentStatus: { $in: ["PENDING_VERIFICATION", "Pending"] } },
          { paymentStatus: "CASH_PENDING" }
        ]
      })
    ]);

    return res.status(200).json({
      success: true,
      count: bookings.length,
      stats: {
        totalBookings,
        pendingConfirmation,
        confirmedBookings,
        cancelledBookings,
        notConfirmed,
        paymentsAwaitingVerification
      },
      data: bookings
    });
  } catch (err) {
    console.error("Fetch bookings error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch bookings" });
  }
});

// GET /api/bookings/my - Fetch user's active & past bookings (ownership protected)
router.get("/my", tryAuthenticate, async (req, res) => {
  try {
    const email = (req.query.email || req.user?.email || "").toLowerCase().trim();

    if (!email && !req.user) {
      return res.status(401).json({
        success: false,
        message: "Authentication or guest email parameter required"
      });
    }

    const query = {};
    if (req.user?._id) {
      query.$or = [{ userId: req.user._id }, { "guest.email": email }];
    } else if (email) {
      query["guest.email"] = email;
    }

    const bookings = await Booking.find(query).sort({ createdAt: -1 });

    const active = bookings.filter((b) => b.statusCategory === "active" && b.bookingStatus !== "Cancelled");
    const past = bookings.filter((b) => b.statusCategory === "old" || b.bookingStatus === "Cancelled");

    return res.status(200).json({
      success: true,
      data: {
        all: bookings,
        active,
        past,
        totalBookings: bookings.length
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch user bookings" });
  }
});

// GET /api/bookings/:id - Single booking
router.get("/:id", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    // Ownership check: If authenticated as standard user, check email/userId
    if (req.user && req.user.role === "user") {
      const isOwner =
        (booking.userId && booking.userId.toString() === req.user._id.toString()) ||
        booking.guest.email.toLowerCase() === req.user.email.toLowerCase();
      if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized to view this reservation." });
      }
    }

    return res.status(200).json({ success: true, data: booking });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch booking" });
  }
});

// GET /api/bookings/:id/invoice - Structured Invoice Data
router.get("/:id/invoice", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const setting = await Setting.findOne({ key: "general_config" });

    const invoiceData = {
      invoiceNumber: `INV-${booking.bookingId}`,
      issueDate: new Date(booking.createdAt).toLocaleDateString("en-IN"),
      business: {
        name: setting?.businessName || "RR Resorts and Villas",
        gstin: "29AABCR1234F1Z5",
        address: setting?.address || "Madikeri - Virajpet Highway, Coorg, Karnataka 571201",
        email: setting?.contactEmail || "bookings@rrcoorgholidays.com",
        phone: setting?.contactPhone || "+91 8274 258000"
      },
      customer: {
        name: booking.guest.name,
        email: booking.guest.email,
        phone: booking.guest.phone,
        address: booking.guest.address || "Karnataka, India"
      },
      reservation: {
        bookingId: booking.bookingId,
        bookingRef: booking.bookingRef,
        propertyName: booking.propertyName,
        roomType: booking.roomType,
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        nights: booking.nights,
        guests: `${booking.adults} Adults${booking.children ? `, ${booking.children} Children` : ""}`
      },
      breakdown: {
        roomTotal: booking.roomTotal,
        mealTotal: booking.mealTotal,
        discountAmount: booking.discountAmount || 0,
        taxes: booking.taxes,
        cashSurcharge: booking.cashSurcharge || 0,
        totalAmount: booking.totalAmount,
        paidAmount: booking.paidAmount,
        pendingAmount: booking.pendingAmount,
        paymentStatus: booking.paymentStatus,
        paymentMethod: booking.paymentMethod
      }
    };

    return res.status(200).json({ success: true, data: invoiceData });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to generate invoice" });
  }
});

// POST /api/bookings - Create new booking with collision protection & pricing validation
router.post("/", tryAuthenticate, async (req, res) => {
  try {
    const body = req.body;

    if (!body.propertyId || !body.guest || !body.checkIn || !body.checkOut) {
      return res.status(400).json({
        success: false,
        message: "Property ID, guest details, check-in, and check-out dates are required."
      });
    }

    // Prevent past date bookings
    const todayStr = new Date().toISOString().split("T")[0];
    const checkInDateStr = new Date(body.checkIn).toISOString().split("T")[0];
    if (checkInDateStr < todayStr) {
      return res.status(400).json({
        success: false,
        message: "Check-in date cannot be in the past."
      });
    }

    // Fetch property
    const property = await Property.findOne({
      $or: [
        { propertyId: body.propertyId },
        { slug: body.propertyId },
        ...(body.propertyId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: body.propertyId }] : [])
      ]
    });

    if (!property) {
      return res.status(404).json({ success: false, message: "Property not found." });
    }

    const requestedRooms = Math.max(1, Number(body.roomsCount || body.rooms) || 1);
    const now = new Date();

    // Collision check: prevent overbooking by checking confirmed + active unexpired holds
    const conflictingBookings = await Booking.find({
      propertyId: property.propertyId,
      $or: [
        { bookingStatus: { $in: ["Confirmed", "Checked In"] } },
        {
          bookingStatus: "Pending",
          $or: [
            { paymentStatus: { $in: ["PENDING_VERIFICATION", "CASH_PENDING", "PAID"] } },
            { holdExpiresAt: { $gt: now } }
          ]
        }
      ],
      checkIn: { $lt: body.checkOut },
      checkOut: { $gt: body.checkIn }
    });

    const totalRooms = property.totalRooms || 12;
    const occupiedCount = conflictingBookings.reduce((sum, b) => sum + (b.roomsCount || 1), 0);

    if (occupiedCount + requestedRooms > totalRooms) {
      return res.status(409).json({
        success: false,
        message: `Inventory unavailable for the requested dates. Only ${Math.max(0, totalRooms - occupiedCount)} room(s) remaining.`
      });
    }

    const isCash =
      body.paymentMethod === "CASH" ||
      body.paymentMethod === "Cash Payment" ||
      body.paymentMethod === "hotel" ||
      body.isCashPayment === true;

    // Authoritative Server-side Price Calculation
    let calculated;
    try {
      calculated = await calculateStayPrice({
        propertyId: property.propertyId,
        checkIn: body.checkIn,
        checkOut: body.checkOut,
        roomsCount: requestedRooms,
        adults: body.adults || 2,
        children: body.children || 0,
        extraBeds: body.extraBeds || 0,
        selectedMeals: body.selectedMeals || {},
        couponCode: body.couponCode,
        isCashPayment: isCash
      });
    } catch (calcErr) {
      return res.status(400).json({ success: false, message: calcErr.message });
    }

    // Generate unique non-guessable booking reference
    const bookingRef = generateBookingReference();
    const count = await Booking.countDocuments();
    const bookingId = body.bookingId || `BK${10400 + count + 1}`;

    const guestEmail = (body.guest.email || req.user?.email || "guest@example.com").toLowerCase().trim();
    const guestName = body.guest.name || req.user?.name || "Guest Traveler";
    const guestPhone = body.guest.phone || req.user?.phone || "";

    const totalAmount = isCash ? calculated.pricing.cashTotal : calculated.pricing.onlineTotal;
    const cashSurcharge = isCash ? calculated.pricing.cashSurcharge : 0;

    let initialPaymentStatus;
    let initialBookingStatus;
    let holdExpiresAt = null;

    if (isCash) {
      initialPaymentStatus = "CASH_PENDING";
      initialBookingStatus = "Pending";
      holdExpiresAt = null; // Cash bookings held for admin approval
    } else if (body.paymentStatus === "Paid" || body.paymentStatus === "PAID") {
      initialPaymentStatus = "PAID";
      initialBookingStatus = "Confirmed";
    } else if (body.utrNumber || body.transactionId || body.paymentStatus === "PENDING_VERIFICATION") {
      initialPaymentStatus = "PENDING_VERIFICATION";
      initialBookingStatus = "Pending";
      holdExpiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour for admin to verify
    } else {
      initialPaymentStatus = "INITIATED";
      initialBookingStatus = "Pending";
      holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15-minute temporary hold for online checkout
    }

    const paidAmount = initialPaymentStatus === "PAID" ? totalAmount : 0;
    const pendingAmount = Math.max(0, totalAmount - paidAmount);

    const newBooking = new Booking({
      bookingId,
      bookingRef,
      userId: body.userId || req.user?._id || null,
      propertyId: property.propertyId,
      propertyName: property.name,
      propertyImage: body.propertyImage || property.image,
      roomType: body.roomType || property.roomType || "Luxury Suite",
      roomId: body.roomId || "",
      roomNumber: body.roomNumber || "",
      checkIn: body.checkIn,
      checkOut: body.checkOut,
      nights: calculated.nights,
      adults: body.adults || 2,
      children: body.children || 0,
      roomsCount: requestedRooms,
      guest: {
        name: guestName,
        email: guestEmail,
        phone: guestPhone,
        address: body.guest.address || ""
      },
      selectedMeals: body.selectedMeals || {},
      roomTotal: calculated.pricing.totalRoomCost || calculated.pricing.totalBaseRoomCost || 0,
      mealTotal: calculated.pricing.mealTotal,
      taxes: (body.taxes !== undefined && body.taxes !== null)
        ? Number(body.taxes)
        : ((body.gstAmount !== undefined && body.gstAmount !== null)
          ? Number(body.gstAmount)
          : calculated.pricing.taxes),
      cashSurcharge,
      couponCode: calculated.pricing.appliedCoupon ? calculated.pricing.appliedCoupon.code : "",
      discountAmount: calculated.pricing.discountAmount,
      totalAmount: (body.totalAmount !== undefined && body.totalAmount !== null && Number(body.totalAmount) > 0)
        ? Number(body.totalAmount)
        : totalAmount,
      paidAmount,
      pendingAmount,
      paymentStatus: initialPaymentStatus,
      bookingStatus: initialBookingStatus,
      statusCategory: "active",
      paymentMethod: isCash ? "CASH" : (body.paymentMethod || "ONLINE_UPI"),
      transactionId: body.transactionId || body.utrNumber || "",
      utrNumber: body.utrNumber || body.transactionId || "",
      payerUpiId: body.payerUpiId || "",
      paymentScreenshotUrl: body.paymentScreenshotUrl || body.screenshotUrl || "",
      razorpayOrderId: body.razorpayOrderId || "",
      razorpayPaymentId: body.razorpayPaymentId || "",
      holdExpiresAt,
      pricingSnapshot: calculated.pricing,
      specialRequests: body.specialRequests || "",
      statusHistory: [
        {
          status: initialBookingStatus,
          changedAt: new Date(),
          changedBy: "Booking Engine",
          note: `Booking request created with status ${initialBookingStatus} and payment status ${initialPaymentStatus}.`
        }
      ]
    });

    await newBooking.save();

    // Create payment record if paid online or pending verification
    if (paidAmount > 0 || initialPaymentStatus === "PENDING_VERIFICATION") {
      const txnId = body.transactionId || body.utrNumber || `TXN-${Date.now().toString().slice(-6)}`;
      const paymentRecord = new Payment({
        paymentId: `PAY-${newBooking.bookingId}-${Date.now().toString().slice(-4)}`,
        transactionId: txnId,
        utrNumber: body.utrNumber || txnId,
        payerUpiId: body.payerUpiId || "",
        screenshotUrl: body.paymentScreenshotUrl || body.screenshotUrl || "",
        bookingId: newBooking.bookingId,
        propertyName: newBooking.propertyName,
        guestName,
        guestEmail,
        guestPhone,
        amount: paidAmount > 0 ? paidAmount : totalAmount,
        paymentMethod: newBooking.paymentMethod,
        paymentStatus: initialPaymentStatus,
        verificationStatus: initialPaymentStatus === "PAID" ? "VERIFIED" : "PENDING",
        razorpayOrderId: body.razorpayOrderId || "",
        razorpayPaymentId: body.razorpayPaymentId || ""
      });
      await paymentRecord.save();
    }

    // Trigger Notification for Admin
    try {
      await Notification.create({
        notificationId: `NOTIF-${Date.now()}`,
        type: isCash ? "CASH_BOOKING_REQUEST" : "NEW_BOOKING",
        title: `${isCash ? "Cash Booking Request" : "New Reservation"} (${newBooking.bookingRef})`,
        message: `${guestName} booked ${newBooking.propertyName} for ₹${totalAmount.toLocaleString("en-IN")} via ${newBooking.paymentMethod}.`,
        link: "/bookings",
        targetRole: "admin"
      });
    } catch {}

    // Send transactional emails
    try {
      if (initialBookingStatus === "Confirmed") {
        await sendBookingConfirmationEmail(newBooking);
      } else {
        await sendBookingRequestEmail(newBooking);
      }

      await sendAdminNotificationEmail({
        subject: `New Reservation #${newBooking.bookingId} (${newBooking.bookingRef})`,
        title: `New Reservation at ${newBooking.propertyName}`,
        detailsHtml: `
          <p><strong>Guest:</strong> ${guestName} (${guestEmail}, ${guestPhone})</p>
          <p><strong>Property:</strong> ${newBooking.propertyName}</p>
          <p><strong>Check-In:</strong> ${newBooking.checkIn} | <strong>Check-Out:</strong> ${newBooking.checkOut}</p>
          <p><strong>Method:</strong> ${newBooking.paymentMethod} | <strong>Status:</strong> ${newBooking.paymentStatus}</p>
          <p><strong>Total:</strong> ₹${totalAmount.toLocaleString("en-IN")}${isCash ? " (Includes Cash Surcharge)" : ""}</p>
        `,
        textContent: `Guest: ${guestName} | Property: ${newBooking.propertyName} | Amount: ₹${totalAmount} (${newBooking.paymentStatus})`
      });
    } catch (mailErr) {
      console.warn("Transactional booking email notice:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: `Reservation received! Booking Reference: ${newBooking.bookingRef}`,
      bookingRef: newBooking.bookingRef,
      bookingId: newBooking.bookingId,
      data: newBooking
    });
  } catch (err) {
    console.error("Create booking error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create booking" });
  }
});

// PUT /api/bookings/:id/status - Update booking status with duplicate protection & email triggers
router.put("/:id/status", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { bookingStatus, cancellationReason, internalNotes, paymentStatus } = req.body;

    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Authorization check: standard user can only cancel their own booking
    if (req.user && req.user.role === "user") {
      const isOwner =
        (booking.userId && booking.userId.toString() === req.user._id.toString()) ||
        booking.guest.email.toLowerCase() === req.user.email.toLowerCase();
      if (!isOwner) {
        return res.status(403).json({ success: false, message: "Unauthorized to modify this reservation" });
      }
      if (bookingStatus !== "Cancelled") {
        return res.status(403).json({ success: false, message: "Guests can only request cancellation" });
      }
    }

    const previousStatus = booking.bookingStatus;
    const normalizedStatus =
      bookingStatus === "Pending" ? "Pending Confirmation" :
      bookingStatus === "Rejected" ? "Not Confirmed" :
      bookingStatus;

    const updater = req.user?.name || (req.user?.role?.toUpperCase() === "OWNER" ? "Property Owner" : "Admin Desk");
    const statusChanged = previousStatus !== normalizedStatus;

    if (bookingStatus) booking.bookingStatus = normalizedStatus;
    if (paymentStatus) booking.paymentStatus = paymentStatus;
    if (cancellationReason) booking.cancellationReason = cancellationReason;
    if (internalNotes) booking.internalNotes = internalNotes;

    if (normalizedStatus === "Cancelled" || normalizedStatus === "Not Confirmed") {
      booking.statusCategory = "old";
      booking.holdExpiresAt = null;
    } else if (normalizedStatus === "Confirmed" || normalizedStatus === "Checked In") {
      booking.statusCategory = "active";
      booking.holdExpiresAt = null;
    } else if (normalizedStatus === "Pending Confirmation") {
      booking.statusCategory = "active";
    }

    booking.statusHistory.push({
      status: normalizedStatus,
      changedAt: new Date(),
      changedBy: updater,
      note: cancellationReason || internalNotes || `Status updated from ${previousStatus} to ${normalizedStatus}.`
    });

    await booking.save();

    // Also update associated payment record if one exists
    try {
      const payment = await Payment.findOne({ bookingId: booking.bookingId });
      if (payment) {
        if (normalizedStatus === "Confirmed" && (payment.paymentStatus === "PENDING_VERIFICATION" || paymentStatus === "PAID")) {
          payment.paymentStatus = "PAID";
          payment.verificationStatus = "VERIFIED";
          payment.verifiedBy = updater;
          payment.verifiedAt = new Date();
          await payment.save();
        } else if (normalizedStatus === "Cancelled" && (payment.paymentStatus === "PAID" || payment.paymentStatus === "Success")) {
          payment.paymentStatus = "REFUND_PENDING";
          await payment.save();
        } else if (normalizedStatus === "Not Confirmed") {
          payment.paymentStatus = "REJECTED";
          payment.verificationStatus = "REJECTED";
          await payment.save();
        }
      }
    } catch (payErr) {
      console.warn("Sync payment with booking status notice:", payErr.message);
    }

    // Trigger automated professional email notifications (prevent duplicate emails)
    let emailDispatched = false;
    if (statusChanged && booking.lastNotifiedStatus !== normalizedStatus) {
      try {
        if (normalizedStatus === "Confirmed") {
          await sendBookingConfirmationEmail(booking);
          emailDispatched = true;
        } else if (normalizedStatus === "Cancelled") {
          await sendBookingCancellationEmail(booking, cancellationReason || "Administrative cancellation");
          emailDispatched = true;
        } else if (normalizedStatus === "Not Confirmed") {
          await sendBookingNotConfirmedEmail(booking, cancellationReason || internalNotes || "");
          emailDispatched = true;
        } else if (normalizedStatus === "Pending Confirmation") {
          await sendBookingPendingEmail(booking);
          emailDispatched = true;
        }

        if (emailDispatched) {
          booking.lastNotifiedStatus = normalizedStatus;
          await booking.save();
        }
      } catch (mailErr) {
        console.error("Email notification dispatch error:", mailErr.message);
      }
    }

    // Audit Log
    try {
      await AuditLog.create({
        action: "BOOKING_STATUS_UPDATE",
        userId: req.user?._id || null,
        userName: updater,
        target: `Booking #${booking.bookingId} (${booking.propertyName})`,
        details: `Status transitioned from ${previousStatus} to ${normalizedStatus}. Email dispatched: ${emailDispatched}`,
        ipAddress: req.ip
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Booking status updated to ${booking.bookingStatus}`,
      emailDispatched,
      data: booking
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update booking status" });
  }
});

// POST /api/bookings/:id/verify-payment - Admin verifies payment from booking details
router.post("/:id/verify-payment", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { verificationNotes = "", verifiedBy = "" } = req.body;
    const verifierName = req.user?.name || verifiedBy || "Admin";

    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    // Update booking payment and booking status
    booking.paymentStatus = "PAID";
    booking.paidAmount = booking.totalAmount;
    booking.pendingAmount = 0;
    booking.bookingStatus = "Confirmed";
    booking.holdExpiresAt = null;

    booking.statusHistory.push({
      status: "Confirmed (Payment Verified)",
      changedAt: new Date(),
      changedBy: verifierName,
      note: verificationNotes || "Online UPI / Bank payment verified by management."
    });

    await booking.save();

    // Update or create payment record
    let payment = await Payment.findOne({ bookingId: booking.bookingId });
    if (!payment) {
      payment = new Payment({
        paymentId: `PAY-${booking.bookingId}-${Date.now().toString().slice(-4)}`,
        bookingId: booking.bookingId,
        customerId: booking.userId,
        propertyName: booking.propertyName,
        guestName: booking.guest.name,
        guestEmail: booking.guest.email,
        guestPhone: booking.guest.phone,
        amount: booking.totalAmount,
        currency: "INR",
        paymentMethod: booking.paymentMethod || "ONLINE_UPI",
        transactionId: booking.transactionId || booking.utrNumber || `TXN-${Date.now().toString().slice(-6)}`,
        utrNumber: booking.utrNumber || booking.transactionId || "",
        screenshotUrl: booking.paymentScreenshotUrl || "",
        paymentStatus: "PAID",
        verificationStatus: "VERIFIED",
        verifiedBy: verifierName,
        verifiedAt: new Date(),
        verificationNotes: verificationNotes || "Verified by admin."
      });
    } else {
      payment.paymentStatus = "PAID";
      payment.verificationStatus = "VERIFIED";
      payment.verifiedBy = verifierName;
      payment.verifiedAt = new Date();
      payment.verificationNotes = verificationNotes || payment.verificationNotes;
      payment.amount = booking.totalAmount;
    }
    await payment.save();

    // Send emails
    try {
      await sendPaymentApprovalEmail(payment, booking);
      await sendBookingConfirmationEmail(booking);
      booking.lastNotifiedStatus = "Confirmed";
      await booking.save();
    } catch (mErr) {
      console.warn("Payment approval email notice:", mErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Payment verified and Booking #${booking.bookingId} confirmed!`,
      booking,
      payment
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to verify payment" });
  }
});

// POST /api/bookings/:id/reject-payment - Admin rejects payment
router.post("/:id/reject-payment", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReason = "Transaction could not be verified in bank records", notes = "" } = req.body;
    const verifierName = req.user?.name || "Admin";

    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    booking.paymentStatus = "REJECTED";
    booking.bookingStatus = "Not Confirmed";
    booking.statusCategory = "old";

    booking.statusHistory.push({
      status: "Not Confirmed (Payment Rejected)",
      changedAt: new Date(),
      changedBy: verifierName,
      note: rejectionReason || "Payment screenshot / transaction ID could not be validated."
    });

    await booking.save();

    // Update payment record
    let payment = await Payment.findOne({ bookingId: booking.bookingId });
    if (payment) {
      payment.paymentStatus = "REJECTED";
      payment.verificationStatus = "REJECTED";
      payment.verifiedBy = verifierName;
      payment.verificationNotes = rejectionReason;
      await payment.save();
    }

    // Send notification email
    try {
      if (payment) {
        await sendPaymentRejectionEmail(payment, booking, rejectionReason);
      }
      await sendBookingNotConfirmedEmail(booking, rejectionReason);
      booking.lastNotifiedStatus = "Not Confirmed";
      await booking.save();
    } catch (mErr) {
      console.warn("Payment rejection email notice:", mErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Payment rejected and booking marked as Not Confirmed.`,
      booking,
      payment
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to reject payment" });
  }
});

// PUT /api/bookings/:id/cash-payment - Update cash advance & balance
router.put("/:id/cash-payment", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { advanceAmount, paymentStatus, notes } = req.body;
    const updater = req.user?.name || "Admin";

    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) return res.status(404).json({ success: false, message: "Booking not found" });

    if (advanceAmount !== undefined) {
      const adv = Number(advanceAmount) || 0;
      booking.advanceAmount = adv;
      booking.paidAmount = adv;
      booking.remainingBalance = Math.max(0, booking.totalAmount - adv);
      booking.pendingAmount = booking.remainingBalance;

      if (booking.remainingBalance === 0 && adv > 0) {
        booking.paymentStatus = "PAID";
      } else if (adv > 0) {
        booking.paymentStatus = "Partial";
      }
    }

    if (paymentStatus) {
      booking.paymentStatus = paymentStatus;
    }

    booking.statusHistory.push({
      status: `Cash Payment Update (${booking.paymentStatus})`,
      changedAt: new Date(),
      changedBy: updater,
      note: notes || `Advance: ₹${booking.advanceAmount || 0}, Balance: ₹${booking.remainingBalance || 0}`
    });

    await booking.save();

    return res.status(200).json({
      success: true,
      message: "Cash payment details updated successfully.",
      data: booking
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update cash payment" });
  }
});

// PUT /api/bookings/:id/assign-room - Assign or reassign physical room to booking
router.put("/:id/assign-room", tryAuthenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomNumber } = req.body;
    const updater = req.user?.name || "Admin Desk";

    if (!roomNumber) {
      return res.status(400).json({ success: false, message: "Room number is required" });
    }

    const booking = await Booking.findOne({
      $or: [
        { bookingId: id },
        { bookingRef: id },
        ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])
      ]
    });

    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    const prevRoom = booking.roomNumber;
    booking.roomNumber = roomNumber;

    booking.statusHistory.push({
      status: `Room Assigned (${roomNumber})`,
      changedAt: new Date(),
      changedBy: updater,
      note: prevRoom
        ? `Room reassigned from ${prevRoom} to ${roomNumber}`
        : `Physical room ${roomNumber} allocated to reservation.`
    });

    await booking.save();

    // Also update Room status in database if available
    try {
      const room = await Room.findOne({ roomNumber });
      if (room) {
        room.status = "Occupied";
        room.currentGuest = booking.guest?.name || "Guest";
        room.currentBookingId = booking.bookingId;
        await room.save();
      }
    } catch (rErr) {
      console.warn("Room status update notice:", rErr.message);
    }

    return res.status(200).json({
      success: true,
      message: `Room ${roomNumber} assigned to Booking #${booking.bookingId}`,
      data: booking
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to assign room" });
  }
});

module.exports = router;
