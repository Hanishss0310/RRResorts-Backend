const express = require("express");
const router = express.Router();
const Review = require("../Models/Review");
const Property = require("../Models/Property");
const Notification = require("../Models/Notification");

// Helper to recalculate property rating
async function updatePropertyRating(propertyId) {
  try {
    const reviews = await Review.find({ propertyId, status: { $in: ["Approved", "Published"] } });
    if (reviews.length > 0) {
      const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
      const rounded = Math.round(avg * 10) / 10;
      await Property.findOneAndUpdate(
        { $or: [{ propertyId }, ...(propertyId.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: propertyId }] : [])] },
        { rating: rounded, reviewsCount: reviews.length }
      );
    }
  } catch (err) {
    console.warn("Rating recalculation notice:", err.message);
  }
}

// GET /api/reviews - Fetch reviews
router.get("/", async (req, res) => {
  try {
    const { propertyId, status, minRating } = req.query;
    const filter = {};

    if (propertyId && propertyId !== "all") filter.propertyId = propertyId;
    if (status && status !== "ALL" && status !== "all") filter.status = status;
    if (minRating) filter.rating = { $gte: Number(minRating) };

    const reviews = await Review.find(filter).sort({ createdAt: -1 });

    const totalReviews = reviews.length;
    const avgRating = totalReviews > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(1) : "5.0";

    return res.status(200).json({
      success: true,
      count: totalReviews,
      averageRating: Number(avgRating),
      data: reviews
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch reviews" });
  }
});

// GET /api/reviews/:id - Single review
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const review = await Review.findOne({
      $or: [{ reviewId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    return res.status(200).json({ success: true, data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch review" });
  }
});

// POST /api/reviews - Submit review
router.post("/", async (req, res) => {
  try {
    const { propertyId, propertyName, userId, userName, userAvatar, rating, title, comment, review } = req.body;

    const reviewText = comment || review;
    if (!propertyId || !rating || !reviewText) {
      return res.status(400).json({ success: false, message: "Property ID, rating, and review text are required." });
    }

    const reviewId = req.body.reviewId || `REV-${Math.floor(100 + Math.random() * 900)}`;

    const newReview = new Review({
      reviewId,
      propertyId,
      propertyName: propertyName || "Resort Property",
      userId: userId || null,
      userName: userName || "Verified Guest",
      userAvatar: userAvatar || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
      rating: Number(rating),
      title: title || "",
      comment: reviewText,
      verifiedStay: true,
      status: "Approved"
    });

    await newReview.save();
    await updatePropertyRating(propertyId);

    // Trigger Notification
    try {
      const notif = new Notification({
        notificationId: `NOTIF-${Date.now()}`,
        type: "REVIEW_POSTED",
        title: "New Review Posted",
        message: `${newReview.userName} rated ${newReview.propertyName} with ${newReview.rating}⭐.`,
        link: "/reviews",
        targetRole: "admin"
      });
      await notif.save();
    } catch (notifErr) {
      console.warn("Notification error:", notifErr.message);
    }

    return res.status(201).json({ success: true, message: "Review posted successfully", data: newReview });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to submit review" });
  }
});

// PUT /api/reviews/:id/status - Moderate review status
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const review = await Review.findOne({
      $or: [{ reviewId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.status = status;
    await review.save();
    await updatePropertyRating(review.propertyId);

    return res.status(200).json({ success: true, message: `Review status updated to ${status}`, data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update review status" });
  }
});

// PUT /api/reviews/:id/reply - Add admin reply to review
router.put("/:id/reply", async (req, res) => {
  try {
    const { id } = req.params;
    const { adminReply, replyText } = req.body;

    const review = await Review.findOne({
      $or: [{ reviewId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!review) return res.status(404).json({ success: false, message: "Review not found" });

    review.adminReply = adminReply || replyText;
    await review.save();

    return res.status(200).json({ success: true, message: "Admin reply posted", data: review });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to post reply" });
  }
});

// DELETE /api/reviews/:id - Delete review
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Review.findOneAndDelete({
      $or: [{ reviewId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!deleted) return res.status(404).json({ success: false, message: "Review not found" });

    await updatePropertyRating(deleted.propertyId);

    return res.status(200).json({ success: true, message: "Review deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete review" });
  }
});

module.exports = router;
