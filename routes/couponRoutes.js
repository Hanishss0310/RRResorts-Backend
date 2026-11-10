const express = require("express");
const router = express.Router();
const Coupon = require("../Models/Coupon");
const Offer = require("../Models/Offer");

// Unified helper to find and validate either a Coupon or an Offer
async function findAndValidatePromo(code, bookingAmount = 0, propertyId = null) {
  const cleanCode = String(code).toUpperCase().trim();
  const amt = Number(bookingAmount) || 0;
  const now = new Date();

  // 1. Try Coupon model first
  const coupon = await Coupon.findOne({ code: cleanCode });
  if (coupon) {
    const val = coupon.validateForBooking(amt, propertyId);
    return {
      found: true,
      valid: val.valid,
      message: val.message,
      discountAmount: val.discountAmount || 0,
      finalAmount: val.finalAmount || amt,
      source: "coupon",
      coupon: {
        code: coupon.code,
        title: coupon.title,
        description: coupon.description,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
        minBookingAmount: coupon.minBookingAmount,
        discountAmount: val.discountAmount || 0
      }
    };
  }

  // 2. Try Offer model (created from Admin Offers & Discounts)
  const offer = await Offer.findOne({ code: cleanCode });
  if (offer) {
    if (!offer.isActive) {
      return { found: true, valid: false, message: "This promotional offer is currently inactive." };
    }
    if (offer.validFrom && now < new Date(offer.validFrom)) {
      return { found: true, valid: false, message: "This promotional offer is not active yet." };
    }
    if (offer.validTo && now > new Date(offer.validTo)) {
      return { found: true, valid: false, message: "This promotional offer has expired." };
    }
    if (offer.usageLimit && offer.usageCount >= offer.usageLimit) {
      return { found: true, valid: false, message: "This promotional offer has reached its redemption limit." };
    }
    if (offer.minBookingAmount && amt < offer.minBookingAmount) {
      return {
        found: true,
        valid: false,
        message: `Minimum reservation booking value of ₹${offer.minBookingAmount.toLocaleString("en-IN")} required.`
      };
    }
    if (offer.applicableProperties && offer.applicableProperties.length > 0 && propertyId) {
      const isApplicable = offer.applicableProperties.some(
        (p) => p === propertyId || (propertyId.includes && propertyId.includes(p))
      );
      if (!isApplicable) {
        return { found: true, valid: false, message: "This offer is not applicable to the selected property." };
      }
    }

    let calculatedDiscount = 0;
    if (offer.discountType === "percentage") {
      calculatedDiscount = Math.round((amt * offer.discountValue) / 100);
      const maxD = offer.maxDiscount || 10000;
      if (maxD && calculatedDiscount > maxD) {
        calculatedDiscount = maxD;
      }
    } else {
      calculatedDiscount = Math.min(amt, offer.discountValue);
    }

    return {
      found: true,
      valid: true,
      message: `Promotion code ${offer.code} applied! Saved ₹${calculatedDiscount.toLocaleString("en-IN")}.`,
      discountAmount: calculatedDiscount,
      finalAmount: Math.max(0, amt - calculatedDiscount),
      source: "offer",
      coupon: {
        code: offer.code,
        title: offer.title,
        description: offer.description,
        discountType: offer.discountType,
        discountValue: offer.discountValue,
        minBookingAmount: offer.minBookingAmount,
        discountAmount: calculatedDiscount
      }
    };
  }

  return {
    found: false,
    valid: false,
    message: `Invalid promotion code: ${cleanCode}`
  };
}

