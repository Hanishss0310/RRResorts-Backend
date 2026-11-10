const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      sparse: true,
      unique: true,
      index: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true
    },
    password: {
      type: String,
      default: null // null for Google OAuth accounts
    },
    avatar: {
      type: String,
      default: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80"
    },
    role: {
      type: String,
      enum: ["user", "owner", "OWNER", "receptionist", "RECEPTIONIST", "admin", "ADMIN", "superadmin", "manager", "MANAGER", "staff", "STAFF"],
      default: "user"
    },
    permissions: {
      type: [String],
      default: []
    },
    isEmailVerified: {
      type: Boolean,
      default: false
    },
    resetPasswordToken: {
      type: String,
      default: null
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },
    phone: {
      type: String,
      default: ""
    },
    address: {
      type: String,
      default: ""
    },
    city: {
      type: String,
      default: ""
    },
    country: {
      type: String,
      default: "India"
    },
    membership: {
      type: String,
      default: "Gold Tier Guest"
    },
    authProvider: {
      type: String,
      enum: ["google", "local"],
      default: "local"
    },
    preferences: {
      emailNotifications: { type: Boolean, default: true },
      bookingNotifications: { type: Boolean, default: true },
      paymentNotifications: { type: Boolean, default: true },
      promotionalEmails: { type: Boolean, default: false },
      currency: { type: String, default: "INR (₹)" },
      language: { type: String, default: "English" }
    }
  },
  {
    timestamps: true
  }
);

// Method to sanitize user for frontend output
userSchema.methods.toClientJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
