const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const User = require("../Models/User");
const Staff = require("../Models/Staff");
const AuditLog = require("../Models/AuditLog");
const { generateAndSendOtp, verifyOtp } = require("../services/otpService");
const { sendWelcomeEmail } = require("../services/emailService");

// JWT secret & Google Client ID from environment or direct default config
const JWT_SECRET = process.env.JWT_SECRET || "rr_coorg_holidays_secret_key_2026_jwt_token";
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "1028392182910-rrcoorgholidays.apps.googleusercontent.com";

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

/**
 * Middleware to verify JWT authentication
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ success: false, message: "Authorization token required" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({ success: false, message: "User session expired or invalid" });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: "Invalid or expired session token" });
  }
};

/**
 * Middleware to enforce role-based access
 */
const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: "Authentication required" });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access requires ${allowedRoles.join(" or ")} role.`
      });
    }

    next();
  };
};

/**
 * Helper to generate JWT token for user
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name
    },
    JWT_SECRET,
    { expiresIn: "14d" }
  );
};

// =========================================================================
// 1. GOOGLE LOGIN DISCONTINUED
// =========================================================================
router.post("/google", async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Google Login has been removed. Please sign in or register with your email address and password."
  });
});

// =========================================================================
// 2. EMAIL / PASSWORD REGISTRATION WITH OTP VERIFICATION
// =========================================================================
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, confirmPassword, phone, otp } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Full legal name, email address, and password are required."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long."
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match. Please verify and re-enter."
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Prevent duplicate email registrations
    const existing = await User.findOne({ email: normalizedEmail });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: "An account with this email address already exists. Please sign in."
      });
    }

    // Verify OTP if provided
    let isEmailVerified = false;
    if (otp) {
      let otpCheck = await verifyOtp({
        identifier: normalizedEmail,
        purpose: "registration",
        otp
      });
      if (!otpCheck.success) {
        otpCheck = await verifyOtp({
          identifier: normalizedEmail,
          purpose: "email_verification",
          otp
        });
      }
      if (!otpCheck.success) {
        return res.status(400).json({
          success: false,
          message: otpCheck.message || "Invalid or expired verification code."
        });
      }
      isEmailVerified = true;
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone ? phone.trim() : "",
      role: "user",
      authProvider: "local",
      membership: "Privilege Member",
      isEmailVerified
    });

    await user.save();

    // Trigger transactional welcome email
    try {
      await sendWelcomeEmail({ to: user.email, name: user.name });
    } catch (mailErr) {
      console.warn("Welcome email notice:", mailErr.message);
    }

    const token = generateToken(user);

    return res.status(201).json({
      success: true,
      message: "Registration successful! Welcome to RR Resorts & Villas.",
      token,
      user: user.toClientJSON()
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ success: false, message: err.message || "Registration failed" });
  }
});

// =========================================================================
// 3. EMAIL / PASSWORD LOGIN & OTP LOGIN
// =========================================================================
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "No registered account found with this email."
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message: "Password not set for this account. Please use Forgot Password to set one."
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Please verify and try again."
      });
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: user.toClientJSON()
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ success: false, message: err.message || "Login failed" });
  }
});

// POST /api/auth/login-with-otp - Email OTP login
router.post("/login-with-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email address and 6-digit OTP code are required."
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No registered account found with this email address."
      });
    }

    const otpCheck = await verifyOtp({
      identifier: normalizedEmail,
      purpose: "login_otp",
      otp
    });

    if (!otpCheck.success) {
      return res.status(400).json({
        success: false,
        message: otpCheck.message || "Invalid or expired security code."
      });
    }

    if (!user.isEmailVerified) {
      user.isEmailVerified = true;
      await user.save();
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: user.toClientJSON()
    });
  } catch (err) {
    console.error("OTP Login error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to sign in with OTP" });
  }
});

// =========================================================================
// 4. ADMIN & OWNER & STAFF LOGIN
// =========================================================================
router.post("/admin-login", async (req, res) => {
  try {
    const { identifier, email, password, requestOtp } = req.body;
    const targetIdentifier = (identifier || email || "").toLowerCase().trim();

    if (!targetIdentifier || !password) {
      return res.status(400).json({
        success: false,
        message: "Admin corporate email address and password are required."
      });
    }

    // 1. Check in Staff collection
    const staffMember = await Staff.findOne({
      $or: [{ email: targetIdentifier }, { phone: targetIdentifier }]
    });

    // 2. Check in User collection
    const user = await User.findOne({
      $or: [{ email: targetIdentifier }, { phone: targetIdentifier }]
    });

    if (!staffMember && !user) {
      return res.status(401).json({
        success: false,
        message: "No administrative or staff account found with these credentials."
      });
    }

    // Check deactivated status
    if (staffMember && staffMember.active === false) {
      return res.status(403).json({
        success: false,
        message: "Account Revoked: Your staff access has been deactivated by the owner. Please contact management."
      });
    }

    // Verify password against staff or user
    let isMatch = false;
    if (staffMember && staffMember.password) {
      isMatch = await staffMember.comparePassword(password);
    }
    if (!isMatch && user && user.password) {
      isMatch = await bcrypt.compare(password, user.password);
    }

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials. Please verify your email and password."
      });
    }

    const effectiveRole = (staffMember?.role || user?.role || "RECEPTIONIST").toUpperCase();
    if (effectiveRole === "USER") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Customer accounts are not authorized to access the management portal."
      });
    }

    // Update lastLogin
    if (staffMember) {
      staffMember.lastLogin = new Date();
      await staffMember.save();
    }

    // If 2FA OTP explicitly requested for Owner
    if (requestOtp && effectiveRole === "OWNER") {
      const recipientEmail = staffMember?.email || user?.email;
      const recipientName = staffMember?.name || user?.name;
      const otpRes = await generateAndSendOtp({
        identifier: recipientEmail,
        purpose: "admin_2fa",
        recipientName: recipientName,
        ipAddress: req.ip
      });

      return res.status(200).json({
        success: true,
        requiresOtp: true,
        challengeId: `ch_${Date.now()}`,
        maskedContact: recipientEmail.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
        role: effectiveRole,
        message: otpRes.message
      });
    }

    // Effective permissions
    const permissions = (staffMember?.permissions && staffMember.permissions.length > 0)
      ? staffMember.permissions
      : (user?.permissions && user.permissions.length > 0)
        ? user.permissions
        : (effectiveRole === "OWNER"
          ? [
              "dashboard", "bookings", "calendar", "properties", "rooms",
              "customers", "payments", "offers", "enquiries", "support",
              "reviews", "notifications", "reports", "staff", "settings"
            ]
          : [
              "dashboard", "bookings", "calendar", "rooms", "customers", "enquiries"
            ]);

    const payloadUser = {
      _id: staffMember?._id || user?._id,
      id: staffMember?.staffId || (user?._id ? user._id.toString() : "STF-01"),
      staffId: staffMember?.staffId || "STF-01",
      name: staffMember?.name || user?.name,
      email: staffMember?.email || user?.email,
      phone: staffMember?.phone || user?.phone || "",
      role: effectiveRole,
      designation: staffMember?.designation || (effectiveRole === "OWNER" ? "Managing Director / Owner" : "Receptionist / Frontdesk"),
      avatar: staffMember?.avatar || user?.avatar || "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80",
      permissions: permissions,
      assignedProperties: staffMember?.assignedProperties || ["Evolve Back Resort", "Annapurna Resort"]
    };

    const token = generateToken(payloadUser);

    return res.status(200).json({
      success: true,
      requiresOtp: false,
      message: `Authenticated as ${effectiveRole}`,
      token,
      user: payloadUser
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Admin login failed" });
  }
});

// POST /api/auth/admin-send-otp - Dispatch OTP to registered admin/owner email
router.post("/admin-send-otp", async (req, res) => {
  try {
    const { identifier, email } = req.body;
    const targetIdentifier = (identifier || email || "").toLowerCase().trim();

    if (!targetIdentifier) {
      return res.status(400).json({
        success: false,
        message: "Admin or Owner email address is required."
      });
    }

    const user = await User.findOne({
      $or: [{ email: targetIdentifier }, { phone: targetIdentifier }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No administrative or owner account found with this email."
      });
    }

    const userRole = (user.role || "").toUpperCase();
    if (userRole === "USER") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Customer accounts are not authorized to access the management portal."
      });
    }

    const otpRes = await generateAndSendOtp({
      identifier: user.email,
      purpose: "admin_2fa",
      recipientName: user.name,
      ipAddress: req.ip
    });

    if (!otpRes.success) {
      return res.status(429).json(otpRes);
    }

    return res.status(200).json({
      success: true,
      requiresOtp: true,
      challengeId: `ch_${Date.now()}`,
      maskedContact: user.email.replace(/(.{2})(.*)(@.*)/, "$1***$3"),
      email: user.email,
      role: userRole,
      message: `A 6-digit login security code has been sent to ${user.email}.`
    });
  } catch (err) {
    console.error("Admin send OTP error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to dispatch admin security code" });
  }
});

// POST /api/auth/admin-verify-otp - Verify admin OTP and issue auth token
router.post("/admin-verify-otp", async (req, res) => {
  try {
    const { identifier, email, otp, otpCode, code } = req.body;
    const targetIdentifier = (identifier || email || "").toLowerCase().trim();
    const tokenOtp = otp || otpCode || code;

    if (!targetIdentifier || !tokenOtp) {
      return res.status(400).json({
        success: false,
        message: "Admin email and 6-digit verification code are required."
      });
    }

    const user = await User.findOne({
      $or: [{ email: targetIdentifier }, { phone: targetIdentifier }]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No administrative or owner account found with this email."
      });
    }

    const userRole = (user.role || "").toUpperCase();
    if (userRole === "USER") {
      return res.status(403).json({
        success: false,
        message: "Access Denied: Customer accounts cannot access the management portal."
      });
    }

    const verification = await verifyOtp({
      identifier: user.email,
      purpose: "admin_2fa",
      otp: tokenOtp
    });

    if (!verification.success) {
      return res.status(400).json(verification);
    }

    const token = generateToken(user);

    return res.status(200).json({
      success: true,
      message: `Authenticated as ${userRole}`,
      token,
      user: {
        ...user.toClientJSON(),
        role: userRole
      }
    });
  } catch (err) {
    console.error("Admin verify OTP error:", err);
    return res.status(500).json({ success: false, message: err.message || "Admin verification failed" });
  }
});

// =========================================================================
// 5. SEND OTP ENDPOINT (POST /api/auth/send-otp)
// =========================================================================
router.post("/send-otp", async (req, res) => {
  try {
    const { email, identifier, purpose = "general" } = req.body;
    const targetIdentifier = email || identifier;

    if (!targetIdentifier) {
      return res.status(400).json({
        success: false,
        message: "Email address or phone number is required."
      });
    }

    // Optional user lookup to personalize email
    const user = await User.findOne({
      $or: [{ email: targetIdentifier.toLowerCase().trim() }, { phone: targetIdentifier.trim() }]
    });

    const result = await generateAndSendOtp({
      identifier: targetIdentifier,
      purpose,
      recipientName: user ? user.name : "Guest",
      ipAddress: req.ip
    });

    if (!result.success) {
      return res.status(429).json(result);
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("Send OTP error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to generate security code" });
  }
});

// =========================================================================
// 6. VERIFY OTP ENDPOINT (POST /api/auth/verify-otp)
// =========================================================================
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, identifier, otp, purpose = "general" } = req.body;
    const targetIdentifier = email || identifier;

    if (!targetIdentifier || !otp) {
      return res.status(400).json({
        success: false,
        message: "Identifier and 6-digit OTP code are required."
      });
    }

    const verification = await verifyOtp({
      identifier: targetIdentifier,
      purpose,
      otp
    });

    if (!verification.success) {
      return res.status(400).json(verification);
    }

    // If verifying for Owner 2FA or Login, issue auth session token
    let token = null;
    let user = await User.findOne({
      $or: [{ email: targetIdentifier.toLowerCase().trim() }, { phone: targetIdentifier.trim() }]
    });

    if (user) {
      if (purpose === "email_verification" || purpose === "registration") {
        user.isEmailVerified = true;
        await user.save();
      }
      token = generateToken(user);
    }

    return res.status(200).json({
      success: true,
      message: "Verification successful",
      token,
      user: user ? user.toClientJSON() : null
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ success: false, message: err.message || "Verification failed" });
  }
});

// =========================================================================
// 7. FORGOT PASSWORD (POST /api/auth/forgot-password)
// =========================================================================
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email address is required." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Consistent response to prevent account enumeration
    if (user) {
      await generateAndSendOtp({
        identifier: user.email,
        purpose: "password_reset",
        recipientName: user.name,
        ipAddress: req.ip
      });
    }

    return res.status(200).json({
      success: true,
      message: "If an account matches that email address, a password reset code has been sent."
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to process forgot password" });
  }
});

// =========================================================================
// 8. RESET PASSWORD (POST /api/auth/reset-password)
// =========================================================================
router.post("/reset-password", async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: "Email and new password are required." });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters long." });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({ success: false, message: "Account not found." });
    }

    // If OTP provided, verify it
    if (otp) {
      const otpCheck = await verifyOtp({
        identifier: normalizedEmail,
        purpose: "password_reset",
        otp
      });

      if (!otpCheck.success) {
        return res.status(400).json(otpCheck);
      }
    }

    // Hash and update password
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    // Log security audit
    try {
      await AuditLog.create({
        action: "PASSWORD_RESET",
        performedBy: user.email,
        userRole: user.role,
        targetType: "User",
        targetId: user._id.toString(),
        details: { email: user.email },
        ipAddress: req.ip
      });
    } catch {}

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You can now log in with your new password."
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Password reset failed" });
  }
});

// =========================================================================
// 9. CURRENT AUTHENTICATED USER (GET /api/auth/me)
// =========================================================================
router.get("/me", authenticateUser, async (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user.toClientJSON()
  });
});

const requireOwnerOrAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }
  const role = (req.user.role || "").toUpperCase();
  if (role !== "OWNER" && role !== "ADMIN" && role !== "SUPERADMIN") {
    return res.status(403).json({
      success: false,
      message: "Forbidden: Restricted to Property Owners and Administrators only."
    });
  }
  next();
};

module.exports = router;
module.exports.authenticateUser = authenticateUser;
module.exports.requireRole = requireRole;
module.exports.requireOwnerOrAdmin = requireOwnerOrAdmin;
