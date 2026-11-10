const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    roomNumber: {
      type: String,
      required: true
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
    type: {
      type: String,
      required: true
    },
    capacity: {
      type: Number,
      default: 2
    },
    price: {
      type: Number,
      required: true
    },
    status: {
      type: String,
      enum: ["Available", "Occupied", "Reserved", "Cleaning", "Maintenance"],
      default: "Available",
      index: true
    },
    currentGuest: {
      type: String,
      default: null
    },
    currentBookingId: {
      type: String,
      default: null
    },
    floor: {
      type: String,
      default: "Ground"
    },
    amenities: [{ type: String }]
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Room", roomSchema);
