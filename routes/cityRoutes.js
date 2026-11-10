const express = require("express");
const router = express.Router();
const City = require("../Models/City");
const Property = require("../Models/Property");

const DEFAULT_CITIES = [
  "Madikeri",
  "Somwarpet",
  "Kushalnagar",
  "Virajpet",
  "Siddapur",
  "Gonikoppal",
  "Sakleshpur",
  "Nagarhole",
  "Wayanad"
];

// Helper to seed default cities if collection is empty
async function ensureDefaultCities() {
  const count = await City.countDocuments();
  if (count === 0) {
    for (const name of DEFAULT_CITIES) {
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      await City.create({ name, slug, state: "Karnataka" }).catch(() => {});
    }
  }

  // Also import any cities found in existing Property records
  try {
    const propCities = await Property.distinct("city");
    for (const c of propCities) {
      if (c && c.trim()) {
        const clean = c.trim();
        const exists = await City.findOne({ name: new RegExp(`^${clean}$`, "i") });
        if (!exists) {
          const slug = clean.toLowerCase().replace(/[^a-z0-9]+/g, "-");
          await City.create({ name: clean, slug }).catch(() => {});
        }
      }
    }
  } catch {}
}

// GET /api/cities - Fetch all available cities
router.get("/", async (req, res) => {
  try {
    await ensureDefaultCities();

    const cities = await City.find({ active: true }).sort({ name: 1 });
    return res.status(200).json({
      success: true,
      count: cities.length,
      data: cities
    });
  } catch (err) {
    console.error("Fetch cities error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch cities" });
  }
});

// POST /api/cities - Create / Add a new city
router.post("/", async (req, res) => {
  try {
    const { name, state } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: "City name is required" });
    }

    const cleanName = name.trim();
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-");

    // Case-insensitive check
    let city = await City.findOne({ name: new RegExp(`^${cleanName}$`, "i") });
    if (city) {
      return res.status(200).json({
        success: true,
        message: "City already exists in database",
        data: city
      });
    }

    city = new City({
      name: cleanName,
      slug,
      state: state || "Karnataka",
      active: true
    });

    await city.save();

    return res.status(201).json({
      success: true,
      message: `City "${cleanName}" saved successfully`,
      data: city
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to create city" });
  }
});

// DELETE /api/cities/:id - Delete a city
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await City.findByIdAndDelete(id);
    return res.status(200).json({ success: true, message: "City deleted successfully" });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete city" });
  }
});

module.exports = router;

