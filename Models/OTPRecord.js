const mongoose = require("mongoose");

const otpRecordSchema = new mongoose.Schema(
  {
    identifier: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true
    },
    purpose: {
      type: String,
      enum: [
        "registration",
        "email_verification",
        "login",
        "login_otp",
        "password_reset",
        "admin_2fa",
        "general"
      ],
      default: "general"
    },
    otpHash: {
      type: String,
      required: true
    },
    attempts: {
      type: Number,
      default: 0
    },
    maxAttempts: {
      type: Number,
      default: 5
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: "10m" } // MongoDB TTL index to automatically clean up after 10m
    },
    resendAvailableAt: {
      type: Date,
      required: true
    },
    ipAddress: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("OTPRecord", otpRecordSchema);
