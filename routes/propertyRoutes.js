const express = require("express");
const router = express.Router();
const Property = require("../Models/Property");
const AuditLog = require("../Models/AuditLog");
const City = require("../Models/City");
const Room = require("../Models/Room");

// GET /api/properties - Fetch all properties with flexible filters & sorting
router.get("/", async (req, res) => {
  try {
    const { search, type, category, city, active, status, featured, minPrice, maxPrice, sortBy, all, admin } = req.query;

    const query = {};

    // Exclude soft-deleted properties unless explicitly requested by admin
    const includeDeleted = req.query.includeDeleted === "true" || all === "true" || admin === "true";
    if (!includeDeleted) {
      query.isDeleted = { $ne: true };
    }

    if (city && city !== "all" && city !== "ALL" && city !== "All Cities") {
      const cityRegex = new RegExp(`^${city}$`, "i");
      const locRegex = new RegExp(city, "i");
      query.$or = [{ city: cityRegex }, { location: locRegex }];
    }

    if (active !== undefined && active !== "" && active !== "all") {
      query.active = active === "true";
    }

    if (status && status !== "all" && status !== "ALL") {
      query.status = status;
    } else if (!all && !admin) {
      // By default for public users, only show published properties that are active
      query.status = { $in: ["published", "active"] };
      query.active = { $ne: false };
    }

    if (category && category !== "all" && category !== "ALL") {
      query.category = category.toLowerCase();
    }

    if (type && type !== "All" && type !== "All Types" && type !== "all") {
      query.type = new RegExp(`^${type}$`, "i");
    }

    if (featured !== undefined && featured !== "") {
      query.featured = featured === "true";
    }

    if (search) {
      const regex = new RegExp(search, "i");
      query.$or = [{ name: regex }, { location: regex }, { description: regex }, { subtitle: regex }, { slug: regex }];
    }

    if (minPrice || maxPrice) {
      query.pricePerNight = {};
      if (minPrice) query.pricePerNight.$gte = Number(minPrice);
      if (maxPrice) query.pricePerNight.$lte = Number(maxPrice);
    }

    let sortOption = { rating: -1, createdAt: -1 };
    if (sortBy === "price_asc") sortOption = { pricePerNight: 1 };
    else if (sortBy === "price_desc") sortOption = { pricePerNight: -1 };
    else if (sortBy === "rating") sortOption = { rating: -1 };
    else if (sortBy === "newest") sortOption = { createdAt: -1 };

    const properties = await Property.find(query).sort(sortOption);

    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (err) {
    console.error("Fetch properties error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to retrieve properties" });
  }
});

// GET /api/properties/types - Fetch all distinct property types
router.get("/types", async (req, res) => {
  try {
    const types = await Property.distinct("type", { isDeleted: { $ne: true } });
    return res.status(200).json({ success: true, data: types });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch property types" });
  }
});

// GET /api/properties/category/:category - Fetch properties by category (villas, resorts, etc.)
router.get("/category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const properties = await Property.find({
      category: category.toLowerCase(),
      isDeleted: { $ne: true },
      status: { $in: ["published", "active"] },
      active: { $ne: false }
    }).sort({ rating: -1 });

    return res.status(200).json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch properties by category" });
  }
});

// GET /api/properties/:id - Fetch single property by slug, propertyId, or Mongo _id
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    let property = null;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      property = await Property.findById(id);
    }

    if (!property) {
      property = await Property.findOne({
        $or: [
          { slug: id.toLowerCase() },
          { propertyId: id },
          { propertyId: id.toUpperCase() },
          { name: new RegExp(`^${id}$`, "i") }
        ]
      });
    }

    if (!property) {
      return res.status(404).json({ success: false, message: `Property not found with ID or slug: ${id}` });
    }

    const rooms = await Room.find({ propertyId: property.propertyId }).sort({ roomNumber: 1 });
    const propertyObj = property.toObject();
    propertyObj.rooms = rooms;

    return res.status(200).json({
      success: true,
      data: propertyObj
    });
  } catch (err) {
    console.error("Fetch property error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to retrieve property details" });
  }
});

