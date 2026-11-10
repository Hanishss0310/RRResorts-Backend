/**
 * RR Resorts and Villas - Cryptographically Secure OTP Service
 * Sender: donotreply.rrresortsandvillas@gmail.com
 */

const crypto = require("crypto");
const OTPRecord = require("../Models/OTPRecord");
const { sendOtpEmail } = require("./emailService");

const OTP_SECRET = process.env.OTP_SECRET || "rr_coorg_holidays_otp_salt_secret_2026";
const OTP_EXPIRY_MINUTES = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;

/**
 * Hash raw OTP with secret salt
 */
function hashOtp(otp, identifier, purpose) {
  return crypto
    .createHmac("sha256", OTP_SECRET)
    .update(`${identifier}:${purpose}:${otp}`)
    .digest("hex");
}

/**
 * Generate cryptographically unpredictable 6-digit numeric OTP
 */
function generateSecureOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Generate and send OTP to recipient
 */
async function generateAndSendOtp({ identifier, purpose = "general", recipientName = "Guest", ipAddress = "" }) {
  const cleanId = identifier.toLowerCase().trim();

  // 1. Check for recent active OTP to enforce resend cooldown
  const latestOtp = await OTPRecord.findOne({
    identifier: cleanId,
    purpose,
    isVerified: false
  }).sort({ createdAt: -1 });

  if (latestOtp && latestOtp.resendAvailableAt > new Date()) {
    const secondsRemaining = Math.ceil((latestOtp.resendAvailableAt - new Date()) / 1000);
    return {
      success: false,
      code: "RATE_LIMITED",
      message: `Please wait ${secondsRemaining} second(s) before requesting another security code.`,
      secondsRemaining
    };
  }

  // 2. Invalidate any previously active OTPs for this identifier and purpose
  await OTPRecord.updateMany(
    { identifier: cleanId, purpose, isVerified: false },
    { $set: { isVerified: true } } // mark as superseded
  );

  // 3. Generate raw 6-digit OTP
  const rawOtp = generateSecureOtp();
  const hashed = hashOtp(rawOtp, cleanId, purpose);

  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const resendAvailableAt = new Date(Date.now() + RESEND_COOLDOWN_SECONDS * 1000);

  // 4. Save hash to database
  const record = new OTPRecord({
    identifier: cleanId,
    purpose,
    otpHash: hashed,
    expiresAt,
    resendAvailableAt,
    maxAttempts: MAX_ATTEMPTS,
    ipAddress
  });
  await record.save();

  // 5. Send Email via nodemailer from donotreply.rrresortsandvillas@gmail.com
  let emailDispatched = false;
  if (cleanId.includes("@")) {
    try {
      await sendOtpEmail({
        to: cleanId,
        otp: rawOtp,
        purpose: purpose.replace(/_/g, " ").toUpperCase(),
        expiryMinutes: OTP_EXPIRY_MINUTES,
        recipientName
      });
      emailDispatched = true;
    } catch (err) {
      console.error(`[OTP Service] Failed to send email to ${cleanId}:`, err.message);
    }
  }

  return {
    success: true,
    message: `A 6-digit security code has been dispatched to ${cleanId.replace(/(.{2})(.*)(@.*)/, "$1***$3")}.`,
    expiryMinutes: OTP_EXPIRY_MINUTES,
    resendCooldownSeconds: RESEND_COOLDOWN_SECONDS,
    emailDispatched
  };
}

/**
 * Verify OTP submitted by user
 */
async function verifyOtp({ identifier, purpose = "general", otp }) {
  if (!otp || String(otp).trim().length !== 6) {
    return {
      success: false,
      code: "INVALID_FORMAT",
      message: "Please enter the complete 6-digit security code."
    };
  }

  const cleanId = identifier.toLowerCase().trim();
  const submittedOtp = String(otp).trim();

  // Find active, unverified OTP for this identifier and purpose
  const record = await OTPRecord.findOne({
    identifier: cleanId,
    purpose,
    isVerified: false
  }).sort({ createdAt: -1 });

  if (!record) {
    return {
      success: false,
      code: "EXPIRED_OR_NOT_FOUND",
      message: "No active security code found. Please request a new one."
    };
  }

  // Check if expired
  if (record.expiresAt < new Date()) {
    record.isVerified = true;
    await record.save();
    return {
      success: false,
      code: "EXPIRED",
      message: "This security code has expired. Please request a new one."
    };
  }

  // Check attempt limit
  if (record.attempts >= record.maxAttempts) {
    record.isVerified = true; // invalidate due to excess attempts
    await record.save();
    return {
      success: false,
      code: "MAX_ATTEMPTS_EXCEEDED",
      message: "Maximum verification attempts exceeded. Please request a new code."
    };
  }

  // Compute hash of submitted OTP
  const hashedInput = hashOtp(submittedOtp, cleanId, purpose);

  if (crypto.timingSafeEqual(Buffer.from(hashedInput), Buffer.from(record.otpHash))) {
    // Valid OTP! Invalidate to prevent replay
    record.isVerified = true;
    await record.save();

    return {
      success: true,
      message: "Security code verified successfully."
    };
  } else {
    // Increment attempts
    record.attempts += 1;
    await record.save();

    const remainingAttempts = record.maxAttempts - record.attempts;
    return {
      success: false,
      code: "INVALID_CODE",
      message: `Incorrect security code. ${remainingAttempts} attempt(s) remaining.`,
      remainingAttempts
    };
  }
}

module.exports = {
  generateAndSendOtp,
  verifyOtp
};
