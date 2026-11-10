const mongoose = require("mongoose");

const offerSchema = new mongoose.Schema(
  {
    offerId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    description: {
      type: String,
      default: ""
    },
    discountType: {
      type: String,
      enum: ["percentage", "fixed"],
      default: "percentage"
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0
    },
    minBookingAmount: {
      type: Number,
      default: 0
    },
    maxDiscount: {
      type: Number,
      default: 10000
    },
    validFrom: {
      type: Date,
      default: Date.now
    },
    validTo: {
      type: Date,
      required: true
    },
    usageLimit: {
      type: Number,
      default: 500
    },
    usageCount: {
      type: Number,
      default: 0
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    bannerImage: {
      type: String,
      default: ""
    },
    badge: {
      type: String,
      default: "Limited Offer"
    },
    applicableProperties: [
      {
        type: String
      }
    ]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Offer", offerSchema);

