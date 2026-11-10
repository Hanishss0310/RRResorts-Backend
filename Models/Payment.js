const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    paymentId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    bookingId: {
      type: String,
      required: true,
      index: true
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true
    },
    propertyName: {
      type: String,
      required: true,
      default: "RR Resorts & Villas"
    },
    guestName: {
      type: String,
      required: true
    },
    guestEmail: {
      type: String,
      required: true
    },
    guestPhone: {
      type: String,
      default: ""
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: "INR"
    },
    paymentMethod: {
      type: String,
      required: true,
      default: "ONLINE_UPI"
    },
    gateway: {
      type: String,
      enum: ["DIRECT_UPI", "QR_MERCHANT", "RAZORPAY", "CASH", "MANUAL"],
      default: "DIRECT_UPI"
    },
    transactionId: {
      type: String,
      default: "",
      sparse: true,
      index: true
    },
    utrNumber: {
      type: String,
      default: "",
      sparse: true,
      index: true
    },
    payerUpiId: {
      type: String,
      default: ""
    },
    screenshotUrl: {
      type: String,
      default: ""
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
        "Success",
        "Successful",
        "Pending"
      ],
      default: "INITIATED",
      index: true
    },
    verificationStatus: {
      type: String,
      enum: ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"],
      default: "UNVERIFIED",
      index: true
    },
    verifiedBy: {
      type: String,
      default: null
    },
    verificationNotes: {
      type: String,
      default: ""
    },
    verifiedAt: {
      type: Date,
      default: null
    },
    gatewayOrderId: {
      type: String,
      default: ""
    },
    gatewayPaymentId: {
      type: String,
      default: ""
    },
    gatewaySignature: {
      type: String,
      default: ""
    },
    gatewayResponse: {
      type: mongoose.Schema.Types.Mixed,
      default: null
    },
    refundReason: {
      type: String,
      default: ""
    },
    refundDate: {
      type: String,
      default: ""
    },
    auditTrail: [
      {
        action: { type: String, required: true },
        performedBy: { type: String, default: "System" },
        performedAt: { type: Date, default: Date.now },
        notes: { type: String, default: "" },
        previousStatus: { type: String, default: "" },
        newStatus: { type: String, default: "" }
      }
    ],
    date: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Compatibility getters and virtuals
paymentSchema.virtual("method").get(function () {
  return this.paymentMethod;
});

paymentSchema.virtual("status").get(function () {
  if (this.paymentStatus === "PAID" || this.paymentStatus === "Success" || this.paymentStatus === "Successful") {
    return "Successful";
  }
  if (this.paymentStatus === "REFUNDED" || this.paymentStatus === "Refunded") {
    return "Refunded";
  }
  if (this.paymentStatus === "FAILED" || this.paymentStatus === "REJECTED") {
    return "Failed";
  }
  return "Pending";
});

paymentSchema.set("toJSON", { virtuals: true });
paymentSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("Payment", paymentSchema);
