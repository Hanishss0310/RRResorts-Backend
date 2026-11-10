const mongoose = require("mongoose");

const citySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    slug: {
      type: String,
      lowercase: true,
      trim: true
    },
    state: {
      type: String,
      default: "Karnataka",
      trim: true
    },
    country: {
      type: String,
      default: "India"
    },
    active: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("City", citySchema);

