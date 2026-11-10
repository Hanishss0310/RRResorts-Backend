const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    propertyId: {
      type: String,
      required: true,
      index: true
    },
    propertyName: {
      type: String,
      required: true
    },
    propertyImage: {
      type: String,
      default: ""
    },
    roomType: {
      type: String,
      default: "Luxury Suite"
    },
    roomId: {
      type: String,
      default: ""
    },
    roomNumber: {
      type: String,
      default: ""
    },
    checkIn: {
      type: String,
      required: true,
      index: true
    },
    checkOut: {
      type: String,
      required: true,
      index: true
    },
    nights: {
      type: Number,
      required: true,
      default: 1
    },
    adults: {
      type: Number,
      default: 2
    },
    children: {
      type: Number,
      default: 0
    },
    roomsCount: {
      type: Number,
      default: 1
    },
    guest: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true, index: true },
      phone: { type: String, required: true },
      address: { type: String, default: "" }
    },
    selectedMeals: {
      breakfast: { type: Number, default: 0 },
      lunch: { type: Number, default: 0 },
      dinner: { type: Number, default: 0 },
      romantic: { type: Number, default: 0 }
    },
    roomTotal: {
      type: Number,
      required: true
    },
    mealTotal: {
      type: Number,
      default: 0
    },
    taxes: {
      type: Number,
      default: 0
    },
    cashSurcharge: {
      type: Number,
      default: 0
    },
    totalAmount: {
      type: Number,
      required: true
    },
    paidAmount: {
      type: Number,
      default: 0
    },
    pendingAmount: {
      type: Number,
      default: 0
    },
    paymentStatus: {
      type: String,
      enum: [
        "INITIATED",
        "PENDING_VERIFICATION",
        "PENDING_GATEWAY",
        "PAID",
        "FAILED",
        "REJECTED",
        "REFUND_PENDING",
        "REFUNDED",
        "CASH_PENDING",
        "Paid",
        "Pending",
        "Partial"
      ],
      default: "Pending",
      index: true
    },
    bookingStatus: {
      type: String,
      enum: [
        "Pending",
        "Confirmed",
        "Checked In",
        "Completed",
        "Cancelled",
        "Rejected",
        "Pending Confirmation",
        "Not Confirmed"
      ],
      default: "Pending Confirmation",
      index: true
    },
    lastNotifiedStatus: {
      type: String,
      default: ""
    },
    advanceAmount: {
      type: Number,
      default: 0
    },
    remainingBalance: {
      type: Number,
      default: 0
    },
    statusCategory: {
      type: String,
      enum: ["active", "old"],
      default: "active",
      index: true
    },
    bookingRef: {
      type: String,
      sparse: true,
      index: true
    },
    couponCode: {
      type: String,
      default: ""
    },
    discountAmount: {
      type: Number,
      default: 0
    },
    razorpayOrderId: {
      type: String,
      default: ""
    },
    razorpayPaymentId: {
      type: String,
      default: ""
    },
    paymentMethod: {
      type: String,
      default: "ONLINE_UPI"
    },
    transactionId: {
      type: String,
      default: ""
    },
    utrNumber: {
      type: String,
      default: ""
    },
    payerUpiId: {
      type: String,
      default: ""
    },
    paymentScreenshotUrl: {
      type: String,
      default: ""
    },
    holdExpiresAt: {
      type: Date,
      default: null,
      index: true
    },
    pricingSnapshot: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        changedBy: { type: String, default: "System" },
        note: { type: String, default: "" }
      }
    ],
    cancellationReason: {
      type: String,
      default: ""
    },
    internalNotes: {
      type: String,
      default: ""
    },
    specialRequests: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Booking", bookingSchema);
