const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "general_config"
    },
    businessName: {
      type: String,
      default: "RR Resorts and Villas"
    },
    resortName: {
      type: String,
      default: "RR Resorts and Villas"
    },
    businessEmail: {
      type: String,
      default: "donotreply.rrresortsandvillas@gmail.com"
    },
    contactEmail: {
      type: String,
      default: "bookings@rrcoorgholidays.com"
    },
    contactPhone: {
      type: String,
      default: "+91 8274 258000"
    },
    address: {
      type: String,
      default: "Madikeri - Virajpet Highway, Stuart Hill, Coorg, Karnataka 571201"
    },
    upiId: {
      type: String,
      default: "rrresorts@icici"
    },
    merchantQrCodeUrl: {
      type: String,
      default: ""
    },
    cashSurchargeBase: {
      type: Number,
      default: 150
    },
    cashSurchargePercent: {
      type: Number,
      default: 0.02 // 2%
    },
    taxPercentage: {
      type: Number,
      default: 12
    },
    currency: {
      type: String,
      default: "INR"
    },
    checkInTime: {
      type: String,
      default: "13:00"
    },
    checkOutTime: {
      type: String,
      default: "11:00"
    },
    bookingHoldMinutes: {
      type: Number,
      default: 15
    },
    freeCancellationHours: {
      type: Number,
      default: 48
    },
    refundPercentage: {
      type: Number,
      default: 100
    },
    cancellationFee: {
      type: Number,
      default: 0
    },
    cancellationTerms: {
      type: String,
      default: "Full refund guaranteed when cancelled at least 48 hours prior to check-in. 50% refund between 24-48 hours. Non-refundable within 24 hours."
    },
    emailNotifications: {
      type: Boolean,
      default: true
    },
    smsAlerts: {
      type: Boolean,
      default: true
    },
    dailyDigest: {
      type: Boolean,
      default: false
    },
    smtpStatus: {
      type: String,
      enum: ["configured", "pending", "sandbox"],
      default: "sandbox"
    },
    bankDetails: {
      accountHolder: { type: String, default: "RR Coorg Holidays Pvt Ltd" },
      accountNumber: { type: String, default: "987654321098" },
      ifscCode: { type: String, default: "HDFC0001234" },
      bankName: { type: String, default: "HDFC Bank, Madikeri Branch" },
      upiId: { type: String, default: "rrresorts@icici" }
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Setting", settingSchema);
