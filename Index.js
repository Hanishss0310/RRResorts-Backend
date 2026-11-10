/**
 * RR Resorts and Villas - Production Backend API
 * Express + MongoDB + Mongoose + Google Authentication + Nodemailer + Razorpay
 */

require("dotenv").config();
const path = require("path");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

// =========================================================================
// 1. CONFIGURATION (FROM ENVIRONMENT WITH SAFE DEFAULTS)
// =========================================================================
const PORT = process.env.PORT || 5002;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/rr_coorg_holidays";
const JWT_SECRET = process.env.JWT_SECRET || "rr_coorg_holidays_secret_key_2026_jwt_token";
const GOOGLE_CLIENT_ID =
  process.env.GOOGLE_CLIENT_ID ||
  "1028392182910-rrcoorgholidays.apps.googleusercontent.com";

process.env.JWT_SECRET = JWT_SECRET;
process.env.GOOGLE_CLIENT_ID = GOOGLE_CLIENT_ID;

const app = express();

// =========================================================================
// 2. SECURITY & MIDDLEWARES
// =========================================================================
app.use(helmet({ crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Rate limit reached. Please try again after 15 minutes." }
});
app.use("/api/", apiLimiter);

// Production and development origins permitted by CORS
const ALLOWED_ORIGINS = [
  "https://rrresortsandvillas.in",
  "https://www.rrresortsandvillas.in",
  "https://rr-resorts-and-villas-admin.web.app",
  "https://rr-resorts-and-villas-admin.firebaseapp.com",
  "https://rr-resorts-and-villas-coorg.web.app",
  "https://rr-resorts-and-villas-coorg.firebaseapp.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174"
];

// Append origins from environment variables if present
if (process.env.ALLOWED_ORIGINS) {
  process.env.ALLOWED_ORIGINS.split(",").forEach((o) => {
    const trimmed = o.trim();
    if (trimmed && !ALLOWED_ORIGINS.includes(trimmed)) {
      ALLOWED_ORIGINS.push(trimmed);
    }
  });
}
if (process.env.FRONTEND_URL && !ALLOWED_ORIGINS.includes(process.env.FRONTEND_URL.trim())) {
  ALLOWED_ORIGINS.push(process.env.FRONTEND_URL.trim());
}
if (process.env.ADMIN_URL && !ALLOWED_ORIGINS.includes(process.env.ADMIN_URL.trim())) {
  ALLOWED_ORIGINS.push(process.env.ADMIN_URL.trim());
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (e.g. server-to-server, curl, mobile applications)
      if (!origin) return callback(null, true);

      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      // Check subdomains for rrresortsandvillas.in and firebase web.app
      try {
        const url = new URL(origin);
        if (
          url.hostname === "rrresortsandvillas.in" ||
          url.hostname.endsWith(".rrresortsandvillas.in") ||
          url.hostname === "rr-resorts-and-villas-admin.web.app" ||
          url.hostname === "rr-resorts-and-villas-admin.firebaseapp.com" ||
          url.hostname === "rr-resorts-and-villas-coorg.web.app" ||
          url.hostname === "rr-resorts-and-villas-coorg.firebaseapp.com" ||
          url.hostname === "localhost" ||
          url.hostname === "127.0.0.1"
        ) {
          return callback(null, true);
        }
      } catch (err) {}

      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "Origin"]
  })
);

app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Static directory for uploaded property images & assets (with cross-origin header)
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(path.join(__dirname, "uploads"))
);

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

// =========================================================================
// 3. MODELS IMPORT
// =========================================================================
const User = require("./Models/User");
const Property = require("./Models/Property");
const Room = require("./Models/Room");
const Booking = require("./Models/Booking");
const Enquiry = require("./Models/Enquiry");
const Payment = require("./Models/Payment");
const Review = require("./Models/Review");
const Staff = require("./Models/Staff");
const Setting = require("./Models/Setting");
const SupportTicket = require("./Models/SupportTicket");
const Notification = require("./Models/Notification");
const Coupon = require("./Models/Coupon");
const NewsletterSubscriber = require("./Models/NewsletterSubscriber");
const AuditLog = require("./Models/AuditLog");

