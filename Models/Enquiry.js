const mongoose = require("mongoose");

const enquirySchema = new mongoose.Schema(
  {
    resortId: {
      type: String,
      default: ""
    },
    resortName: {
      type: String,
      default: "General Concierge"
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    topic: {
      type: String,
      trim: true,
      default: "General Enquiry"
    },
    subject: {
      type: String,
      trim: true,
      default: ""
    },
    message: {
      type: String,
      required: true
    },
    source: {
      type: String,
      enum: ["contact_form", "custom_enquiry", "concierge", "general"],
      default: "contact_form"
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Contacted", "Resolved", "Archived"],
      default: "Pending"
    },
    adminNotes: {
      type: String,
      default: ""
    },
    repliedBy: {
      type: String,
      default: ""
    },
    repliedAt: {
      type: Date
    },
    replyHistory: [
      {
        message: String,
        repliedBy: String,
        sentAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

// Indexes for fast searching and filtering
enquirySchema.index({ source: 1, status: 1, createdAt: -1 });
enquirySchema.index({ email: 1, phone: 1 });

module.exports = mongoose.model("Enquiry", enquirySchema);