// POST /api/properties - Create new property
router.post("/", async (req, res) => {
  try {
    const body = req.body;

    if (!body.name || !body.location) {
      return res.status(400).json({
        success: false,
        message: "Property name and location address are mandatory."
      });
    }

    let propertyId = body.propertyId;
    if (!propertyId || (await Property.findOne({ propertyId }))) {
      const count = await Property.countDocuments();
      propertyId = `PROP-${String(count + 1).padStart(2, "0")}`;
      if (await Property.findOne({ propertyId })) {
        propertyId = `PROP-${Date.now().toString().slice(-4)}`;
      }
    }

    const slug = (body.slug || body.name)
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const basePrice = Number(body.basePrice || body.pricePerNight || 2500);
    const pricePerNight = Number(body.pricePerNight || body.basePrice || basePrice);

    const cityName = (body.city && String(body.city).trim()) || "Madikeri";
    const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    try {
      await City.findOneAndUpdate(
        { name: new RegExp(`^${cityName}$`, "i") },
        { $setOnInsert: { name: cityName, slug: citySlug, state: "Karnataka", active: true } },
        { upsert: true }
      );
    } catch {}

    const newProperty = new Property({
      ...body,
      propertyId,
      slug,
      city: cityName,
      basePrice,
      pricePerNight,
      includedGuests: Number(body.includedGuests || 2),
      maxOccupancy: Number(body.maxOccupancy || 5),
      maxAdults: Number(body.maxAdults || 4),
      maxChildren: Number(body.maxChildren || 3),
      additionalAdultPrice: Number(body.additionalAdultPrice !== undefined ? body.additionalAdultPrice : 500),
      additionalChildPrice: Number(body.additionalChildPrice !== undefined ? body.additionalChildPrice : 300),
      extraBedPrice: Number(body.extraBedPrice !== undefined ? body.extraBedPrice : 400),
      extraBedAllowed: body.extraBedAllowed !== false,
      weekendPrice: Number(body.weekendPrice || 0),
      seasonalPrice: Number(body.seasonalPrice || 0),
      rating: body.rating || 5.0,
      active: body.active !== undefined ? Boolean(body.active) : true,
      isPublished: body.status !== "draft" && body.status !== "unpublished",
      status: body.status || "published",
      isDeleted: false
    });

    await newProperty.save();

    // Create and link associated Room records if passed
    if (body.rooms && Array.isArray(body.rooms) && body.rooms.length > 0) {
      const createdRooms = [];
      for (const rm of body.rooms) {
        const roomNum = String(rm.roomNumber || rm.number || "").trim();
        if (!roomNum) continue;
        const roomId = rm.roomId || `RM-${newProperty.propertyId}-${roomNum}`;
        const savedRoom = await Room.findOneAndUpdate(
          { roomId },
          {
            roomId,
            roomNumber: roomNum,
            propertyId: newProperty.propertyId,
            propertyName: newProperty.name,
            type: rm.type || rm.roomType || newProperty.roomType || "Luxury Suite",
            price: Number(rm.price || newProperty.basePrice || newProperty.pricePerNight),
            capacity: Number(rm.capacity || newProperty.maxOccupancy || 2),
            floor: rm.floor || "Ground",
            status: rm.status || "Available",
            amenities: rm.amenities || newProperty.amenities || []
          },
          { upsert: true, new: true }
        );
        createdRooms.push(savedRoom);
      }
      if (createdRooms.length > 0) {
        newProperty.totalRooms = Math.max(newProperty.totalRooms || 0, createdRooms.length);
        await newProperty.save();
      }
    }

    try {
      await AuditLog.create({
        action: "PROPERTY_CREATED",
        performedBy: req.user?.email || "Admin",
        targetType: "Property",
        targetId: newProperty.propertyId,
        details: { name: newProperty.name, basePrice: newProperty.basePrice, pricePerNight: newProperty.pricePerNight }
      });
    } catch {}

    const rooms = await Room.find({ propertyId: newProperty.propertyId }).sort({ roomNumber: 1 });
    const resultData = newProperty.toObject();
    resultData.rooms = rooms;

    return res.status(201).json({
      success: true,
      message: `Property "${newProperty.name}" created successfully.`,
      data: resultData
    });
  } catch (err) {
    console.error("Create property error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to create property" });
  }
});

