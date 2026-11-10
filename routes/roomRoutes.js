const express = require("express");
const router = express.Router();
const Room = require("../Models/Room");

// GET /api/rooms - List all rooms with flexible filters
router.get("/", async (req, res) => {
  try {
    const { propertyId, status, floor, search } = req.query;
    const filter = {};

    if (propertyId && propertyId !== "all" && propertyId !== "ALL") {
      filter.$or = [
        { propertyId: propertyId },
        { propertyId: propertyId.toUpperCase() },
        { propertyName: new RegExp(`^${propertyId}$`, "i") }
      ];
    }
    if (status && status !== "all" && status !== "ALL") {
      filter.status = status;
    }
    if (floor && floor !== "all") {
      filter.floor = floor;
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [
        { roomId: regex },
        { roomNumber: regex },
        { propertyName: regex },
        { type: regex },
        { currentGuest: regex }
      ];
    }

    const rooms = await Room.find(filter).sort({ roomNumber: 1 });
    return res.status(200).json({ success: true, count: rooms.length, data: rooms });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch rooms" });
  }
});

// GET /api/rooms/occupancy-stats - Quick room stats
router.get("/occupancy-stats", async (req, res) => {
  try {
    const { propertyId } = req.query;
    const filter = {};
    if (propertyId && propertyId !== "all") filter.propertyId = propertyId;

    const rooms = await Room.find(filter);
    const total = rooms.length;
    const available = rooms.filter((r) => r.status === "Available").length;
    const occupied = rooms.filter((r) => r.status === "Occupied").length;
    const cleaning = rooms.filter((r) => r.status === "Cleaning").length;
    const reserved = rooms.filter((r) => r.status === "Reserved").length;
    const maintenance = rooms.filter((r) => r.status === "Maintenance").length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

    return res.status(200).json({
      success: true,
      data: {
        total,
        available,
        occupied,
        cleaning,
        reserved,
        maintenance,
        occupancyRate
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to get room stats" });
  }
});

// GET /api/rooms/:id - Get room by roomId or _id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const room = await Room.findOne({
      $or: [{ roomId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });
    if (!room) return res.status(404).json({ success: false, message: "Room not found" });
    return res.status(200).json({ success: true, data: room });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch room" });
  }
});

// POST /api/rooms - Create new room unit
router.post("/", async (req, res) => {
  try {
    const body = req.body;
    let roomId = body.roomId;
    if (!roomId) {
      roomId = `RM-${body.roomNumber || Date.now().toString().slice(-4)}`;
    }
    const newRoom = new Room({ ...body, roomId });
    await newRoom.save();
    return res.status(201).json({ success: true, message: "Room created successfully", data: newRoom });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to create room" });
  }
});

// PUT /api/rooms/:id/status - Update room operational status
router.put("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, currentGuest, currentBookingId } = req.body;

    const room = await Room.findOne({
      $or: [{ roomId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    room.status = status;
    if (status === "Available" || status === "Cleaning" || status === "Maintenance") {
      room.currentGuest = null;
      room.currentBookingId = null;
    } else {
      if (currentGuest !== undefined) room.currentGuest = currentGuest;
      if (currentBookingId !== undefined) room.currentBookingId = currentBookingId;
    }

    await room.save();
    return res.status(200).json({ success: true, message: `Room status updated to ${status}`, data: room });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update room" });
  }
});

// PUT /api/rooms/:id - Full update of room details
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const room = await Room.findOne({
      $or: [{ roomId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!room) return res.status(404).json({ success: false, message: "Room not found" });

    Object.assign(room, body);
    await room.save();

    return res.status(200).json({ success: true, message: "Room updated successfully", data: room });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update room" });
  }
});

// DELETE /api/rooms/:id - Delete room
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Room.findOneAndDelete({
      $or: [{ roomId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!deleted) return res.status(404).json({ success: false, message: "Room not found" });

    return res.status(200).json({ success: true, message: "Room removed successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete room" });
  }
});

module.exports = router;
