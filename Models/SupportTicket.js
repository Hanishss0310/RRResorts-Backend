const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: String,
      enum: ["Customer", "Staff", "user", "staff", "admin"],
      required: true
    },
    name: {
      type: String,
      required: true
    },
    time: {
      type: String,
      default: () => new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    },
    message: {
      type: String,
      required: true
    }
  },
  { _id: false }
);

const supportTicketSchema = new mongoose.Schema(
  {
    ticketId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    customer: {
      name: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String, default: "" }
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    bookingId: {
      type: String,
      default: "General Inquiry"
    },
    category: {
      type: String,
      enum: [
        "Booking Assistance",
        "Payment Assistance",
        "Cancellation & Refund",
        "Dietary & Meals",
        "Airport Transfer & Travel",
        "Amenities & Spa",
        "General Inquiry"
      ],
      default: "General Inquiry"
    },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium"
    },
    status: {
      type: String,
      enum: ["Open", "In Progress", "Resolved", "Closed"],
      default: "Open",
      index: true
    },
    assignedTo: {
      type: String,
      default: "Unassigned"
    },
    messages: [messageSchema]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
