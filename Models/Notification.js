const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    notificationId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: [
        "NEW_BOOKING",
        "BOOKING_STATUS",
        "PAYMENT_RECEIVED",
        "PAYMENT_REFUND",
        "CHECKIN_TODAY",
        "CHECKOUT_TODAY",
        "SUPPORT_TICKET",
        "REVIEW_POSTED",
        "SYSTEM_ALERT"
      ],
      default: "SYSTEM_ALERT"
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    link: {
      type: String,
      default: "/dashboard"
    },
    read: {
      type: Boolean,
      default: false,
      index: true
    },
    targetRole: {
      type: String,
      enum: ["all", "admin", "owner", "receptionist", "user"],
      default: "admin"
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Notification", notificationSchema);