// GET /api/coupons - List all coupons & active promotional offers
router.get("/", async (req, res) => {
  try {
    const [coupons, offers] = await Promise.all([
      Coupon.find().sort({ createdAt: -1 }),
      Offer.find({ isActive: true }).sort({ createdAt: -1 })
    ]);

    const combined = [...coupons];
    offers.forEach((o) => {
      if (!combined.some((c) => c.code === o.code)) {
        combined.push({
          _id: o._id,
          code: o.code,
          title: o.title,
          description: o.description,
          discountType: o.discountType,
          discountValue: o.discountValue,
          minBookingAmount: o.minBookingAmount,
          maxDiscountAmount: o.maxDiscount,
          startDate: o.validFrom,
          endDate: o.validTo,
          usageLimit: o.usageLimit,
          usedCount: o.usageCount,
          active: o.isActive,
          applicableProperties: o.applicableProperties,
          source: "offer"
        });
      }
    });

    return res.status(200).json({ success: true, count: combined.length, data: combined });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch coupons" });
  }
});

// GET /api/coupons/available - List all active coupons & offers with eligibility status for current cart
router.get("/available", async (req, res) => {
  try {
    const bookingAmount = Number(req.query.bookingAmount) || 0;
    const propertyId = req.query.propertyId ? String(req.query.propertyId).trim() : null;
    const now = new Date();

    const [coupons, offers] = await Promise.all([
      Coupon.find({ active: true, endDate: { $gte: now } }),
      Offer.find({ isActive: true, validTo: { $gte: now } })
    ]);

    const items = [];

    // 1. Process Coupons
    coupons.forEach((c) => {
      let isApplicable = true;
      let reasonIfNotApplicable = "";

      if (c.usageLimit && c.usedCount >= c.usageLimit) {
        isApplicable = false;
        reasonIfNotApplicable = "Redemption limit reached";
      } else if (c.minBookingAmount && bookingAmount > 0 && bookingAmount < c.minBookingAmount) {
        isApplicable = false;
        const diff = c.minBookingAmount - bookingAmount;
        reasonIfNotApplicable = `Requires min booking of ₹${c.minBookingAmount.toLocaleString("en-IN")} (Add ₹${diff.toLocaleString("en-IN")} more to unlock)`;
      } else if (c.applicableProperties && c.applicableProperties.length > 0 && propertyId) {
        const matches = c.applicableProperties.includes(propertyId);
        if (!matches) {
          isApplicable = false;
          reasonIfNotApplicable = "Not applicable for this resort";
        }
      }

      let estDiscount = 0;
      if (c.discountType === "percentage") {
        estDiscount = bookingAmount > 0 ? Math.round((bookingAmount * c.discountValue) / 100) : 0;
        if (c.maxDiscountAmount && estDiscount > c.maxDiscountAmount) {
          estDiscount = c.maxDiscountAmount;
        }
      } else {
        estDiscount = Math.min(bookingAmount || c.discountValue, c.discountValue);
      }

      items.push({
        id: c._id,
        code: c.code,
        title: c.title,
        description: c.description,
        discountType: c.discountType,
        discountValue: c.discountValue,
        minBookingAmount: c.minBookingAmount || 0,
        maxDiscount: c.maxDiscountAmount || null,
        isApplicable,
        reasonIfNotApplicable,
        estimatedDiscount: estDiscount,
        badge: c.discountType === "percentage" ? `${c.discountValue}% OFF` : `₹${c.discountValue.toLocaleString("en-IN")} OFF`,
        source: "coupon"
      });
    });

    // 2. Process Offers
    offers.forEach((o) => {
      if (items.some((it) => it.code === o.code)) return;

      let isApplicable = true;
      let reasonIfNotApplicable = "";

      if (o.usageLimit && o.usageCount >= o.usageLimit) {
        isApplicable = false;
        reasonIfNotApplicable = "Redemption limit reached";
      } else if (o.minBookingAmount && bookingAmount > 0 && bookingAmount < o.minBookingAmount) {
        isApplicable = false;
        const diff = o.minBookingAmount - bookingAmount;
        reasonIfNotApplicable = `Requires min booking of ₹${o.minBookingAmount.toLocaleString("en-IN")} (Add ₹${diff.toLocaleString("en-IN")} more to unlock)`;
      } else if (o.applicableProperties && o.applicableProperties.length > 0 && propertyId) {
        const matches = o.applicableProperties.some(
          (p) => p === propertyId || (propertyId.includes && propertyId.includes(p))
        );
        if (!matches) {
          isApplicable = false;
          reasonIfNotApplicable = "Not applicable for this resort";
        }
      }

      let estDiscount = 0;
      if (o.discountType === "percentage") {
        estDiscount = bookingAmount > 0 ? Math.round((bookingAmount * o.discountValue) / 100) : 0;
        const maxD = o.maxDiscount || 10000;
        if (maxD && estDiscount > maxD) estDiscount = maxD;
      } else {
        estDiscount = Math.min(bookingAmount || o.discountValue, o.discountValue);
      }

      items.push({
        id: o._id,
        code: o.code,
        title: o.title,
        description: o.description,
        discountType: o.discountType,
        discountValue: o.discountValue,
        minBookingAmount: o.minBookingAmount || 0,
        maxDiscount: o.maxDiscount || 10000,
        isApplicable,
        reasonIfNotApplicable,
        estimatedDiscount: estDiscount,
        badge: o.badge || (o.discountType === "percentage" ? `${o.discountValue}% OFF` : `₹${o.discountValue.toLocaleString("en-IN")} OFF`),
        source: "offer"
      });
    });

    // Sort: applicable first, then by highest savings
    items.sort((a, b) => {
      if (a.isApplicable && !b.isApplicable) return -1;
      if (!a.isApplicable && b.isApplicable) return 1;
      return (b.estimatedDiscount || 0) - (a.estimatedDiscount || 0);
    });

    return res.status(200).json({
      success: true,
      count: items.length,
      data: items
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch available coupons" });
  }
});

// POST /api/coupons/validate - Validate coupon for customer checkout (Supports both Coupon & Offer)
router.post("/validate", async (req, res) => {
  try {
    const { code, bookingAmount, propertyId } = req.body;

    if (!code) {
      return res.status(400).json({ success: false, valid: false, message: "Promotion code is required." });
    }

    const result = await findAndValidatePromo(code, bookingAmount, propertyId);

    if (!result.found) {
      return res.status(404).json({ success: false, valid: false, message: result.message });
    }

    if (!result.valid) {
      return res.status(400).json({ success: false, valid: false, message: result.message });
    }

    return res.status(200).json({
      success: true,
      valid: true,
      message: result.message,
      discountAmount: result.discountAmount,
      finalAmount: result.finalAmount,
      coupon: result.coupon,
      data: {
        code: result.coupon.code,
        title: result.coupon.title,
        discountType: result.coupon.discountType,
        discountValue: result.coupon.discountValue,
        discountAmount: result.discountAmount,
        finalAmount: result.finalAmount
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, valid: false, message: err.message || "Failed to validate coupon" });
  }
});

// POST /api/coupons - Create coupon (admin)
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    if (!body.code || !body.discountValue || !body.endDate) {
      return res.status(400).json({
        success: false,
        message: "Code, discount value, and expiry date are required."
      });
    }

    const cleanCode = body.code.toUpperCase().trim();
    const existing = await Coupon.findOne({ code: cleanCode });
    if (existing) {
      return res.status(400).json({ success: false, message: "A coupon with this code already exists." });
    }

    const coupon = new Coupon({
      ...body,
      code: cleanCode
    });
    await coupon.save();

    return res.status(201).json({ success: true, message: "Coupon created successfully", data: coupon });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to create coupon" });
  }
});

// PUT /api/coupons/:id - Update coupon (admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await Coupon.findByIdAndUpdate(id, req.body, { new: true });
    if (!updated) return res.status(404).json({ success: false, message: "Coupon not found" });

    return res.status(200).json({ success: true, message: "Coupon updated successfully", data: updated });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update coupon" });
  }
});

// DELETE /api/coupons/:id - Delete coupon (admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Coupon.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "Coupon not found" });

    return res.status(200).json({ success: true, message: "Coupon deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete coupon" });
  }
});

module.exports = router;
