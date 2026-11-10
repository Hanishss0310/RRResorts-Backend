const express = require("express");
const router = express.Router();
const User = require("../Models/User");
const Booking = require("../Models/Booking");
const { authenticateUser } = require("./authRoutes");

// GET /api/users - List customers (Admin)
router.get("/", async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter = {};

    if (role && role !== "all") {
      filter.role = role;
    } else {
      filter.role = "user";
    }

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { city: regex }];
    }

    const users = await User.find(filter).sort({ createdAt: -1 });

    // Aggregate with their bookings
    const customers = await Promise.all(
      users.map(async (u) => {
        const bookings = await Booking.find({ "guest.email": u.email });
        const totalSpent = bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
        return {
          id: u._id,
          _id: u._id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          city: u.city,
          country: u.country,
          membership: u.membership,
          authProvider: u.authProvider,
          avatar: u.avatar,
          totalBookings: bookings.length,
          totalSpent,
          joinedDate: u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "Jan 2026"
        };
      })
    );

    return res.status(200).json({ success: true, count: customers.length, data: customers });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch customers" });
  }
});

// GET /api/users/profile - Get profile for User Dashboard
router.get("/profile", authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    const bookings = await Booking.find({ "guest.email": user.email });

    const activeBookings = bookings.filter((b) => b.statusCategory === "active").length;
    const completedTrips = bookings.filter((b) => b.bookingStatus === "Completed").length;
    const totalSpent = bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    const profileData = {
      ...user.toClientJSON(),
      stats: {
        totalBookings: bookings.length,
        activeBookings,
        completedTrips,
        totalSpent
      }
    };

    return res.status(200).json({ success: true, data: profileData });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch user profile" });
  }
});

// PUT /api/users/profile - Update user profile
router.put("/profile", authenticateUser, async (req, res) => {
  try {
    const user = req.user;
    const { name, phone, address, city, country, preferences, avatar } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (address !== undefined) user.address = address;
    if (city !== undefined) user.city = city;
    if (country !== undefined) user.country = country;
    if (avatar) user.avatar = avatar;
    if (preferences) {
      user.preferences = { ...user.preferences, ...preferences };
    }

    await user.save();
    return res.status(200).json({ success: true, message: "Profile updated successfully", data: user.toClientJSON() });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update profile" });
  }
});

// GET /api/users/:id - Single customer details
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const bookings = await Booking.find({ "guest.email": user.email }).sort({ createdAt: -1 });
    const totalSpent = bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

    return res.status(200).json({
      success: true,
      data: {
        ...user.toClientJSON(),
        totalBookings: bookings.length,
        totalSpent,
        bookings
      }
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch user" });
  }
});

// GET /api/users/:id/bookings - Customer booking history
router.get("/:id/bookings", async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const bookings = await Booking.find({ "guest.email": user.email }).sort({ createdAt: -1 });
    return res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch user bookings" });
  }
});

// PUT /api/users/:id - Admin update user
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    Object.assign(user, body);
    await user.save();

    return res.status(200).json({ success: true, message: "User updated successfully", data: user.toClientJSON() });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update user" });
  }
});

// DELETE /api/users/:id - Admin remove user
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ success: false, message: "User not found" });
    return res.status(200).json({ success: true, message: "User account deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete user" });
  }
});

module.exports = router;
