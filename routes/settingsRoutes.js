const express = require("express");
const router = express.Router();
const Setting = require("../Models/Setting");

// GET /api/settings - Fetch current settings
router.get("/", async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: "general_config" });
    if (!setting) {
      setting = new Setting({
        key: "general_config",
        resortName: "RR Resorts & Coorg Holidays",
        contactEmail: "bookings@rrcoorgholidays.com",
        contactPhone: "+91 8274 258000",
        address: "Madikeri - Virajpet Highway, Stuart Hill, Coorg, Karnataka 571201",
        taxPercentage: 12,
        currency: "INR (₹)",
        checkInTime: "13:00",
        checkOutTime: "11:00",
        freeCancellationHours: 48,
        refundPercentage: 100,
        cancellationTerms: "Full refund guaranteed when cancelled at least 48 hours prior to check-in.",
        emailNotifications: true,
        smsAlerts: true,
        dailyDigest: false,
        bankDetails: {
          accountHolder: "RR Coorg Holidays Pvt Ltd",
          accountNumber: "987654321098",
          ifscCode: "HDFC0001234",
          bankName: "HDFC Bank, Madikeri Branch",
          upiId: "rrcoorg@hdfcbank"
        }
      });
      await setting.save();
    }
    return res.status(200).json({ success: true, data: setting });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch settings" });
  }
});

// PUT /api/settings - Update settings
router.put("/", async (req, res) => {
  try {
    const body = req.body;
    let setting = await Setting.findOne({ key: "general_config" });

    if (!setting) {
      setting = new Setting({ key: "general_config", ...body });
    } else {
      Object.assign(setting, body);
      if (body.bankDetails) {
        setting.bankDetails = { ...setting.bankDetails, ...body.bankDetails };
      }
    }

    await setting.save();
    return res.status(200).json({ success: true, message: "Settings updated successfully", data: setting });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update settings" });
  }
});

module.exports = router;
