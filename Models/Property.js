const mongoose = require("mongoose");

const mealSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    icon: { type: String, default: "🍽️" },
    timing: { type: String, required: true }
  },
  { _id: false }
);

const destinationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    distance: { type: String, required: true },
    travelTime: { type: String, required: true },
    image: { type: String, required: true },
    mapUrl: { type: String, default: "" },
    description: { type: String, default: "" }
  },
  { _id: false }
);

const foodItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    cuisine: { type: String, default: "" },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    image: { type: String, default: "" },
    tag: { type: String, default: "" }
  },
  { _id: false }
);

const cancellationPolicySchema = new mongoose.Schema(
  {
    summary: { type: String, default: "Free cancellation up to 48 hours before arrival" },
    type: { type: String, default: "Moderate (48h)" },
    deadlineHours: { type: Number, default: 48 },
    terms: { type: String, default: "Full 100% refund up to 48 hours before arrival." },
    rules: [{ type: String }]
  },
  { _id: false }
);

const propertySchema = new mongoose.Schema(
  {
    propertyId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    slug: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true
    },
    category: {
      type: String,
      enum: ["resort", "villa", "cottage", "lodge", "renthouse", "luxury"],
      default: "resort",
      index: true
    },
    status: {
      type: String,
      enum: ["published", "draft", "unpublished", "archived"],
      default: "published",
      index: true
    },
    featured: {
      type: Boolean,
      default: false
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    subtitle: {
      type: String,
      default: ""
    },
    location: {
      type: String,
      required: true
    },
    city: {
      type: String,
      trim: true,
      default: "Madikeri",
      index: true
    },
    locationUrl: {
      type: String,
      default: "https://maps.google.com/?q=Somwarpet+Coorg+Karnataka"
    },
    type: {
      type: String,
      default: "Luxury Resort"
    },
    rating: {
      type: Number,
      default: 5.0,
      min: 1,
      max: 5
    },
    reviewsCount: {
      type: Number,
      default: 0
    },
    pricePerNight: {
      type: Number,
      required: true,
      min: 0
    },
    priceRange: {
      type: String,
      default: ""
    },
    roomType: {
      type: String,
      default: "Ocean Suite"
    },
    guests: {
      type: String,
      default: "Up to 4"
    },
    maxAdults: {
      type: Number,
      default: 3
    },
    maxChildren: {
      type: Number,
      default: 2
    },
    view: {
      type: String,
      default: "Ocean View"
    },
    bedType: {
      type: String,
      default: "King Bed"
    },
    checkInTime: {
      type: String,
      default: "02:00 PM"
    },
    checkOutTime: {
      type: String,
      default: "11:00 AM"
    },
    contactPhone: {
      type: String,
      default: "+91 8274 258000"
    },
    contactEmail: {
      type: String,
      default: "stay@rrcoorgholidays.com"
    },
    image: {
      type: String,
      default: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=85"
    },
    gallery: [{ type: String }],
    totalRooms: {
      type: Number,
      default: 12
    },
    // People-Based Room Capacity & Pricing Configurations
    maxOccupancy: {
      type: Number,
      default: 4,
      min: 1
    },
    includedGuests: {
      type: Number,
      default: 2,
      min: 1
    },
    basePrice: {
      type: Number,
      default: 2500,
      min: 0
    },
    additionalAdultPrice: {
      type: Number,
      default: 500,
      min: 0
    },
    additionalChildPrice: {
      type: Number,
      default: 300,
      min: 0
    },
    extraBedAllowed: {
      type: Boolean,
      default: true
    },
    extraBedPrice: {
      type: Number,
      default: 400,
      min: 0
    },
    weekendPrice: {
      type: Number,
      default: 0
    },
    seasonalPrice: {
      type: Number,
      default: 0
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true
    },
    deletedAt: {
      type: Date,
      default: null
    },
    isPublished: {
      type: Boolean,
      default: true
    },
    active: {
      type: Boolean,
      default: true
    },
    description: {
      type: String,
      default: "Experience luxurious hospitality amidst the tranquil hills and lush plantation estates of Coorg."
    },
    diningSummary: {
      type: String,
      default: ""
    },
    cancellationPolicy: {
      type: cancellationPolicySchema,
      default: () => ({})
    },
    policies: [{ type: String }],
    meals: [mealSchema],
    destinations: [destinationSchema],
    nearbyPlaces: [
      {
        name: String,
        distance: String,
        description: String,
        image: String,
        mapUrl: String
      }
    ],
    amenities: [{ type: String }],
    foodItems: [foodItemSchema],
    bedrooms: { type: Number, default: 1 },
    bathrooms: { type: Number, default: 1 },
    weekendMultiplier: { type: Number, default: 1.15 },
    seasonalRates: [
      {
        name: String,
        startDate: String,
        endDate: String,
        pricePerNight: Number,
        minNights: { type: Number, default: 1 }
      }
    ],
    seoMetadata: {
      metaTitle: { type: String, default: "" },
      metaDescription: { type: String, default: "" },
      keywords: [{ type: String }]
    }
  },
  {
    timestamps: true
  }
);

// Auto-generate slug and synchronize pricing before saving
propertySchema.pre("save", function (next) {
  if (!this.slug && this.name) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/[\s_-]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Keep basePrice and pricePerNight synchronized
  if (this.basePrice && !this.pricePerNight) {
    this.pricePerNight = this.basePrice;
  } else if (this.pricePerNight && !this.basePrice) {
    this.basePrice = this.pricePerNight;
  }

  if (!this.maxOccupancy) {
    this.maxOccupancy = (this.maxAdults || 3) + (this.maxChildren || 2);
  }

  next();
});

module.exports = mongoose.model("Property", propertySchema);
