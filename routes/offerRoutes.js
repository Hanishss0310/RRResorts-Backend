const express = require("express");
const router = express.Router();
const Offer = require("../Models/Offer");
const AuditLog = require("../Models/AuditLog");

// GET /api/offers - Public list of active promotional offers & packages
router.get("/", async (req, res) => {
  try {
    const { all } = req.query;
    const filter = all === "true" ? {} : { isActive: true, validTo: { $gte: new Date() } };
    const offers = await Offer.find(filter).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: offers.length,
      data: offers
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch offers" });
  }
});

// GET /api/offers/:id - Single offer
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const offer = await Offer.findOne({
      $or: [{ offerId: id }, { code: id.toUpperCase() }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    return res.status(200).json({ success: true, data: offer });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch offer" });
  }
});

// POST /api/offers - Create new promotional package (Admin)
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    if (!body.title || !body.code || !body.discountValue) {
      return res.status(400).json({ success: false, message: "Title, coupon code, and discount value are required." });
    }

    const cleanCode = body.code.toUpperCase().trim();
    const existing = await Offer.findOne({ code: cleanCode });
    if (existing) {
      return res.status(409).json({ success: false, message: "An offer with this promo code already exists." });
    }

    const offerId = `OFFER-${Date.now().toString().slice(-6)}`;
    const newOffer = new Offer({
      offerId,
      title: body.title,
      code: cleanCode,
      description: body.description || "",
      discountType: body.discountType || "percentage",
      discountValue: Number(body.discountValue),
      minBookingAmount: Number(body.minBookingAmount || 0),
      maxDiscount: Number(body.maxDiscount || 10000),
      validFrom: body.validFrom || new Date(),
      validTo: body.validTo || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      usageLimit: Number(body.usageLimit || 500),
      isActive: body.isActive !== undefined ? body.isActive : true,
      bannerImage: body.bannerImage || "",
      badge: body.badge || "Special Offer",
      applicableProperties: body.applicableProperties || []
    });

    await newOffer.save();

    return res.status(201).json({
      success: true,
      message: "Special offer created successfully",
      data: newOffer
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to create offer" });
  }
});

// PUT /api/offers/:id - Update promotional offer (Admin)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const offer = await Offer.findOne({
      $or: [{ offerId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!offer) return res.status(404).json({ success: false, message: "Offer not found" });

    if (body.code) {
      offer.code = body.code.toUpperCase().trim();
    }
    if (body.title) offer.title = body.title;
    if (body.description !== undefined) offer.description = body.description;
    if (body.discountType) offer.discountType = body.discountType;
    if (body.discountValue !== undefined) offer.discountValue = Number(body.discountValue);
    if (body.minBookingAmount !== undefined) offer.minBookingAmount = Number(body.minBookingAmount);
    if (body.maxDiscount !== undefined) offer.maxDiscount = Number(body.maxDiscount);
    if (body.validTo) offer.validTo = body.validTo;
    if (body.usageLimit !== undefined) offer.usageLimit = Number(body.usageLimit);
    if (body.isActive !== undefined) offer.isActive = body.isActive;
    if (body.bannerImage !== undefined) offer.bannerImage = body.bannerImage;
    if (body.badge) offer.badge = body.badge;

    await offer.save();

    return res.status(200).json({
      success: true,
      message: "Offer updated successfully",
      data: offer
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update offer" });
  }
});

// DELETE /api/offers/:id - Remove offer (Admin)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Offer.findOneAndDelete({
      $or: [{ offerId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!deleted) return res.status(404).json({ success: false, message: "Offer not found" });

    return res.status(200).json({ success: true, message: "Offer deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete offer" });
  }
});

module.exports = router;