// =========================================================================
// 4. ROUTES IMPORT & MOUNTING
// =========================================================================
const authRoutes = require("./routes/authRoutes");
const propertyRoutes = require("./routes/propertyRoutes");
const roomRoutes = require("./routes/roomRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const userRoutes = require("./routes/userRoutes");
const enquiryRoutes = require("./routes/enquiryRoutes");
const paymentRoutes = require("./routes/paymentRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const staffRoutes = require("./routes/staffRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const supportRoutes = require("./routes/supportRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const couponRoutes = require("./routes/couponRoutes");
const newsletterRoutes = require("./routes/newsletterRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const auditRoutes = require("./routes/auditRoutes");
const offerRoutes = require("./routes/offerRoutes");
const cityRoutes = require("./routes/cityRoutes");
const { verifyEmailConfig } = require("./services/emailService");

app.use("/api/auth", authRoutes);
app.use("/api/properties", propertyRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/cities", cityRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/users", userRoutes);
app.use("/api/enquiries", enquiryRoutes);
app.use("/api/contact", enquiryRoutes); // Contact form routing alias
app.use("/api/payments", paymentRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/staff", staffRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/coupons", couponRoutes);
app.use("/api/offers", offerRoutes);
app.use("/api/newsletter", newsletterRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/audit-logs", auditRoutes);

// Direct Aliases as required by specification
app.use("/api/availability", (req, res, next) => {
  req.url = "/check-availability" + (req.url === "/" ? "" : req.url);
  bookingRoutes(req, res, next);
});
app.use("/api/pricing", (req, res, next) => {
  req.url = "/calculate-price";
  bookingRoutes(req, res, next);
});
app.use("/api/invoices", (req, res, next) => {
  // Routes /api/invoices/:id to bookingRoutes invoice logic
  const parts = req.url.split("/").filter(Boolean);
  if (parts.length > 0) {
    req.url = `/${parts[0]}/invoice`;
  }
  bookingRoutes(req, res, next);
});

// Admin namespace aliases
app.use("/api/admin/dashboard", dashboardRoutes);
app.use("/api/admin/reports", dashboardRoutes);
app.use("/api/admin/settings", settingsRoutes);
app.use("/api/admin/audit-logs", auditRoutes);

// Category shortcuts
app.use("/api/villas", (req, res, next) => { req.query.category = "villa"; propertyRoutes(req, res, next); });
app.use("/api/resorts", (req, res, next) => { req.query.category = "resort"; propertyRoutes(req, res, next); });
app.use("/api/cottages", (req, res, next) => { req.query.category = "cottage"; propertyRoutes(req, res, next); });
app.use("/api/lodges", (req, res, next) => { req.query.category = "lodge"; propertyRoutes(req, res, next); });
app.use("/api/rent-house", (req, res, next) => { req.query.category = "renthouse"; propertyRoutes(req, res, next); });

// Health check endpoint
app.get("/api/health", (req, res) => {
  return res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    service: "RR Resorts and Villas Backend API",
    database: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    port: PORT,
    endpoints: [
      "/api/auth",
      "/api/properties",
      "/api/villas",
      "/api/resorts",
      "/api/rooms",
      "/api/bookings",
      "/api/payments",
      "/api/coupons",
      "/api/newsletter",
      "/api/upload",
      "/api/enquiries",
      "/api/contact",
      "/api/reviews",
      "/api/dashboard",
      "/api/staff",
      "/api/settings",
      "/api/support",
      "/api/notifications",
      "/api/audit-logs"
    ]
  });
});

// Root welcome endpoint
app.get("/", (req, res) => {
  res.send(`
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; text-align: center; background: #FAF9F6; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center;">
      <h1 style="color: #0B1F33; font-size: 28px; margin-bottom: 8px;">RR Coorg Holidays — Backend API Server</h1>
      <p style="color: #64748B; font-size: 16px; max-width: 500px; margin: 0 auto 24px;">MongoDB + Express + RESTful API Engine for Luxury Resorts & Holidays</p>
      <div>
        <span style="display: inline-block; padding: 8px 18px; background: #0B1F33; color: #D4AF37; border-radius: 9999px; font-weight: 600; font-size: 14px;">
          ● Running on Port ${PORT}
        </span>
      </div>
      <p style="margin-top: 30px;"><a href="/api/health" style="color: #0B1F33; font-weight: bold; text-decoration: underline;">View System Health Check</a></p>
    </div>
  `);
});

const { provisionOwnerAccounts } = require("./services/ownerProvision");

// =========================================================================
// 5. DATABASE SEEDER (RUNS ONCE IF COLLECTIONS ARE EMPTY)
// =========================================================================
async function seedInitialDatabase() {
  try {
    // 0. Provision Owner Accounts
    await provisionOwnerAccounts();

    // A. Seed Properties if empty
    const propertyCount = await Property.countDocuments();
    if (propertyCount === 0) {
      console.log("🌱 Seeding initial luxury properties with complete Kodava details...");

      const seedProperties = [
        {
          propertyId: "PROP-01",
          name: "Evolve Back Luxury Plantation Resort",
          subtitle: "Heritage Coffee Estate Hideaway",
          location: "Karadigodu Post, Siddapur, Coorg, Karnataka 571253",
          locationUrl: "https://maps.google.com/?q=Evolve+Back+Coorg+Karnataka",
          type: "Luxury Resort",
          rating: 4.9,
          reviewsCount: 142,
          pricePerNight: 18500,
          priceRange: "₹18,500 - ₹35,000",
          roomType: "Lily Pool Plantation Villa",
          guests: "Up to 4",
          maxAdults: 3,
          maxChildren: 2,
          view: "Coffee Plantation & Lake View",
          bedType: "King Size Plush Bed",
          checkInTime: "02:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8274 258000",
          contactEmail: "reservations@evolvebackcoorg.com",
          image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=900&q=85",
            "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=900&q=85"
          ],
          totalRooms: 16,
          active: true,
          description:
            "Nestled amidst 300 acres of fragrant coffee and spice plantations, offering an authentic Kodava luxury retreat experience with private cottages, lily pools, and world-class hospitality.",
          cancellationPolicy: {
            summary: "Free cancellation up to 48 hours before arrival",
            type: "Moderate (48h)",
            deadlineHours: 48,
            terms: "Full 100% refund for cancellations made up to 48 hours prior to check-in.",
            rules: [
              "Check-in from 2:00 PM",
              "Check-out before 11:00 AM",
              "Free cancellation up to 48 hours before arrival",
              "Children are welcome",
              "Pets are not allowed in luxury pool villas",
              "Government ID is required during check-in"
            ]
          },
          policies: [
            "Check-in from 2:00 PM",
            "Check-out before 11:00 AM",
            "Free cancellation up to 48 hours before arrival",
            "Children are welcome",
            "Pets are not allowed",
            "Government ID is required during check-in"
          ],
          meals: [
            {
              id: "breakfast",
              name: "Buffet Breakfast",
              description: "Fresh buffet breakfast with continental and authentic Kodava options, estate coffee, and live counters.",
              price: 350,
              icon: "🥐",
              timing: "7:00 AM - 10:30 AM"
            },
            {
              id: "lunch",
              name: "Chef's Lunch Buffet",
              description: "Chef-selected lunch spread with vegetarian curries, pandi curry, neer dosas, and coastal specials.",
              price: 650,
              icon: "🍱",
              timing: "12:30 PM - 3:30 PM"
            },
            {
              id: "dinner",
              name: "Royal Dinner Experience",
              description: "Gourmet multicuisine dinner with dessert buffet, live charcoal grills, and traditional desserts.",
              price: 850,
              icon: "🍽️",
              timing: "7:30 PM - 10:30 PM"
            },
            {
              id: "romantic",
              name: "Romantic Plantation Dinner",
              description: "Private lakeside machan or coffee grove dining experience for two with personal chef and candlelit floral setup.",
              price: 2500,
              icon: "🕯️",
              timing: "8:00 PM Onwards"
            }
          ],
          destinations: [
            {
              name: "Dubare Elephant Camp",
              distance: "14 km",
              travelTime: "25 min",
              image: "https://images.unsplash.com/photo-1557050543-4d5f4e07ef46?auto=format&fit=crop&w=900&q=85",
              mapUrl: "https://maps.google.com/?q=Dubare+Elephant+Camp+Coorg",
              description: "Riverfront camp on River Kaveri where visitors can interact with elephants."
            },
            {
              name: "Namdroling Golden Temple",
              distance: "22 km",
              travelTime: "35 min",
              image: "https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=900&q=85",
              mapUrl: "https://maps.google.com/?q=Namdroling+Monastery+Bylakuppe",
              description: "Breathtaking Tibetan Buddhist monastery with 40-foot golden Buddha statues."
            },
            {
              name: "Chiklihole Reservoir Sanctuary",
              distance: "18 km",
              travelTime: "30 min",
              image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=900&q=85",
              mapUrl: "https://maps.google.com/?q=Chiklihole+Reservoir+Coorg",
              description: "Serene spillway dam enveloped by dense forest trails."
            }
          ],
          amenities: [
            "Free Wi-Fi",
            "Infinity Pool",
            "Restaurant",
            "Free Parking",
            "Breakfast",
            "24/7 Security",
            "Room Service",
            "Fitness Center",
            "Ayurvedic Spa & Wellness",
            "Plantation Jeep Safari"
          ]
        },
        {
          propertyId: "PROP-02",
          name: "Annapurna Resort & Luxury Sanctuary",
          subtitle: "Luxury Mountain & Lake Sanctuary",
          location: "Madikeri Valley Road, Coorg, Karnataka 571201",
          locationUrl: "https://maps.google.com/?q=Annapurna+Resort+Madikeri+Coorg",
          type: "Mountain Resort",
          rating: 4.8,
          reviewsCount: 98,
          pricePerNight: 8500,
          priceRange: "₹8,500 - ₹16,000",
          roomType: "Luxury Mountain View Suite",
          guests: "Up to 4",
          maxAdults: 3,
          maxChildren: 2,
          view: "Mist Valley & Mountain Peaks",
          bedType: "California King Bed",
          checkInTime: "02:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8272 225910",
          contactEmail: "stay@annapurnaresort.com",
          image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85",
            "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=900&q=85"
          ],
          totalRooms: 12,
          active: true,
          description:
            "Perched atop the verdant slopes overlooking mist-laden valleys, Annapurna Resort provides tranquility, luxury suites, and panoramic views of the Western Ghats.",
          cancellationPolicy: {
            summary: "Free cancellation up to 48 hours before arrival",
            type: "Moderate (48h)",
            deadlineHours: 48,
            terms: "100% full refund if cancelled at least 48 hours before check-in.",
            rules: [
              "Check-in from 2:00 PM",
              "Check-out before 11:00 AM",
              "Free cancellation up to 48 hours before arrival",
              "Children are welcome",
              "Pets are allowed in select ground chalets",
              "Government ID is required during check-in"
            ]
          },
          policies: [
            "Check-in from 2:00 PM",
            "Check-out before 11:00 AM",
            "Free cancellation up to 48 hours before arrival",
            "Children are welcome",
            "Government ID is required during check-in"
          ],
          meals: [
            {
              id: "breakfast",
              name: "Valley Sunrise Breakfast",
              description: "Freshly brewed Coorg coffee, steaming idlis, neer dosas, and fresh fruit station.",
              price: 300,
              icon: "🥐",
              timing: "7:00 AM - 10:30 AM"
            },
            {
              id: "lunch",
              name: "Coastal & Kodava Lunch",
              description: "Authentic multi-course lunch featuring coastal curries and fresh farm vegetables.",
              price: 550,
              icon: "🍱",
              timing: "12:30 PM - 3:30 PM"
            },
            {
              id: "dinner",
              name: "Campfire Barbecue & Dinner",
              description: "Clay oven kebabs, warm biryanis, slow-simmered gravies, and hot desserts.",
              price: 750,
              icon: "🍽️",
              timing: "7:30 PM - 10:30 PM"
            }
          ],
          destinations: [
            {
              name: "Raja's Seat Sunset Viewpoint",
              distance: "4.5 km",
              travelTime: "10 min",
              image: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=900&q=85",
              mapUrl: "https://maps.google.com/?q=Raja's+Seat+Madikeri",
              description: "Historic viewpoint offering sweeping views over rolling hillocks and sunsets."
            },
            {
              name: "Abbey Falls Cascades",
              distance: "9.2 km",
              travelTime: "20 min",
              image: "https://images.unsplash.com/photo-1432405972618-c60b0225b8f9?auto=format&fit=crop&w=900&q=85",
              mapUrl: "https://maps.google.com/?q=Abbey+Falls+Coorg",
              description: "Roaring waterfall amidst coffee plantations and spice trees."
            }
          ],
          amenities: [
            "Free Wi-Fi",
            "Infinity Pool",
            "Restaurant",
            "Free Parking",
            "Breakfast",
            "24/7 Security",
            "Room Service",
            "Fitness Center",
            "Mountain View Balconies",
            "Bonfire Evenings"
          ]
        },
        {
          propertyId: "PROP-03",
          name: "The Tamara Luxury Resort & Spa",
          subtitle: "Elevated Treehouse & Valley Sanctuaries",
          location: "Kabbinakad Estate, Napoklu Nad, Coorg, Karnataka 571214",
          locationUrl: "https://maps.google.com/?q=The+Tamara+Coorg",
          type: "Luxury Resort",
          rating: 4.9,
          reviewsCount: 175,
          pricePerNight: 24000,
          priceRange: "₹24,000 - ₹48,000",
          roomType: "Luxury Elevated Suite",
          guests: "Up to 3",
          maxAdults: 2,
          maxChildren: 1,
          view: "Canopy Valley & Private Waterfall",
          bedType: "Custom Teak Super King Bed",
          checkInTime: "01:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 80 4710 8000",
          contactEmail: "stay@thetamaracoorg.com",
          image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=85"
          ],
          totalRooms: 10,
          active: true,
          description: "Elevated suites suspended high on stilts amidst the dense canopy of rainforests and organic coffee groves with private sun decks and cascading waterfalls.",
          amenities: ["Free Wi-Fi", "Heated Pool", "Spa & Wellness", "Fine Dining", "Waterfall Trek", "Yoga Pavilion"]
        },
        {
          propertyId: "PROP-04",
          name: "Misty Woods Rainforest Villa",
          subtitle: "Secluded Eco-Chalet Retreat",
          location: "Kakkabe, Near Thadiyandamol Peak, Coorg, Karnataka 571212",
          locationUrl: "https://maps.google.com/?q=Misty+Woods+Resort+Coorg",
          type: "Heritage Villa",
          rating: 4.7,
          reviewsCount: 84,
          pricePerNight: 12500,
          priceRange: "₹12,500 - ₹22,000",
          roomType: "Forest Wooden Duplex Chalet",
          guests: "Up to 5",
          maxAdults: 4,
          maxChildren: 2,
          view: "Waterfall & Evergreen Shola Forest",
          bedType: "Double Queen Beds",
          checkInTime: "02:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8272 238120",
          contactEmail: "bookings@mistywoods.com",
          image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=85"
          ],
          totalRooms: 8,
          active: true,
          description: "Eco-friendly wooden vernacular architecture positioned at the base of Coorg's highest mountain summit with fresh stream baths and adventure trails.",
          amenities: ["Free Wi-Fi", "Natural Spring Bath", "Estate Walk", "Campfire", "Restaurant", "Trekking Guides"]
        },
        {
          propertyId: "PROP-05",
          name: "Heritage Coorg Coffee Estate Bungalow",
          subtitle: "120-Year Colonial British Planter's Home",
          location: "Pollibetta Estate, South Coorg, Karnataka 571215",
          locationUrl: "https://maps.google.com/?q=Pollibetta+Coorg",
          type: "Heritage Homestay",
          rating: 4.9,
          reviewsCount: 62,
          pricePerNight: 14000,
          priceRange: "₹14,000 - ₹26,000",
          roomType: "Governor's Colonial Master Suite",
          guests: "Up to 6",
          maxAdults: 4,
          maxChildren: 2,
          view: "Endless Rolling Coffee & Pepper Greens",
          bedType: "Antique Rosewood 4-Poster Bed",
          checkInTime: "01:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8274 256110",
          contactEmail: "heritage@rrcoorgholidays.com",
          image: "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1564501049412-61c2a3083791?auto=format&fit=crop&w=1200&q=85"
          ],
          totalRooms: 6,
          active: true,
          description: "An authentic 19th-century colonial estate bungalow with high terracotta ceilings, vintage fireplaces, antique library, and personalized Kodava home-cooked feasts.",
          amenities: ["Free Wi-Fi", "Private Cook & Butler", "Antique Fireplace", "Library", "Barbecue Grill", "Golf Course Access"]
        }
      ];

      await Property.insertMany(seedProperties);
      console.log(`✅ Seeded ${seedProperties.length} initial luxury properties.`);
    }

    // B. Seed Default Admin & Demo Users if empty
    const userCount = await User.countDocuments();
    if (userCount === 0) {
      console.log("🌱 Seeding demo users...");
      const salt = await bcrypt.genSalt(10);
      const defaultPassword = await bcrypt.hash("Admin@123", salt);

      const demoUsers = [
        {
          name: "Hanish S.S (Owner)",
          email: "owner@rrcoorgholidays.com",
          password: defaultPassword,
          role: "owner",
          phone: "+91 98765 43210",
          membership: "Platform Owner",
          authProvider: "local"
        },
        {
          name: "Front Desk (Receptionist)",
          email: "reception@rrcoorgholidays.com",
          password: defaultPassword,
          role: "receptionist",
          phone: "+91 8272 225910",
          membership: "Front Desk Staff",
          authProvider: "local"
        },
        {
          name: "Hanish S.S Gowda",
          email: "hanish.gowda@example.com",
          password: defaultPassword,
          role: "user",
          phone: "+91 98765 43210",
          city: "Bengaluru",
          country: "India",
          membership: "Gold Tier Guest",
          authProvider: "local"
        }
      ];

      await User.insertMany(demoUsers);
      console.log(`✅ Seeded ${demoUsers.length} initial users.`);
    }

    // C. Seed Initial Bookings if empty
    const bookingCount = await Booking.countDocuments();
    if (bookingCount === 0) {
      console.log("🌱 Seeding sample guest bookings...");
      const sampleBookings = [
        {
          bookingId: "BK10294",
          propertyId: "PROP-02",
          propertyName: "Annapurna Resort & Luxury Sanctuary",
          propertyImage: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=85",
          roomType: "Luxury Mountain View Suite",
          roomNumber: "201",
          checkIn: "2026-10-12",
          checkOut: "2026-10-15",
          nights: 3,
          adults: 2,
          children: 1,
          roomsCount: 1,
          guest: {
            name: "Hanish S.S Gowda",
            email: "hanish.gowda@example.com",
            phone: "+91 98765 43210",
            address: "Indiranagar, Bengaluru"
          },
          selectedMeals: { breakfast: 2, lunch: 0, dinner: 2, romantic: 1 },
          roomTotal: 25500,
          mealTotal: 3900,
          taxes: 3528,
          totalAmount: 32928,
          paidAmount: 32928,
          pendingAmount: 0,
          paymentStatus: "Paid",
          bookingStatus: "Confirmed",
          statusCategory: "active"
        },
        {
          bookingId: "BK10310",
          propertyId: "PROP-01",
          propertyName: "Evolve Back Luxury Plantation Resort",
          propertyImage: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=85",
          roomType: "Lily Pool Plantation Villa",
          roomNumber: "101",
          checkIn: "2026-11-04",
          checkOut: "2026-11-07",
          nights: 3,
          adults: 2,
          children: 0,
          roomsCount: 1,
          guest: {
            name: "Bopanna Muthappa",
            email: "bopanna.m@example.com",
            phone: "+91 94481 23456",
            address: "Madikeri, Coorg"
          },
          selectedMeals: { breakfast: 2, lunch: 0, dinner: 0, romantic: 1 },
          roomTotal: 55500,
          mealTotal: 3200,
          taxes: 7044,
          totalAmount: 65744,
          paidAmount: 65744,
          pendingAmount: 0,
          paymentStatus: "Paid",
          bookingStatus: "Confirmed",
          statusCategory: "active"
        },
        {
          bookingId: "BK10342",
          propertyId: "PROP-04",
          propertyName: "Misty Woods Rainforest Villa",
          propertyImage: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=1200&q=85",
          roomType: "Forest Wooden Duplex Chalet",
          roomNumber: "401",
          checkIn: "2026-10-20",
          checkOut: "2026-10-23",
          nights: 3,
          adults: 3,
          children: 1,
          roomsCount: 1,
          guest: {
            name: "Divya Nambiar",
            email: "divya.n@example.com",
            phone: "+91 8272 238120",
            address: "Kochi, Kerala"
          },
          selectedMeals: { breakfast: 3, lunch: 0, dinner: 3, romantic: 0 },
          roomTotal: 42600,
          mealTotal: 4500,
          taxes: 5652,
          totalAmount: 52752,
          paidAmount: 52752,
          pendingAmount: 0,
          paymentStatus: "Paid",
          bookingStatus: "Confirmed",
          statusCategory: "active"
        }
      ];

      await Booking.insertMany(sampleBookings);
      console.log(`✅ Seeded ${sampleBookings.length} initial bookings.`);
    }

    // D. Seed Rooms if empty
    const roomCount = await Room.countDocuments();
    if (roomCount === 0) {
      console.log("🌱 Seeding initial rooms inventory...");
      const sampleRooms = [
        { roomId: "RM-101", roomNumber: "101", propertyId: "PROP-01", propertyName: "Evolve Back Luxury Plantation Resort", type: "Lily Pool Cottage", capacity: 2, price: 18500, status: "Occupied", currentGuest: "Bopanna Muthappa", currentBookingId: "BK10310", floor: "Ground", amenities: ["Private Pool", "King Bed", "Rain Shower", "Mini Bar"] },
        { roomId: "RM-102", roomNumber: "102", propertyId: "PROP-01", propertyName: "Evolve Back Luxury Plantation Resort", type: "Lily Pool Cottage", capacity: 2, price: 18500, status: "Available", currentGuest: null, currentBookingId: null, floor: "Ground", amenities: ["Private Pool", "King Bed", "Rain Shower"] },
        { roomId: "RM-103", roomNumber: "103", propertyId: "PROP-01", propertyName: "Evolve Back Luxury Plantation Resort", type: "Heritage Plantation Suite", capacity: 4, price: 26000, status: "Reserved", currentGuest: "Arjun Rao", currentBookingId: "BK10355", floor: "1st Floor", amenities: ["Jacuzzi", "Living Room", "Plantation Balcony"] },
        { roomId: "RM-104", roomNumber: "104", propertyId: "PROP-01", propertyName: "Evolve Back Luxury Plantation Resort", type: "Heritage Plantation Suite", capacity: 4, price: 26000, status: "Cleaning", currentGuest: null, currentBookingId: null, floor: "1st Floor", amenities: ["Jacuzzi", "Living Room", "Balcony"] },
        { roomId: "RM-105", roomNumber: "105", propertyId: "PROP-01", propertyName: "Evolve Back Luxury Plantation Resort", type: "Presidential Pool Villa", capacity: 6, price: 38000, status: "Maintenance", currentGuest: null, currentBookingId: null, floor: "Private Villa", amenities: ["Private Heated Pool", "Butler Service", "Kitchenette"] },
        { roomId: "RM-201", roomNumber: "201", propertyId: "PROP-02", propertyName: "Annapurna Resort & Luxury Sanctuary", type: "Luxury Mountain View Suite", capacity: 3, price: 8500, status: "Occupied", currentGuest: "Hanish S.S Gowda", currentBookingId: "BK10294", floor: "Ground", amenities: ["Private Plunge Pool", "Mountain View", "Wi-Fi", "King Bed"] },
        { roomId: "RM-202", roomNumber: "202", propertyId: "PROP-02", propertyName: "Annapurna Resort & Luxury Sanctuary", type: "Luxury Mountain View Suite", capacity: 2, price: 9200, status: "Available", currentGuest: null, currentBookingId: null, floor: "1st Floor", amenities: ["Balcony", "Coffee Maker", "AC"] },
        { roomId: "RM-203", roomNumber: "203", propertyId: "PROP-02", propertyName: "Annapurna Resort & Luxury Sanctuary", type: "Deluxe Valley Room", capacity: 2, price: 7500, status: "Reserved", currentGuest: "Neha Verma", currentBookingId: "BK10360", floor: "2nd Floor", amenities: ["Valley View", "Queen Bed", "Smart TV"] },
        { roomId: "RM-204", roomNumber: "204", propertyId: "PROP-02", propertyName: "Annapurna Resort & Luxury Sanctuary", type: "Family Pine Chalet", capacity: 5, price: 14500, status: "Available", currentGuest: null, currentBookingId: null, floor: "Independent", amenities: ["2 Bedrooms", "Dining Area", "Fireplace"] },
        { roomId: "RM-301", roomNumber: "301", propertyId: "PROP-03", propertyName: "The Tamara Luxury Resort & Spa", type: "Luxury Elevated Suite", capacity: 2, price: 24000, status: "Available", currentGuest: null, currentBookingId: null, floor: "Canopy Level", amenities: ["Private Sun Deck", "Panoramic Views", "Espresso Bar"] },
        { roomId: "RM-302", roomNumber: "302", propertyId: "PROP-03", propertyName: "The Tamara Luxury Resort & Spa", type: "Eden Lotus Villa", capacity: 4, price: 34000, status: "Cleaning", currentGuest: null, currentBookingId: null, floor: "Hilltop", amenities: ["Heated Plunge Pool", "Outdoor Jacuzzi", "Luxury Toiletries"] },
        { roomId: "RM-401", roomNumber: "401", propertyId: "PROP-04", propertyName: "Misty Woods Rainforest Villa", type: "Forest Wooden Duplex Chalet", capacity: 4, price: 14200, status: "Occupied", currentGuest: "Divya Nambiar", currentBookingId: "BK10342", floor: "Duplex", amenities: ["Wood Architecture", "Waterfall View", "BBQ Grill"] }
      ];
      await Room.insertMany(sampleRooms);
      console.log(`✅ Seeded ${sampleRooms.length} initial rooms.`);
    }

    // E. Seed Staff if empty
    const staffCount = await Staff.countDocuments();
    if (staffCount === 0) {
      console.log("🌱 Seeding staff members...");
      const sampleStaff = [
        {
          staffId: "STF-01",
          name: "K. R. Rame Gowda",
          email: "owner@rrcoorgholidays.com",
          phone: "+91 94480 12345",
          role: "OWNER",
          assignedProperties: ["Evolve Back Resort", "Annapurna Resort", "The Tamara Luxury Resort"],
          active: true,
          avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80"
        },
        {
          staffId: "STF-02",
          name: "Kavya Gowda",
          email: "reception@rrcoorgholidays.com",
          phone: "+91 8274 258001",
          role: "RECEPTIONIST",
          assignedProperties: ["Evolve Back Resort", "Annapurna Resort"],
          active: true,
          avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80"
        },
        {
          staffId: "STF-03",
          name: "Chinnappa Belliappa",
          email: "chinnappa.ops@rrcoorgholidays.com",
          phone: "+91 98450 78901",
          role: "MANAGER",
          assignedProperties: ["The Tamara Luxury Resort"],
          active: true,
          avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80"
        }
      ];
      await Staff.insertMany(sampleStaff);
      console.log(`✅ Seeded ${sampleStaff.length} initial staff members.`);
    }

    // F. Seed Settings if empty
    const settingCount = await Setting.countDocuments();
    if (settingCount === 0) {
      console.log("🌱 Seeding default business settings...");
      const defaultSetting = new Setting({
        key: "general_config",
        resortName: "RR Resorts & Coorg Holidays",
        contactEmail: "bookings@rrcoorgholidays.com",
        contactPhone: "+91 8274 258000",
        taxPercentage: 12,
        currency: "INR (₹)",
        checkInTime: "13:00",
        checkOutTime: "11:00",
        freeCancellationHours: 48,
        refundPercentage: 100
      });
      await defaultSetting.save();
      console.log("✅ Seeded default settings.");
    }

    // G. Seed Payments if empty
    const paymentCount = await Payment.countDocuments();
    if (paymentCount === 0) {
      console.log("🌱 Seeding sample payments...");
      const samplePayments = [
        {
          transactionId: "TXN-894201",
          bookingId: "BK10294",
          propertyName: "Annapurna Resort & Luxury Sanctuary",
          guestName: "Hanish S.S Gowda",
          guestEmail: "hanish.gowda@example.com",
          amount: 32928,
          method: "UPI",
          status: "Success",
          date: new Date()
        },
        {
          transactionId: "TXN-894202",
          bookingId: "BK10310",
          propertyName: "Evolve Back Luxury Plantation Resort",
          guestName: "Bopanna Muthappa",
          guestEmail: "bopanna.m@example.com",
          amount: 65744,
          method: "Credit Card",
          status: "Success",
          date: new Date(Date.now() - 86400000)
        }
      ];
      await Payment.insertMany(samplePayments);
      console.log(`✅ Seeded ${samplePayments.length} initial payments.`);
    }

    // H. Seed Support Tickets if empty
    const ticketCount = await SupportTicket.countDocuments();
    if (ticketCount === 0) {
      console.log("🌱 Seeding initial guest support tickets...");
      const sampleTickets = [
        {
          ticketId: "TKT-1049",
          customer: {
            name: "Hanish S.S Gowda",
            email: "hanish.gowda@example.com",
            phone: "+91 98765 43210"
          },
          subject: "Early check-in query & Airport Cab coordination",
          bookingId: "BK10294",
          category: "Airport Transfer & Travel",
          priority: "High",
          status: "Open",
          assignedTo: "Kavya Gowda (Receptionist)",
          messages: [
            {
              sender: "Customer",
              name: "Hanish S.S Gowda",
              time: "Today, 09:30 AM",
              message: "Hello team, my flight lands in Kannur airport around 11:30 AM. Can we arrange an airport pickup and early check-in at Annapurna Resort by 1:00 PM?"
            },
            {
              sender: "Staff",
              name: "Kavya Gowda",
              time: "Today, 10:15 AM",
              message: "Hello Mr. Gowda! Yes, our Toyota Innova Crysta can pick you up from Kannur Airport. The driver details have been coordinated with property concierge."
            }
          ]
        },
        {
          ticketId: "TKT-1048",
          customer: {
            name: "Divya Nambiar",
            email: "divya.n@example.com",
            phone: "+91 8272 238120"
          },
          subject: "Remaining payment link for Misty Woods reservation",
          bookingId: "BK10342",
          category: "Payment Assistance",
          priority: "Medium",
          status: "In Progress",
          assignedTo: "Rohan Sharma (Receptionist)",
          messages: [
            {
              sender: "Customer",
              name: "Divya Nambiar",
              time: "Yesterday, 02:40 PM",
              message: "Could you send a direct UPI link to pay the remaining ₹10,256 before we arrive?"
            }
          ]
        }
      ];
      await SupportTicket.insertMany(sampleTickets);
      console.log(`✅ Seeded ${sampleTickets.length} support tickets.`);
    }

    // I. Seed Notifications if empty
    const notifCount = await Notification.countDocuments();
    if (notifCount === 0) {
      console.log("🌱 Seeding initial notifications...");
      const sampleNotifications = [
        {
          notificationId: "NOTIF-01",
          type: "NEW_BOOKING",
          title: "New Booking Received",
          message: "Hanish S.S Gowda reserved Room 201 at Annapurna Resort (#BK10294).",
          link: "/bookings",
          read: false,
          targetRole: "admin"
        },
        {
          notificationId: "NOTIF-02",
          type: "PAYMENT_RECEIVED",
          title: "Payment Confirmed (₹32,928)",
          message: "UPI payment verified for Booking #BK10294.",
          link: "/payments",
          read: false,
          targetRole: "admin"
        },
        {
          notificationId: "NOTIF-03",
          type: "SUPPORT_TICKET",
          title: "New Support Ticket",
          message: "Ticket #TKT-1049 created: 'Early check-in query & Airport Cab coordination'.",
          link: "/support",
          read: true,
          targetRole: "admin"
        }
      ];
      await Notification.insertMany(sampleNotifications);
      console.log(`✅ Seeded ${sampleNotifications.length} notifications.`);
    }

    // J. Seed Reviews if empty
    const reviewCount = await Review.countDocuments();
    if (reviewCount === 0) {
      console.log("🌱 Seeding initial reviews...");
      const sampleReviews = [
        {
          reviewId: "REV-901",
          propertyId: "PROP-03",
          propertyName: "The Tamara Luxury Resort & Spa",
          userName: "Vikram Malhotra",
          rating: 5,
          title: "Unparalleled coffee wilderness & elite service",
          comment: "The elevated cottages and natural waterfall within the property are breathtaking. Attentive host and spectacular food. Highly recommended!",
          status: "Approved",
          adminReply: "Thank you Mr. Malhotra! It was an honor hosting you at The Tamara."
        },
        {
          reviewId: "REV-902",
          propertyId: "PROP-05",
          propertyName: "Heritage Coorg Coffee Estate Bungalow",
          userName: "Priya Sundaram",
          rating: 5,
          title: "Mesmerizing heritage bungalow stay",
          comment: "The hospitality felt like home. Authentic Kodava pandi curry and akki roti were delicious. Wonderful plantation walk with estate elders.",
          status: "Approved"
        }
      ];
      await Review.insertMany(sampleReviews);
      console.log(`✅ Seeded ${sampleReviews.length} reviews.`);
    }

    // K. Seed Coupons if empty
    const couponCount = await Coupon.countDocuments();
    if (couponCount === 0) {
      console.log("🌱 Seeding initial promotion coupons...");
      const sampleCoupons = [
        {
          code: "WELCOME10",
          title: "Privilege Welcome Discount (10% Off)",
          description: "Exclusive welcome reward for Sanctuary Privilege Club members.",
          discountType: "percentage",
          discountValue: 10,
          minBookingAmount: 5000,
          maxDiscountAmount: 3000,
          endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          usageLimit: 500,
          active: true
        },
        {
          code: "MONSOON20",
          title: "Monsoon Retreat Special (20% Off)",
          description: "Special seasonal discount for extended monsoon stays.",
          discountType: "percentage",
          discountValue: 20,
          minBookingAmount: 12000,
          maxDiscountAmount: 6000,
          endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          usageLimit: 200,
          active: true
        },
        {
          code: "LUXURY5000",
          title: "Luxury Suite Flat Savings (₹5,000 Off)",
          description: "Flat ₹5,000 deduction on premium villa and estate bookings.",
          discountType: "flat",
          discountValue: 5000,
          minBookingAmount: 25000,
          endDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
          usageLimit: 100,
          active: true
        }
      ];
      await Coupon.insertMany(sampleCoupons);
      console.log(`✅ Seeded ${sampleCoupons.length} promotional coupons.`);
    }

    // L. Migrate and ensure slugs & categories for all properties in DB
    const allExistingProps = await Property.find();
    for (const prop of allExistingProps) {
      let changed = false;
      if (!prop.slug) {
        prop.slug = prop.name
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-");
        changed = true;
      }
      if (!prop.category) {
        prop.category =
          prop.name.toLowerCase().includes("villa") || (prop.type && prop.type.toLowerCase().includes("villa"))
            ? "villa"
            : "resort";
        changed = true;
      }
      if (!prop.status) {
        prop.status = "published";
        changed = true;
      }
      if (changed) {
        await prop.save();
      }
    }

    // M. Ensure Villa, Cottage, Lodge categories are seeded if property count < 6
    if (allExistingProps.length < 6) {
      console.log("🌱 Seeding complementary luxury villas, cottages, and lodges...");
      const extraProperties = [
        {
          propertyId: "PROP-04",
          slug: "heritage-coorg-coffee-estate-bungalow",
          name: "Heritage Coorg Coffee Estate Bungalow",
          subtitle: "120-Year-Old Colonial Planters Sanctuary",
          location: "Virajpet Road, Coorg, Karnataka 571218",
          locationUrl: "https://maps.google.com/?q=Heritage+Coorg+Bungalow",
          type: "Luxury Villa",
          category: "villa",
          rating: 4.9,
          reviewsCount: 88,
          pricePerNight: 12500,
          priceRange: "₹12,500 - ₹24,000",
          roomType: "Colonial Heritage Master Suite",
          guests: "Up to 6",
          maxAdults: 4,
          maxChildren: 2,
          view: "Endless Arabica Coffee & Pepper Canopies",
          bedType: "Four-Poster Antique Teak Bed",
          checkInTime: "02:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8274 258000",
          contactEmail: "reservations@rrcoorgholidays.com",
          image: "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1582610116397-edb318620f90?auto=format&fit=crop&w=1200&q=85",
            "https://images.unsplash.com/photo-1571896349842-33c89424de2d?auto=format&fit=crop&w=1200&q=85"
          ],
          totalRooms: 6,
          active: true,
          status: "published",
          featured: true,
          description: "Stately 19th-century colonial estate bungalow with rosewood ceilings, private butler, authentic fireplace, and heritage Kodava recipes.",
          amenities: ["Free Wi-Fi", "Private Butler", "Estate Jeep Safari", "Fireplace", "Breakfast", "Coffee Trails"]
        },
        {
          propertyId: "PROP-05",
          slug: "the-mountain-estate-retreat-and-sanctuary",
          name: "The Mountain Estate Retreat & Sanctuary",
          subtitle: "Waterfalls & Glass Pavilion Hideaway",
          location: "Somwarpet Estate, Coorg, Karnataka 571236",
          locationUrl: "https://maps.google.com/?q=Somwarpet+Coorg",
          type: "Mountain Cottage",
          category: "cottage",
          rating: 4.9,
          reviewsCount: 184,
          pricePerNight: 8500,
          priceRange: "₹8,500 - ₹15,000",
          roomType: "Signature Panoramic Suite",
          guests: "Up to 4",
          maxAdults: 3,
          maxChildren: 2,
          view: "Waterfall & Misty Valley",
          bedType: "Handcrafted Teak King Bed",
          checkInTime: "02:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8274 258000",
          contactEmail: "concierge@rrcoorgholidays.com",
          image: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=1200&q=85",
            "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=900&q=85"
          ],
          totalRooms: 8,
          active: true,
          status: "published",
          featured: true,
          description: "Perched 4,000 feet amidst misty waterfalls and lush Arabica coffee plantations, with reclaimed teakwood suites and heated plunge pools.",
          amenities: ["Free Wi-Fi", "Infinity Valley Pool", "Plantation Restaurant", "EV Parking", "Forest Spa", "Breakfast"]
        },
        {
          propertyId: "PROP-06",
          slug: "rainforest-canopy-haven",
          name: "Rainforest Canopy Haven Lodge",
          subtitle: "Untamed Biodiversity Timber Lodge",
          location: "Talakaveri Foothills, Coorg, Karnataka 571247",
          locationUrl: "https://maps.google.com/?q=Talakaveri+Coorg",
          type: "Eco Lodge",
          category: "lodge",
          rating: 4.8,
          reviewsCount: 98,
          pricePerNight: 7200,
          priceRange: "₹7,200 - ₹12,000",
          roomType: "Canopy Treehouse Suite",
          guests: "Up to 3",
          maxAdults: 2,
          maxChildren: 1,
          view: "Deep Evergreen Canopy",
          bedType: "Plush Timber King Bed",
          checkInTime: "02:00 PM",
          checkOutTime: "11:00 AM",
          contactPhone: "+91 8274 258000",
          contactEmail: "stay@rrcoorgholidays.com",
          image: "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1200&q=85",
          gallery: [
            "https://images.unsplash.com/photo-1602002418082-a4443e081dd1?auto=format&fit=crop&w=1200&q=85"
          ],
          totalRooms: 10,
          active: true,
          status: "published",
          description: "Deep in the Western Ghats rainforest canopy with natural stream pools, organic farm dining, and nocturnal nature walks.",
          amenities: ["Free Wi-Fi", "Organic Dining", "Bonfire", "Forest Walks", "Bird Watching"]
        }
      ];

      for (const ep of extraProperties) {
        const exists = await Property.findOne({ propertyId: ep.propertyId });
        if (!exists) {
          await Property.create(ep);
        }
      }
      console.log("✅ Seeded additional luxury properties for all categories.");
    }
  } catch (seedErr) {
    console.warn("Seeding notice:", seedErr.message);
  }
}

