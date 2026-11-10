const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const staffSchema = new mongoose.Schema(
  {
    staffId: {
      type: String,
      required: true,
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
      trim: true
    },
    password: {
      type: String,
      required: false,
      default: ""
    },
    phone: {
      type: String,
      default: ""
    },
    role: {
      type: String,
      enum: ["OWNER", "MANAGER", "RECEPTIONIST", "HOUSEKEEPING", "CONCIERGE", "STAFF"],
      default: "RECEPTIONIST"
    },
    designation: {
      type: String,
      default: "Receptionist / Frontdesk"
    },
    permissions: {
      type: [String],
      default: [
        "dashboard",
        "bookings",
        "calendar",
        "rooms",
        "customers",
        "enquiries"
      ]
    },
    assignedProperties: [
      {
        type: String
      }
    ],
    active: {
      type: Boolean,
      default: true
    },
    avatar: {
      type: String,
      default: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
    },
    lastLogin: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving if modified
staffSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

staffSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return await bcrypt.compare(candidatePassword, this.password);
};

staffSchema.methods.toClientJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

module.exports = mongoose.model("Staff", staffSchema);
