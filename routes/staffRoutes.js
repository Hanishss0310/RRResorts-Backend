const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const Staff = require("../Models/Staff");
const User = require("../Models/User");

// All standard permission keys available in the admin system
const ALL_PERMISSIONS = [
  "dashboard",
  "bookings",
  "calendar",
  "properties",
  "rooms",
  "customers",
  "payments",
  "offers",
  "enquiries",
  "support",
  "reviews",
  "notifications",
  "reports",
  "settings"
];

// Seed initial staff if empty
async function seedDefaultStaffIfEmpty() {
  try {
    const count = await Staff.countDocuments();
    if (count === 0) {
      const defaultPassword = "password123";
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(defaultPassword, salt);

      const defaults = [
        {
          staffId: "STF-01",
          name: "K. R. Rame Gowda",
          email: "owner@rrcoorgholidays.com",
          password: hashedPassword,
          phone: "+91 94480 12345",
          role: "OWNER",
          designation: "Managing Director / Owner",
          assignedProperties: ["Evolve Back Resort", "Annapurna Resort", "The Tamara Luxury Resort"],
          permissions: ALL_PERMISSIONS,
          active: true,
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
        },
        {
          staffId: "STF-02",
          name: "Kavya Gowda",
          email: "reception@rrcoorgholidays.com",
          password: hashedPassword,
          phone: "+91 8274 258001",
          role: "RECEPTIONIST",
          designation: "Front Desk & Reservations Lead",
          assignedProperties: ["Evolve Back Resort", "Annapurna Resort"],
          permissions: [
            "dashboard",
            "bookings",
            "calendar",
            "properties",
            "rooms",
            "customers",
            "payments",
            "enquiries",
            "support",
            "reviews",
            "notifications"
          ],
          active: true,
          avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
        },
        {
          staffId: "STF-03",
          name: "Chinnappa Belliappa",
          email: "chinnappa.ops@rrcoorgholidays.com",
          password: hashedPassword,
          phone: "+91 98450 78901",
          role: "MANAGER",
          designation: "Operations & Estate Manager",
          assignedProperties: ["The Tamara Luxury Resort"],
          permissions: [
            "dashboard",
            "bookings",
            "calendar",
            "properties",
            "rooms",
            "customers",
            "payments",
            "enquiries",
            "support",
            "reviews",
            "notifications",
            "reports"
          ],
          active: true,
          avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
        }
      ];

      for (const item of defaults) {
        await Staff.create(item);
        // Also ensure User record exists
        await User.findOneAndUpdate(
          { email: item.email },
          {
            name: item.name,
            email: item.email,
            phone: item.phone,
            role: item.role,
            password: hashedPassword,
            permissions: item.permissions,
            isEmailVerified: true
          },
          { upsert: true }
        );
      }
    }
  } catch (err) {
    console.warn("Staff seeding notice:", err.message);
  }
}
seedDefaultStaffIfEmpty();

// GET /api/staff - List all staff
router.get("/", async (req, res) => {
  try {
    const { role, active, search } = req.query;
    const filter = {};

    if (role && role !== "ALL" && role !== "all") filter.role = role.toUpperCase();
    if (active !== undefined && active !== "" && active !== "all") filter.active = active === "true";

    if (search) {
      const regex = new RegExp(search, "i");
      filter.$or = [{ name: regex }, { email: regex }, { phone: regex }, { role: regex }, { designation: regex }];
    }

    const staff = await Staff.find(filter).select("-password").sort({ createdAt: 1 });
    return res.status(200).json({ success: true, count: staff.length, data: staff });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch staff" });
  }
});

// GET /api/staff/:id - Single staff member
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const staffMember = await Staff.findOne({
      $or: [{ staffId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    }).select("-password");

    if (!staffMember) return res.status(404).json({ success: false, message: "Staff member not found" });

    return res.status(200).json({ success: true, data: staffMember });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch staff member" });
  }
});