// =========================================================================
// 6. CONNECT TO MONGODB & START SERVER
// =========================================================================
console.log("Connecting to MongoDB at:", MONGO_URI);

mongoose
  .connect(MONGO_URI)
  .then(async () => {
    console.log("🚀 MongoDB connected successfully to", MONGO_URI);
    await seedInitialDatabase();
    await verifyEmailConfig();

    const server = app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🌟 RR Resorts and Villas Backend Server running on port ${PORT}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`🏨 Properties: http://localhost:${PORT}/api/properties`);
      console.log(`🏡 Villas: http://localhost:${PORT}/api/villas`);
      console.log(`🌿 Resorts: http://localhost:${PORT}/api/resorts`);
      console.log(`📋 Bookings: http://localhost:${PORT}/api/bookings`);
      console.log(`🛏️ Rooms: http://localhost:${PORT}/api/rooms`);
      console.log(`💳 Payments: http://localhost:${PORT}/api/payments`);
      console.log(`🎟️ Coupons: http://localhost:${PORT}/api/coupons`);
      console.log(`📧 Newsletter: http://localhost:${PORT}/api/newsletter`);
      console.log(`📁 Uploads: http://localhost:${PORT}/api/upload`);
      console.log(`🎧 Support: http://localhost:${PORT}/api/support`);
      console.log(`🔔 Notifications: http://localhost:${PORT}/api/notifications`);
      console.log(`📊 Dashboard Stats: http://localhost:${PORT}/api/dashboard/stats`);
      console.log(`======================================================\n`);
    });

    // Graceful shutdown
    const handleShutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Shutting down gracefully...`);
      server.close(async () => {
        try {
          await mongoose.connection.close();
          console.log("MongoDB connection closed.");
          process.exit(0);
        } catch (err) {
          process.exit(1);
        }
      });
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("Starting server in standalone mode without DB connection...");
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT} (Database disconnected)`);
    });
  });

module.exports = app;