// PUT /api/properties/:id - Update existing property
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const property = await Property.findOne({
      $or: [{ propertyId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []), { slug: id }]
    });

    if (!property) {
      return res.status(404).json({ success: false, message: `Property not found with ID: ${id}` });
    }

    // Update fields
    Object.keys(body).forEach((key) => {
      if (key !== "_id" && key !== "propertyId") {
        property[key] = body[key];
      }
    });

    if (body.basePrice !== undefined) {
      property.basePrice = Number(body.basePrice);
      if (body.pricePerNight === undefined) property.pricePerNight = property.basePrice;
    }
    if (body.pricePerNight !== undefined) {
      property.pricePerNight = Number(body.pricePerNight);
      if (body.basePrice === undefined) property.basePrice = property.pricePerNight;
    }
    if (body.includedGuests !== undefined) property.includedGuests = Number(body.includedGuests);
    if (body.maxOccupancy !== undefined) property.maxOccupancy = Number(body.maxOccupancy);
    if (body.maxAdults !== undefined) property.maxAdults = Number(body.maxAdults);
    if (body.maxChildren !== undefined) property.maxChildren = Number(body.maxChildren);
    if (body.additionalAdultPrice !== undefined) property.additionalAdultPrice = Number(body.additionalAdultPrice);
    if (body.additionalChildPrice !== undefined) property.additionalChildPrice = Number(body.additionalChildPrice);
    if (body.extraBedPrice !== undefined) property.extraBedPrice = Number(body.extraBedPrice);
    if (body.extraBedAllowed !== undefined) property.extraBedAllowed = Boolean(body.extraBedAllowed);
    if (body.weekendPrice !== undefined) property.weekendPrice = Number(body.weekendPrice);
    if (body.seasonalPrice !== undefined) property.seasonalPrice = Number(body.seasonalPrice);
    if (body.status !== undefined) {
      property.status = body.status;
      property.isPublished = body.status === "published";
    }

    if (body.city && String(body.city).trim()) {
      const cityName = String(body.city).trim();
      property.city = cityName;
      const citySlug = cityName.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      try {
        await City.findOneAndUpdate(
          { name: new RegExp(`^${cityName}$`, "i") },
          { $setOnInsert: { name: cityName, slug: citySlug, state: "Karnataka", active: true } },
          { upsert: true }
        );
      } catch {}
    }

    // Sync rooms if provided
    if (body.rooms && Array.isArray(body.rooms) && body.rooms.length > 0) {
      for (const rm of body.rooms) {
        const roomNum = String(rm.roomNumber || rm.number || "").trim();
        if (!roomNum) continue;
        const roomId = rm.roomId || `RM-${property.propertyId}-${roomNum}`;
        await Room.findOneAndUpdate(
          { roomId },
          {
            roomId,
            roomNumber: roomNum,
            propertyId: property.propertyId,
            propertyName: property.name,
            type: rm.type || rm.roomType || property.roomType || "Luxury Suite",
            price: Number(rm.price || property.basePrice || property.pricePerNight),
            capacity: Number(rm.capacity || property.maxOccupancy || 2),
            floor: rm.floor || "Ground",
            status: rm.status || "Available",
            amenities: rm.amenities || property.amenities || []
          },
          { upsert: true, new: true }
        );
      }
      property.totalRooms = Math.max(property.totalRooms || 0, body.rooms.length);
    }

    await property.save();

    try {
      await AuditLog.create({
        action: "PROPERTY_UPDATED",
        performedBy: req.user?.email || "Admin",
        targetType: "Property",
        targetId: property.propertyId,
        details: { name: property.name }
      });
    } catch {}

    const rooms = await Room.find({ propertyId: property.propertyId }).sort({ roomNumber: 1 });
    const resultData = property.toObject();
    resultData.rooms = rooms;

    return res.status(200).json({
      success: true,
      message: `Property "${property.name}" updated successfully.`,
      data: resultData
    });
  } catch (err) {
    console.error("Update property error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to update property" });
  }
});

// PATCH /api/properties/:id/status - Update property publish/active status
router.patch("/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { active, status } = req.body;

    const property = await Property.findOne({
      $or: [{ propertyId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []), { slug: id }]
    });

    if (!property) return res.status(404).json({ success: false, message: "Property not found" });

    if (active !== undefined) property.active = Boolean(active);
    if (status) {
      property.status = status;
      property.isPublished = status === "published";
    }

    await property.save();

    return res.status(200).json({
      success: true,
      message: `Property status updated`,
      data: property
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to update property status" });
  }
});

// DELETE /api/properties/:id - Soft-delete / Archive property
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const property = await Property.findOne({
      $or: [{ propertyId: id }, ...(id.match(/^[0-9a-fA-F]{24}$/) ? [{ _id: id }] : []), { slug: id }]
    });

    if (!property) {
      return res.status(404).json({ success: false, message: `Property not found with ID: ${id}` });
    }

    // Soft delete / archive to protect booking and financial audit records
    property.isDeleted = true;
    property.deletedAt = new Date();
    property.active = false;
    property.status = "archived";
    property.isPublished = false;
    await property.save();

    try {
      await AuditLog.create({
        action: "PROPERTY_DELETED",
        performedBy: req.user?.email || "Admin",
        targetType: "Property",
        targetId: property.propertyId,
        details: { name: property.name, action: "Soft-deleted and removed from public view" }
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: `Property "${property.name}" deleted and safely archived.`
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to delete property" });
  }
});

module.exports = router;
