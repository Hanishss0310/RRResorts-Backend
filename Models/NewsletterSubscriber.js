const mongoose = require("mongoose");
const crypto = require("crypto");

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    active: {
      type: Boolean,
      default: true
    },
    subscribedAt: {
      type: Date,
      default: Date.now
    },
    unsubscribedAt: {
      type: Date,
      default: null
    },
    unsubscribeToken: {
      type: String,
      default: () => crypto.randomBytes(24).toString("hex"),
      unique: true,
      index: true
    },
    source: {
      type: String,
      default: "footer_signup"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
