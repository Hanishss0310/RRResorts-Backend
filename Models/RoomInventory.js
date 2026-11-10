const mongoose = require("mongoose");

const roomInventorySchema = new mongoose.Schema(
  {
    propertyId: {
      type: String,
      required: true,
      index: true
    },
    roomId: {
      type: String,
      default: ""
    },
    roomType: {
      type: String,
      required: true
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true
    },
    totalInventory: {
      type: Number,
      required: true,
      default: 1
    },
    bookedCount: {
      type: Number,
      default: 0
    },
    heldCount: {
      type: Number,
      default: 0
    },
    priceOverride: {
      type: Number,
      default: null
    },
    isAvailable: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

roomInventorySchema.index({ propertyId: 1, date: 1, roomType: 1 }, { unique: true });

module.exports = mongoose.model("RoomInventory", roomInventorySchema);

