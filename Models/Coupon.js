const mongoose = require("mongoose");

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      default: ""
    },
    discountType: {
      type: String,
      enum: ["percentage", "flat"],
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
    maxDiscountAmount: {
      type: Number,
      default: null // null for unlimited discount cap
    },
    startDate: {
      type: Date,
      default: Date.now
    },
    endDate: {
      type: Date,
      required: true
    },
    usageLimit: {
      type: Number,
      default: 100
    },
    usedCount: {
      type: Number,
      default: 0
    },
    active: {
      type: Boolean,
      default: true
    },
    applicableProperties: [{ type: String }] // property IDs or empty array for all
  },
  {
    timestamps: true
  }
);

// Method to validate if coupon is eligible for a booking
couponSchema.methods.validateForBooking = function (bookingAmount, propertyId) {
  const now = new Date();

  if (!this.active) {
    return { valid: false, message: "This promotion code is currently inactive." };
  }

  if (now < new Date(this.startDate)) {
    return { valid: false, message: "This coupon is not active yet." };
  }

  if (now > new Date(this.endDate)) {
    return { valid: false, message: "This promotional coupon has expired." };
  }

  if (this.usageLimit && this.usedCount >= this.usageLimit) {
    return { valid: false, message: "This coupon has reached its maximum redemption limit." };
  }

  if (this.minBookingAmount && bookingAmount < this.minBookingAmount) {
    return {
      valid: false,
      message: `Minimum reservation booking value of ₹${this.minBookingAmount.toLocaleString("en-IN")} required.`
    };
  }

  if (this.applicableProperties && this.applicableProperties.length > 0) {
    if (!this.applicableProperties.includes(propertyId)) {
      return { valid: false, message: "This coupon is not applicable to the selected property." };
    }
  }

  let calculatedDiscount = 0;
  if (this.discountType === "percentage") {
    calculatedDiscount = Math.round((bookingAmount * this.discountValue) / 100);
    if (this.maxDiscountAmount && calculatedDiscount > this.maxDiscountAmount) {
      calculatedDiscount = this.maxDiscountAmount;
    }
  } else {
    calculatedDiscount = Math.min(bookingAmount, this.discountValue);
  }

  return {
    valid: true,
    discountAmount: calculatedDiscount,
    finalAmount: Math.max(0, bookingAmount - calculatedDiscount),
    message: `Promotion code ${this.code} applied! Saved ₹${calculatedDiscount.toLocaleString("en-IN")}.`
  };
};

module.exports = mongoose.model("Coupon", couponSchema);
