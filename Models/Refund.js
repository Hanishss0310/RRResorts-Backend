const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    refundId: {
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
    paymentId: {
      type: String,
      default: ""
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    customerName: {
      type: String,
      required: true
    },
    customerEmail: {
      type: String,
      required: true
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
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "PROCESSED"],
      default: "PENDING",
      index: true
    },
    reason: {
      type: String,
      default: "Guest requested cancellation"
    },
    adminNotes: {
      type: String,
      default: ""
    },
    processedBy: {
      type: String,
      default: null
    },
    processedAt: {
      type: Date,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Refund", refundSchema);