// POST /api/staff - Create new staff member with password and permissions
router.post("/", async (req, res) => {
  try {
    const { name, email, phone, role, password, permissions, assignedProperties, designation, avatar } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "Staff name is required" });
    }
    if (!email || !email.trim()) {
      return res.status(400).json({ success: false, message: "Staff corporate email is required" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: "A valid password of at least 6 characters is required for login" });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check duplicate email
    const existingStaff = await Staff.findOne({ email: cleanEmail });
    if (existingStaff) {
      return res.status(400).json({ success: false, message: `A staff account with email ${cleanEmail} already exists.` });
    }

    const count = await Staff.countDocuments();
    const staffId = req.body.staffId || `STF-${String(count + 1).padStart(2, "0")}`;

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Default permissions based on role if none provided
    const userRole = (role || "RECEPTIONIST").toUpperCase();
    let finalPerms = Array.isArray(permissions) ? permissions : [];
    if (finalPerms.length === 0) {
      if (userRole === "OWNER") {
        finalPerms = ALL_PERMISSIONS;
      } else {
        finalPerms = [
          "dashboard",
          "bookings",
          "calendar",
          "rooms",
          "customers",
          "enquiries"
        ];
      }
    }

    const newStaff = new Staff({
      staffId,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      phone: phone ? phone.trim() : "",
      role: userRole,
      designation: designation || (userRole === "RECEPTIONIST" ? "Front Desk & Reservations" : userRole === "MANAGER" ? "Operations Manager" : "Staff Personnel"),
      permissions: finalPerms,
      assignedProperties: Array.isArray(assignedProperties) && assignedProperties.length > 0 ? assignedProperties : ["Evolve Back Resort", "Annapurna Resort"],
      avatar: avatar || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
      active: true
    });

    await newStaff.save();

    // Also sync to User collection for unified credential authentication
    await User.findOneAndUpdate(
      { email: cleanEmail },
      {
        name: newStaff.name,
        email: cleanEmail,
        phone: newStaff.phone,
        role: userRole,
        password: hashedPassword,
        permissions: finalPerms,
        isEmailVerified: true
      },
      { upsert: true, new: true }
    );

    const clientData = newStaff.toClientJSON ? newStaff.toClientJSON() : newStaff.toObject();
    delete clientData.password;

    return res.status(201).json({
      success: true,
      message: `Staff member "${newStaff.name}" created successfully with login credentials and assigned permissions.`,
      data: clientData
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to create staff member" });
  }
});

// PUT /api/staff/:id - Update staff details, permissions, or password
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, role, password, permissions, assignedProperties, designation, active, avatar } = req.body;

    const staff = await Staff.findOne({
      $or: [{ staffId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });

    if (name) staff.name = name.trim();
    if (phone !== undefined) staff.phone = phone.trim();
    if (role) staff.role = role.toUpperCase();
    if (designation) staff.designation = designation.trim();
    if (permissions && Array.isArray(permissions)) staff.permissions = permissions;
    if (assignedProperties && Array.isArray(assignedProperties)) staff.assignedProperties = assignedProperties;
    if (active !== undefined) staff.active = Boolean(active);
    if (avatar) staff.avatar = avatar;

    let updatedHashedPassword = null;
    if (password && password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updatedHashedPassword = await bcrypt.hash(password.trim(), salt);
      staff.password = updatedHashedPassword;
    }

    await staff.save();

    // Sync to User collection
    const userUpdate = {
      name: staff.name,
      phone: staff.phone,
      role: staff.role,
      permissions: staff.permissions
    };
    if (updatedHashedPassword) userUpdate.password = updatedHashedPassword;
    await User.findOneAndUpdate({ email: staff.email }, userUpdate);

    const clientData = staff.toClientJSON ? staff.toClientJSON() : staff.toObject();
    delete clientData.password;

    return res.status(200).json({
      success: true,
      message: `Staff member "${staff.name}" updated successfully.`,
      data: clientData
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update staff member" });
  }
});

// PATCH /api/staff/:id/toggle-active - Toggle active status
router.patch("/:id/toggle-active", async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findOne({
      $or: [{ staffId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });

    staff.active = !staff.active;
    await staff.save();

    return res.status(200).json({
      success: true,
      message: `Staff member "${staff.name}" is now ${staff.active ? "Active" : "Inactive"}.`,
      active: staff.active,
      data: staff
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to toggle staff status" });
  }
});

// DELETE /api/staff/:id - Remove staff member
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const staff = await Staff.findOne({
      $or: [{ staffId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : [])]
    });

    if (!staff) return res.status(404).json({ success: false, message: "Staff member not found" });

    if (staff.role === "OWNER" && staff.staffId === "STF-01") {
      return res.status(403).json({ success: false, message: "Root owner account cannot be deleted." });
    }

    await Staff.findByIdAndDelete(staff._id);
    await User.findOneAndDelete({ email: staff.email });

    return res.status(200).json({ success: true, message: `Staff member "${staff.name}" removed successfully.` });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete staff member" });
  }
});

module.exports = router;
