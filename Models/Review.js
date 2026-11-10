const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    reviewId: {
      type: String,
      default: () => `REV-${Math.floor(100 + Math.random() * 900)}`
    },
    propertyId: {
      type: String,
      required: true,
      index: true
    },
    propertyName: {
      type: String,
      required: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    userName: {
      type: String,
      required: true
    },
    userAvatar: {
      type: String,
      default: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    title: {
      type: String,
      default: ""
    },
    comment: {
      type: String,
      required: true
    },
    verifiedStay: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: ["Approved", "Published", "Pending", "Flagged"],
      default: "Approved"
    },
    adminReply: {
      type: String,
      default: null
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Review", reviewSchema);
