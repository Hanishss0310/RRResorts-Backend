/**
 * RR Resorts and Villas - Transactional Email Service
 * Sender: donotreply.rrresortsandvillas@gmail.com
 * Powered by Nodemailer + Gmail SMTP
 */

const nodemailer = require("nodemailer");

// Configuration from environment with mandatory defaults
const SMTP_HOST = process.env.SMTP_HOST || "smtp.gmail.com";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || "donotreply.rrresortsandvillas@gmail.com";
const SMTP_PASS = process.env.SMTP_PASS || "";
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || "RR Resorts and Villas";
const MAIL_FROM_ADDRESS = process.env.MAIL_FROM_ADDRESS || "donotreply.rrresortsandvillas@gmail.com";
const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || "admin@rrcoorgholidays.com";
const FRONTEND_URL = process.env.FRONTEND_URL || "https://rrresortsandvillas.in";
const ADMIN_URL = process.env.ADMIN_URL || "https://rr-resorts-and-villas-admin.web.app";

let transporter = null;

/**
 * Initialize or get active Nodemailer transporter
 */
function getTransporter() {
  if (!transporter) {
    if (SMTP_PASS && SMTP_PASS.trim().length > 0) {
      const cleanPass = SMTP_PASS.replace(/\s+/g, "");
      const isGmail =
        (SMTP_HOST && SMTP_HOST.includes("gmail")) ||
        (SMTP_USER && SMTP_USER.includes("gmail"));

      const transportConfig = isGmail
        ? {
            service: "gmail",
            auth: {
              user: SMTP_USER,
              pass: cleanPass
            }
          }
        : {
            host: SMTP_HOST,
            port: SMTP_PORT,
            secure: SMTP_SECURE,
            auth: {
              user: SMTP_USER,
              pass: cleanPass
            },
            tls: {
              rejectUnauthorized: false
            }
          };

      transporter = nodemailer.createTransport(transportConfig);
    }
  }
  return transporter;
}

/**
 * Validate email configuration during startup
 */
async function verifyEmailConfig() {
  if (!SMTP_PASS || SMTP_PASS.trim().length === 0) {
    console.log("ℹ️ [Email Service] Gmail SMTP_PASS not set. Emails will be logged in developer sandbox mode.");
    console.log("   Sender Address: " + MAIL_FROM_ADDRESS);
    console.log("   To activate live Gmail delivery, generate a 16-character Google App Password and set SMTP_PASS in .env.");
    return false;
  }

  try {
    const t = getTransporter();
    await t.verify();
    console.log(`✅ [Email Service] Connected to Gmail SMTP as ${SMTP_USER}`);
    return true;
  } catch (err) {
    console.warn(`⚠️ [Email Service] SMTP connection verification failed: ${err.message}`);
    return false;
  }
}

/**
 * Base email layout wrapper with luxury Kodava aesthetic
 */
function wrapHtmlEmail({ title, preheader, bodyContent }) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8F6F0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #1F2937; }
    .container { max-width: 600px; margin: 30px auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; border: 1px solid #E5E2DA; box-shadow: 0 4px 20px rgba(0,0,0,0.05); }
    .header { background: linear-gradient(135deg, #0B1F33 0%, #12372A 100%); padding: 36px 30px; text-align: center; color: #FFFFFF; border-bottom: 3px solid #DFBE76; }
    .brand-title { font-size: 24px; font-weight: 700; letter-spacing: 2px; margin: 0; color: #FFFFFF; text-transform: uppercase; font-family: 'Georgia', serif; }
    .brand-sub { font-size: 11px; font-weight: 600; color: #DFBE76; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; }
    .content { padding: 36px 30px; font-size: 15px; line-height: 1.6; color: #374151; }
    .content h2 { color: #0B1F33; font-size: 20px; margin-top: 0; margin-bottom: 16px; font-family: 'Georgia', serif; }
    .cta-btn { display: inline-block; background-color: #12372A; color: #DFBE76 !important; font-weight: 700; font-size: 14px; padding: 14px 28px; text-decoration: none; border-radius: 8px; margin: 20px 0; letter-spacing: 1px; text-transform: uppercase; }
    .info-box { background-color: #F8F6F0; border: 1px solid #DFBE76; border-radius: 10px; padding: 18px; margin: 20px 0; }
    .footer { background-color: #0B1F33; padding: 24px 30px; text-align: center; font-size: 12px; color: #9CA3AF; border-top: 1px solid #1E3A5F; }
    .footer a { color: #DFBE76; text-decoration: none; }
    .otp-box { background: #FAF9F6; border: 2px dashed #12372A; border-radius: 12px; padding: 20px; text-align: center; margin: 24px 0; }
    .otp-code { font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #12372A; margin: 6px 0; }
  </style>
</head>
<body>
  <div style="display:none;font-size:1px;color:#F8F6F0;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">
    ${preheader || title}
  </div>
  <div class="container">
    <div class="header">
      <h1 class="brand-title">RR Resorts & Villas</h1>
      <div class="brand-sub">Luxury Stays • Coorg Sanctuary</div>
    </div>
    <div class="content">
      ${bodyContent}
    </div>
    <div class="footer">
      <p style="margin: 0 0 8px 0; color: #E5E7EB; font-weight: 600;">RR Resorts and Villas • Kodava Heritage & Sanctuary</p>
      <p style="margin: 0 0 12px 0;">Madikeri - Virajpet Highway, Stuart Hill, Coorg, Karnataka 571201</p>
      <p style="margin: 0 0 8px 0;">This email was sent from an unmonitored mailbox (<a href="mailto:donotreply.rrresortsandvillas@gmail.com">donotreply.rrresortsandvillas@gmail.com</a>). For reservations, contact concierge@rrcoorgholidays.com.</p>
      <p style="margin: 0; color: #6B7280;">© ${new Date().getFullYear()} RR Resorts and Villas. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * Core send mail wrapper
 */
async function sendMail({ to, subject, text, html, replyTo }) {
  const fromHeader = `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`;

  // Check if live transporter is active
  if (SMTP_PASS && SMTP_PASS.trim().length > 0) {
    const activeTransporter = getTransporter();
    if (activeTransporter) {
      try {
        const info = await activeTransporter.sendMail({
          from: fromHeader,
          to,
          subject,
          text,
          html,
          replyTo: replyTo || "concierge@rrcoorgholidays.com"
        });
        console.log(`[Email Delivered] Subject: "${subject}" to recipient: ${to} (MessageId: ${info.messageId})`);
        return { success: true, messageId: info.messageId, mode: "live" };
      } catch (err) {
        console.error(`[Email Failed] Delivery to ${to} failed: ${err.message}`);
        throw new Error(`Email delivery failed: ${err.message}`);
      }
    }
  }

  // Developer / Sandbox simulation fallback when SMTP_PASS is not provided
  console.log(`\n======================================================`);
  console.log(`📧 [MOCK EMAIL DISPATCH] Mode: Development / Test`);
  console.log(`From:    ${fromHeader}`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Time:    ${new Date().toISOString()}`);
  console.log(`------------------------------------------------------`);
  console.log(text);
  console.log(`======================================================\n`);

  return { success: true, mode: "sandbox", simulated: true };
}

// =========================================================================
// TRANSACTIONAL EMAIL METHODS
// =========================================================================

/**
 * 1. Send Secure 6-digit OTP Email
 */
async function sendOtpEmail({ to, otp, purpose = "Verification", expiryMinutes = 5, recipientName = "Guest" }) {
  console.log(`\n======================================================`);
  console.log(`🔑 [OTP DISPATCHED] Recipient: ${to} | Code: ${otp} | Purpose: ${purpose}`);
  console.log(`======================================================\n`);

  const subject = `Your RR Resorts & Villas Security Code: ${otp}`;
  const preheader = `Your ${purpose} security code is ${otp}. Valid for ${expiryMinutes} minutes.`;

  const bodyContent = `
    <h2>Security Verification Code</h2>
    <p>Dear <strong>${recipientName}</strong>,</p>
    <p>You requested a one-time security code for <strong>${purpose}</strong> on your RR Resorts & Villas account.</p>
    
    <div class="otp-box">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #6B7280; font-weight: 700;">Your One-Time Passcode</div>
      <div class="otp-code">${otp}</div>
      <div style="font-size: 12px; color: #DC2626; font-weight: 600;">Expires in ${expiryMinutes} minutes • Single Use Only</div>
    </div>

    <div class="info-box">
      <strong style="color: #0B1F33;">Security Best Practices:</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #4B5563;">
        <li>Never share this code with anyone, including RR Resorts staff.</li>
        <li>Our concierges will never call or message asking for your OTP.</li>
        <li>If you did not request this code, please secure your account immediately.</li>
      </ul>
    </div>
  `;

  const text = `
RR Resorts and Villas — Security Verification Code
==================================================

Dear ${recipientName},

Your one-time security code for ${purpose} is: ${otp}

This code will expire in ${expiryMinutes} minutes.
Never share this code with anyone.

If you did not request this verification code, please ignore this email.

— RR Resorts and Villas Team
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 2. Send Registration / Welcome Email
 */
async function sendWelcomeEmail({ to, name }) {
  const subject = `Welcome to RR Resorts & Villas, ${name}`;
  const preheader = `Welcome to your private luxury retreat in the misty hills of Coorg.`;

  const bodyContent = `
    <h2>Welcome to the RR Resorts Privilege Circle</h2>
    <p>Dear <strong>${name}</strong>,</p>
    <p>Thank you for creating an account with <strong>RR Resorts and Villas</strong>. We are delighted to welcome you to our world of authentic Kodava hospitality, lush Arabica coffee plantations, and curated sanctuary villas.</p>
    
    <div class="info-box">
      <strong style="color: #0B1F33;">Your Member Privileges Include:</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 13px; color: #4B5563;">
        <li>Best Guaranteed Nightly Rates directly backed by our estates.</li>
        <li>Complimentary breakfast credits & fresh coffee estate trail tours.</li>
        <li>Real-time booking management & priority reservations concierge.</li>
        <li>Flexible cancellation policies for peace of mind.</li>
      </ul>
    </div>

    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/resorts" class="cta-btn">Explore Luxury Stays</a>
    </div>
  `;

  const text = `
Welcome to RR Resorts and Villas, ${name}!
=========================================

Thank you for registering your account with RR Resorts and Villas.
We look forward to hosting you amidst the coffee plantations of Coorg.

Explore our stays: ${FRONTEND_URL}/resorts

— RR Resorts and Villas
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 3. Send Booking Confirmation Email
 * Subject: Your Booking Is Confirmed – RR Resorts & Villas
 */
async function sendBookingConfirmationEmail(booking) {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Your Booking Is Confirmed – RR Resorts & Villas`;
  const preheader = `Your reservation #${booking.bookingId} at ${booking.propertyName} is confirmed.`;

  const guestSummary = `${booking.adults || 2} Adults${booking.children ? `, ${booking.children} Children` : ""}`;
  const totalFmt = `₹${Number(booking.totalAmount || 0).toLocaleString("en-IN")}`;
  const paidFmt = `₹${Number(booking.paidAmount || booking.totalAmount || 0).toLocaleString("en-IN")}`;
  const pendingFmt = `₹${Number(booking.pendingAmount || 0).toLocaleString("en-IN")}`;
  const txnRef = booking.utrNumber || booking.transactionId || "Confirmed by Front Desk";

  const bodyContent = `
    <h2 style="color: #12372A; margin-top: 0;">Your Booking Is Confirmed!</h2>
    <p>Dear <strong>${booking.guest.name}</strong>,</p>
    <p>We are delighted to confirm your upcoming reservation with <strong>RR Resorts & Villas</strong>. Your reservation details are summarized below:</p>

    <div class="info-box" style="border-left: 4px solid #DFBE76; background-color: #FAF9F5;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking ID:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right; font-family: monospace;">#${booking.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Property Name:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right;">${booking.propertyName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Accommodation:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.roomType} ${booking.roomNumber ? `(Room ${booking.roomNumber})` : ""}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Check-In Date:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.checkIn} (from 1:00 PM)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Check-Out Date:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.checkOut} (until 11:00 AM)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Guest Count:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${guestSummary} (${booking.nights || 1} Night${booking.nights > 1 ? "s" : ""})</td>
        </tr>
        <tr style="border-top: 1px dashed #CBD5E1;">
          <td style="padding: 10px 0 4px 0; font-weight: 700; font-size: 15px; color: #0B1F33;">Total Amount:</td>
          <td style="padding: 10px 0 4px 0; font-weight: 700; font-size: 17px; color: #12372A; text-align: right;">${totalFmt}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Payment Method:</td>
          <td style="padding: 4px 0; font-weight: 600; text-align: right;">${booking.paymentMethod || "Online UPI"}</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Payment Status:</td>
          <td style="padding: 4px 0; font-weight: 700; color: #059669; text-align: right;">PAID / CONFIRMED</td>
        </tr>
        <tr>
          <td style="padding: 4px 0; color: #6B7280;">Transaction Ref / UTR:</td>
          <td style="padding: 4px 0; font-family: monospace; font-size: 12px; text-align: right;">${txnRef}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 10px; padding: 16px; margin: 20px 0;">
      <strong style="color: #166534;">Confirmation Message:</strong>
      <p style="margin: 6px 0 0 0; font-size: 13px; color: #14532D; line-height: 1.5;">
        Your reservation is officially confirmed and your suite is secured. Our concierge team is preparing for your arrival amidst the lush Kodava coffee plantations. Please present this email or your Booking ID at reception upon check-in.
      </p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${FRONTEND_URL}/dashboard/active-bookings" class="cta-btn">View My Bookings</a>
    </div>

    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 13px; color: #6B7280;">
      <strong style="color: #0B1F33;">RR Resorts & Villas Contact Details:</strong>
      <p style="margin: 4px 0;">📞 Concierge Desk: <strong>+91 8274 258000</strong> | +91 94480 12345</p>
      <p style="margin: 4px 0;">✉️ Direct Inquiries: <strong>concierge@rrcoorgholidays.com</strong></p>
      <p style="margin: 4px 0;">📍 Location: Madikeri - Virajpet Highway, Stuart Hill, Coorg, Karnataka 571201</p>
    </div>
  `;

  const text = `
Your Booking Is Confirmed – RR Resorts & Villas
===============================================
Dear ${booking.guest.name},

Your booking is officially confirmed!
- Booking ID: #${booking.bookingId}
- Property: ${booking.propertyName}
- Check-In: ${booking.checkIn} (from 1:00 PM)
- Check-Out: ${booking.checkOut} (until 11:00 AM)
- Guests: ${guestSummary}
- Total Amount: ${totalFmt}
- Payment: ${booking.paymentMethod || "Online"} (PAID)
- Transaction / UTR: ${txnRef}

Contact Details:
Concierge: +91 8274 258000 | concierge@rrcoorgholidays.com
Madikeri - Virajpet Highway, Coorg, Karnataka 571201

View details: ${FRONTEND_URL}/dashboard/active-bookings
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 4. Send Booking Cancellation Email
 * Subject: Update Regarding Your Booking – RR Resorts & Villas
 */
async function sendBookingCancellationEmail(booking, reason = "Cancelled by administration") {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Update Regarding Your Booking – RR Resorts & Villas`;
  const preheader = `Important update regarding the cancellation of reservation #${booking.bookingId}.`;

  const totalFmt = `₹${Number(booking.totalAmount || 0).toLocaleString("en-IN")}`;
  const refundInfo =
    booking.paymentStatus === "PAID" || booking.paymentStatus === "Paid"
      ? `A refund of ${totalFmt} has been initiated per property cancellation policy and will be credited to your original payment method within 5-7 business days.`
      : `No payments were settled for this reservation. No cancellation charges have been levied.`;

  const bodyContent = `
    <h2 style="color: #991B1B; margin-top: 0;">Update Regarding Your Booking</h2>
    <p>Dear <strong>${booking.guest.name}</strong>,</p>
    <p>We are writing to provide you with an important update regarding your reservation at <strong>${booking.propertyName}</strong>.</p>

    <div class="info-box" style="border-left: 4px solid #EF4444; background-color: #FEF2F2;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking ID:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right; font-family: monospace;">#${booking.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Property Name:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right;">${booking.propertyName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Cancellation Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #DC2626; text-align: right;">CANCELLED</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Original Stay Dates:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.checkIn} to ${booking.checkOut}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Total Amount:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${totalFmt}</td>
        </tr>
      </table>
    </div>

    <div style="background-color: #FFFBEB; border: 1px solid #FDE68A; border-radius: 10px; padding: 16px; margin: 18px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #92400E;">Reason for Cancellation:</p>
      <p style="margin: 0; font-size: 13px; color: #78350F;">${reason || "Cancellation processed as per guest request or room availability adjustment."}</p>
    </div>

    <div style="background-color: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; margin: 18px 0;">
      <p style="margin: 0 0 6px 0; font-size: 13px; font-weight: 700; color: #334155;">Refund Information:</p>
      <p style="margin: 0; font-size: 13px; color: #475569;">${refundInfo}</p>
    </div>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${FRONTEND_URL}/resorts" class="cta-btn">Explore Other Dates</a>
    </div>

    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 13px; color: #6B7280;">
      <strong style="color: #0B1F33;">Need Assistance or Want to Reschedule?</strong>
      <p style="margin: 4px 0;">Our guest relations team is available 24/7 to assist with alternate dates or queries:</p>
      <p style="margin: 4px 0;">📞 Phone: <strong>+91 8274 258000</strong> | ✉️ Email: <strong>concierge@rrcoorgholidays.com</strong></p>
    </div>
  `;

  const text = `
Update Regarding Your Booking – RR Resorts & Villas
===================================================
Dear ${booking.guest.name},

Your reservation #${booking.bookingId} for ${booking.propertyName} has been cancelled.

- Booking ID: #${booking.bookingId}
- Property: ${booking.propertyName}
- Status: CANCELLED
- Reason: ${reason}
- Refund Info: ${refundInfo}

For assistance or rescheduling:
Phone: +91 8274 258000 | Email: concierge@rrcoorgholidays.com
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 5. Send Booking Not Confirmed Email
 * Subject: Booking Update – RR Resorts & Villas
 */
async function sendBookingNotConfirmedEmail(booking, reason = "") {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Booking Update – RR Resorts & Villas`;
  const preheader = `Important update regarding your reservation request #${booking.bookingId}.`;

  const totalFmt = `₹${Number(booking.totalAmount || 0).toLocaleString("en-IN")}`;

  const bodyContent = `
    <h2 style="color: #475569; margin-top: 0;">Booking Update – Reservation Not Confirmed</h2>
    <p>Dear <strong>${booking.guest.name}</strong>,</p>
    <p>Thank you for choosing <strong>RR Resorts & Villas</strong>. We are writing to inform you that your booking request <strong>#${booking.bookingId}</strong> for <strong>${booking.propertyName}</strong> has not been confirmed.</p>

    <div class="info-box" style="border-left: 4px solid #94A3B8; background-color: #F8FAFC;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking ID:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right; font-family: monospace;">#${booking.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Property:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right;">${booking.propertyName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Requested Dates:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.checkIn} to ${booking.checkOut}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #475569; text-align: right;">NOT CONFIRMED</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Total Amount:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${totalFmt}</td>
        </tr>
      </table>
    </div>

    ${
      reason
        ? `
    <div style="background-color: #FEF3C7; border: 1px solid #FCD34D; border-radius: 10px; padding: 16px; margin: 18px 0;">
      <strong style="color: #92400E;">Reason / Notes:</strong>
      <p style="margin: 4px 0 0 0; font-size: 13px; color: #78350F;">${reason}</p>
    </div>
    `
        : ""
    }

    <div style="background-color: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 10px; padding: 16px; margin: 18px 0; font-size: 13px; color: #334155; line-height: 1.6;">
      <strong>What happens next?</strong>
      <ul style="margin: 8px 0 0 0; padding-left: 20px;">
        <li>If any payment was debited from your account or submitted via UPI, it will be fully refunded or released immediately.</li>
        <li>Your requested dates and villa could not be locked due to high demand, payment verification issues, or inventory constraints.</li>
        <li>We invite you to reach out directly to our reservations team so we can assist you in finding an alternative suite or adjusting your stay dates.</li>
      </ul>
    </div>

    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 13px; color: #6B7280;">
      <strong style="color: #0B1F33;">Please Contact RR Resorts & Villas:</strong>
      <p style="margin: 4px 0;">📞 Direct Phone: <strong>+91 8274 258000</strong> / <strong>+91 94480 12345</strong></p>
      <p style="margin: 4px 0;">✉️ Email: <strong>concierge@rrcoorgholidays.com</strong></p>
      <p style="margin: 4px 0;">Our reservations manager will be delighted to prioritize your alternate booking.</p>
    </div>
  `;

  const text = `
Booking Update – RR Resorts & Villas
===================================
Dear ${booking.guest.name},

Your booking request #${booking.bookingId} for ${booking.propertyName} has not been confirmed.

- Booking ID: #${booking.bookingId}
- Property: ${booking.propertyName}
- Requested Dates: ${booking.checkIn} to ${booking.checkOut}
- Status: NOT CONFIRMED
${reason ? `- Note: ${reason}\n` : ""}

If any funds were debited, they will be refunded immediately.
Please contact our resort team directly to assist with alternate accommodation:
Phone: +91 8274 258000 | Email: concierge@rrcoorgholidays.com
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 6. Send Pending Booking Email
 * Subject: Booking Request Received – RR Resorts & Villas
 */
async function sendBookingPendingEmail(booking) {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Booking Request Received – RR Resorts & Villas`;
  const preheader = `Your reservation request #${booking.bookingId} is pending confirmation.`;

  const totalFmt = `₹${Number(booking.totalAmount || 0).toLocaleString("en-IN")}`;

  const bodyContent = `
    <h2 style="color: #B45309; margin-top: 0;">Booking Request Received</h2>
    <p>Dear <strong>${booking.guest.name}</strong>,</p>
    <p>Thank you for choosing <strong>RR Resorts & Villas</strong>. We have received your reservation request for <strong>${booking.propertyName}</strong> and it is currently awaiting confirmation from our reservations desk.</p>

    <div class="info-box" style="border-left: 4px solid #F59E0B; background-color: #FFFBEB;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking ID:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right; font-family: monospace;">#${booking.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Property Name:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #0B1F33; text-align: right;">${booking.propertyName}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Check-In Date:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.checkIn}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Check-Out Date:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.checkOut}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking Status:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #D97706; text-align: right;">PENDING CONFIRMATION</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Payment Method:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${booking.paymentMethod || "Online / Cash"}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Total Amount:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #12372A; text-align: right;">${totalFmt}</td>
        </tr>
      </table>
    </div>

    <p style="font-size: 13px; color: #4B5563; line-height: 1.6;">
      Our front desk is reviewing room availability and payment verification. You will receive an immediate confirmation email as soon as your reservation is confirmed.
    </p>

    <div style="text-align: center; margin: 24px 0;">
      <a href="${FRONTEND_URL}/dashboard/active-bookings" class="cta-btn">Track Reservation Status</a>
    </div>

    <div style="border-top: 1px solid #E5E7EB; padding-top: 16px; font-size: 13px; color: #6B7280;">
      <strong style="color: #0B1F33;">RR Resorts & Villas Contact Details:</strong>
      <p style="margin: 4px 0;">📞 Concierge Desk: <strong>+91 8274 258000</strong></p>
      <p style="margin: 4px 0;">✉️ Direct Inquiries: <strong>concierge@rrcoorgholidays.com</strong></p>
    </div>
  `;

  const text = `
Booking Request Received – RR Resorts & Villas
=============================================
Dear ${booking.guest.name},

Your booking request #${booking.bookingId} for ${booking.propertyName} has been received and is awaiting confirmation.
- Check-In: ${booking.checkIn}
- Check-Out: ${booking.checkOut}
- Amount: ${totalFmt}
- Status: PENDING CONFIRMATION

Track status: ${FRONTEND_URL}/dashboard/active-bookings
Concierge: +91 8274 258000
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 5. Send Payment Success Email
 */
async function sendPaymentSuccessEmail(payment, booking) {
  const to = payment.guestEmail || booking?.guest?.email;
  if (!to) return null;

  const subject = `Payment Confirmed: ₹${(payment.amount || 0).toLocaleString("en-IN")} for #${payment.bookingId}`;
  const preheader = `We received your payment of ₹${payment.amount} for Booking #${payment.bookingId}.`;

  const bodyContent = `
    <h2>Payment Received Successfully</h2>
    <p>Dear <strong>${payment.guestName || "Guest"}</strong>,</p>
    <p>We have successfully processed your payment. Your official receipt details are listed below:</p>

    <div class="info-box">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Transaction ID:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right; font-family: monospace;">${payment.transactionId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Booking Reference:</td>
          <td style="padding: 6px 0; font-weight: 700; text-align: right;">#${payment.bookingId}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Amount Paid:</td>
          <td style="padding: 6px 0; font-weight: 700; color: #059669; text-align: right; font-size: 16px;">₹${(payment.amount || 0).toLocaleString("en-IN")}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Payment Method:</td>
          <td style="padding: 6px 0; font-weight: 600; text-align: right;">${payment.method}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6B7280;">Date & Time:</td>
          <td style="padding: 6px 0; text-align: right;">${new Date(payment.date || Date.now()).toLocaleString("en-IN")}</td>
        </tr>
      </table>
    </div>

    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard/payment-history" class="cta-btn">View Payment Receipt</a>
    </div>
  `;

  const text = `
Payment Confirmation
====================

Dear ${payment.guestName || "Guest"},

We received your payment of ₹${payment.amount} for Booking #${payment.bookingId}.
- Transaction ID: ${payment.transactionId}
- Method: ${payment.method}
- Date: ${new Date(payment.date || Date.now()).toLocaleString("en-IN")}

Thank you for choosing RR Resorts and Villas!
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 6. Send Refund Status Email
 */
async function sendPaymentRefundEmail(payment, booking, reason = "Approved by management") {
  const to = payment.guestEmail || booking?.guest?.email;
  if (!to) return null;

  const subject = `Refund Processed: ₹${(payment.amount || 0).toLocaleString("en-IN")} (Txn #${payment.transactionId})`;
  const preheader = `A refund of ₹${payment.amount} has been approved and processed.`;

  const bodyContent = `
    <h2>Refund Confirmation</h2>
    <p>Dear <strong>${payment.guestName || "Guest"}</strong>,</p>
    <p>A refund has been processed for Transaction <strong>#${payment.transactionId}</strong> (Booking <strong>#${payment.bookingId}</strong>).</p>

    <div class="info-box">
      <p style="margin: 0 0 6px 0;"><strong>Refund Amount:</strong> ₹${(payment.amount || 0).toLocaleString("en-IN")}</p>
      <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> ${reason}</p>
      <p style="margin: 0;"><strong>Settlement Timeline:</strong> 5-7 business days back to your original payment method.</p>
    </div>
  `;

  const text = `
Refund Confirmation
===================

Dear ${payment.guestName || "Guest"},

A refund of ₹${payment.amount} for Booking #${payment.bookingId} (Txn #${payment.transactionId}) has been processed.
Reason: ${reason}
Funds will reflect within 5-7 business days.

— RR Resorts and Villas
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 7. Send Contact Form & Enquiry Acknowledgement Email to Customer
 */
async function sendEnquiryAcknowledgementEmail(enquiry) {
  const to = enquiry.email;
  if (!to) return null;

  const subject = `Inquiry Received: ${enquiry.topic || "RR Resorts & Villas Stay"}`;
  const preheader = `Thank you for reaching out to RR Resorts & Villas. Our concierge will contact you shortly.`;

  const bodyContent = `
    <h2>Thank You for Reaching Out</h2>
    <p>Dear <strong>${enquiry.name}</strong>,</p>
    <p>We have received your message regarding <strong>${enquiry.resortName || "our luxury properties"}</strong> (${enquiry.topic || "General Enquiry"}).</p>

    <div class="info-box">
      <p style="margin: 0 0 6px 0;"><strong>Your Message:</strong></p>
      <p style="margin: 0; font-style: italic; color: #4B5563;">"${enquiry.message}"</p>
    </div>

    <p>Our dedicated travel concierge will review your requirements and respond via telephone (<strong>${enquiry.phone}</strong>) or email within 2-4 business hours.</p>
  `;

  const text = `
Inquiry Received — RR Resorts and Villas
=======================================

Dear ${enquiry.name},

Thank you for your enquiry regarding ${enquiry.resortName || "our properties"}.
Our concierge will get back to you shortly at ${enquiry.phone} or ${enquiry.email}.

— RR Resorts and Villas
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 9. Send Booking Request Email (For Cash or Pending Verification Bookings)
 */
async function sendBookingRequestEmail(booking) {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Booking Request Received: #${booking.bookingId} (${booking.bookingRef})`;
  const preheader = `We received your booking request for ${booking.propertyName}.`;

  const bodyContent = `
    <h2>Booking Request Received</h2>
    <p>Dear ${booking.guest.name},</p>
    <p>Thank you for choosing RR Resorts and Villas. We have received your reservation request for <strong>${booking.propertyName}</strong>.</p>
    
    <div class="info-box">
      <p style="margin: 0 0 8px 0;"><strong>Booking Reference:</strong> <span style="color: #12372A; font-weight: 700;">${booking.bookingRef}</span></p>
      <p style="margin: 0 0 8px 0;"><strong>Check-in:</strong> ${booking.checkIn} (from 1:00 PM)</p>
      <p style="margin: 0 0 8px 0;"><strong>Check-out:</strong> ${booking.checkOut} (until 11:00 AM)</p>
      <p style="margin: 0 0 8px 0;"><strong>Payment Method:</strong> ${booking.paymentMethod}</p>
      <p style="margin: 0 0 8px 0;"><strong>Payment Status:</strong> <span style="color: #D97706; font-weight: 700;">${booking.paymentStatus}</span></p>
      <p style="margin: 0;"><strong>Total Payable:</strong> ₹${Number(booking.totalAmount).toLocaleString("en-IN")}</p>
    </div>

    <p>${
      booking.paymentStatus === "CASH_PENDING"
        ? "Please note: This is a cash reservation. Payment must be settled in full at the resort reception upon check-in."
        : "Your online payment details are currently under verification with our bank records. You will receive an instant confirmation once verified."
    }</p>

    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard/active-bookings" class="cta-btn">View Reservation Status</a>
    </div>
  `;

  const text = `
Booking Request Received — RR Resorts and Villas
===============================================
Dear ${booking.guest.name},

Your reservation request at ${booking.propertyName} has been received.
Booking Reference: ${booking.bookingRef}
Check-in: ${booking.checkIn} | Check-out: ${booking.checkOut}
Total Amount: ₹${booking.totalAmount}
Status: ${booking.paymentStatus}

View status: ${FRONTEND_URL}/dashboard/active-bookings
— RR Resorts and Villas
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 10. Send Payment Proof Submission Confirmation to Customer
 */
async function sendPaymentSubmissionEmail(payment, booking) {
  const to = payment.guestEmail || booking?.guest?.email;
  if (!to) return null;

  const subject = `Payment Submitted for Verification: #${payment.bookingId}`;
  const preheader = `We received your payment proof for Booking #${payment.bookingId}.`;

  const bodyContent = `
    <h2>Payment Proof Submitted</h2>
    <p>Dear ${payment.guestName || "Guest"},</p>
    <p>We have successfully received your payment transaction details for Booking <strong>#${payment.bookingId}</strong>.</p>
    
    <div class="info-box">
      <p style="margin: 0 0 8px 0;"><strong>Transaction / UTR:</strong> ${payment.utrNumber || payment.transactionId}</p>
      <p style="margin: 0 0 8px 0;"><strong>Amount Submitted:</strong> ₹${Number(payment.amount).toLocaleString("en-IN")}</p>
      <p style="margin: 0 0 8px 0;"><strong>Method:</strong> ${payment.paymentMethod}</p>
      <p style="margin: 0;"><strong>Status:</strong> <span style="color: #D97706; font-weight: 700;">Pending Verification</span></p>
    </div>

    <p>Our finance desk will reconcile this against merchant bank records and confirm your reservation within 15-30 minutes.</p>
  `;

  const text = `
Payment Submitted for Verification — RR Resorts and Villas
Booking #${payment.bookingId}
UTR / Txn ID: ${payment.utrNumber || payment.transactionId}
Amount: ₹${payment.amount}
Status: Pending Verification

— RR Resorts and Villas
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 11. Send Payment Approval Notification
 */
async function sendPaymentApprovalEmail(payment, booking) {
  const to = payment.guestEmail || booking?.guest?.email;
  if (!to) return null;

  const subject = `Payment Verified & Confirmed: #${payment.bookingId}`;
  const preheader = `Your payment of ₹${Number(payment.amount).toLocaleString("en-IN")} has been verified.`;

  const bodyContent = `
    <h2 style="color: #12372A;">Payment Verified & Approved</h2>
    <p>Dear ${payment.guestName || "Guest"},</p>
    <p>Great news! Your payment of <strong>₹${Number(payment.amount).toLocaleString("en-IN")}</strong> for Booking <strong>#${payment.bookingId}</strong> has been verified against our records.</p>
    
    <div class="info-box">
      <p style="margin: 0 0 8px 0;"><strong>Booking Reference:</strong> ${booking?.bookingRef || payment.bookingId}</p>
      <p style="margin: 0 0 8px 0;"><strong>Property:</strong> ${payment.propertyName || booking?.propertyName}</p>
      <p style="margin: 0 0 8px 0;"><strong>Transaction / UTR:</strong> ${payment.utrNumber || payment.transactionId}</p>
      <p style="margin: 0 0 8px 0;"><strong>Verification Status:</strong> <span style="color: #059669; font-weight: 700;">VERIFIED (PAID)</span></p>
      <p style="margin: 0;"><strong>Verified On:</strong> ${new Date().toLocaleString("en-IN")}</p>
    </div>

    <p>Your stay is completely confirmed. We look forward to welcoming you to the misty hills of Coorg!</p>

    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard/active-bookings" class="cta-btn">Download Booking Pass</a>
    </div>
  `;

  const text = `
Payment Verified & Approved — RR Resorts and Villas
Booking #${payment.bookingId}
Amount: ₹${payment.amount}
Status: Verified & Confirmed

— RR Resorts and Villas
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 12. Send Payment Rejection Notification
 */
async function sendPaymentRejectionEmail(payment, booking, reason = "Payment reference could not be matched") {
  const to = payment.guestEmail || booking?.guest?.email;
  if (!to) return null;

  const subject = `Action Required: Payment Verification for Booking #${payment.bookingId}`;
  const preheader = `We could not verify your payment for Booking #${payment.bookingId}.`;

  const bodyContent = `
    <h2 style="color: #DC2626;">Payment Verification Notice</h2>
    <p>Dear ${payment.guestName || "Guest"},</p>
    <p>Our accounts team was unable to verify the transaction details submitted for Booking <strong>#${payment.bookingId}</strong>.</p>
    
    <div class="info-box" style="border-color: #DC2626; background: #FEF2F2;">
      <p style="margin: 0 0 8px 0;"><strong>Reason:</strong> ${reason}</p>
      <p style="margin: 0 0 8px 0;"><strong>Transaction / UTR:</strong> ${payment.utrNumber || payment.transactionId}</p>
      <p style="margin: 0;"><strong>Amount:</strong> ₹${Number(payment.amount).toLocaleString("en-IN")}</p>
    </div>

    <p>Please log in to your Guest Portal to re-enter your correct UTR / transaction number, or upload a clear payment screenshot.</p>

    <div style="text-align: center;">
      <a href="${FRONTEND_URL}/dashboard/active-bookings" class="cta-btn">Update Payment Details</a>
    </div>
  `;

  const text = `
Payment Verification Failed — RR Resorts and Villas
Booking #${payment.bookingId}
Reason: ${reason}
Please re-upload your valid payment confirmation at: ${FRONTEND_URL}/dashboard/active-bookings
  `.trim();

  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 13. Send Check-in Reminder
 */
async function sendCheckInReminderEmail(booking) {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Your Stay Starts Soon at ${booking.propertyName}`;
  const preheader = `Check-in reminder for Booking #${booking.bookingId}`;

  const bodyContent = `
    <h2>Your Coorg Getaway Begins Tomorrow!</h2>
    <p>Dear ${booking.guest.name},</p>
    <p>We are delighted to welcome you tomorrow at <strong>${booking.propertyName}</strong>.</p>
    <div class="info-box">
      <p><strong>Check-in Date:</strong> ${booking.checkIn} (from 1:00 PM)</p>
      <p><strong>Booking Ref:</strong> ${booking.bookingRef || booking.bookingId}</p>
      <p><strong>Property Address:</strong> Somwarpet Estate, Coorg, Karnataka</p>
    </div>
    <p>If you require early arrival arrangements or airport transfers, please notify our front desk at +91 8274 258000.</p>
  `;

  const text = `Check-in Reminder for ${booking.propertyName}: Check-in on ${booking.checkIn}. Ref: ${booking.bookingRef}`;
  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 14. Send Check-out Reminder
 */
async function sendCheckOutReminderEmail(booking) {
  const to = booking.guest?.email;
  if (!to) return null;

  const subject = `Check-out Reminder: ${booking.propertyName}`;
  const preheader = `Check-out reminder for Booking #${booking.bookingId}`;

  const bodyContent = `
    <h2>Thank You for Staying with RR Resorts</h2>
    <p>Dear ${booking.guest.name},</p>
    <p>We hope you had a rejuvenating stay with us. As a friendly reminder, check-out time is <strong>11:00 AM</strong> on <strong>${booking.checkOut}</strong>.</p>
    <p>Our bell desk is happy to assist with luggage storage or departure travel.</p>
  `;

  const text = `Check-out Reminder: Check-out time is 11:00 AM on ${booking.checkOut}. Thank you for choosing RR Resorts.`;
  const html = wrapHtmlEmail({ title: subject, preheader, bodyContent });
  return sendMail({ to, subject, text, html });
}

/**
 * 15. Send Administrator Payment Verification Alert
 */
async function sendAdminPaymentVerificationAlert(payment, booking) {
  const to = ADMIN_NOTIFICATION_EMAIL;
  if (!to) return null;

  const subject = `[VERIFY PAYMENT] Booking #${payment.bookingId} — ₹${payment.amount}`;
  const title = `New Payment Submission Awaiting Verification`;

  const detailsHtml = `
    <p><strong>Booking ID:</strong> ${payment.bookingId}</p>
    <p><strong>Guest:</strong> ${payment.guestName} (${payment.guestEmail})</p>
    <p><strong>Method:</strong> ${payment.paymentMethod}</p>
    <p><strong>Amount:</strong> ₹${Number(payment.amount).toLocaleString("en-IN")}</p>
    <p><strong>UTR / Transaction ID:</strong> ${payment.utrNumber || payment.transactionId}</p>
    ${payment.screenshotUrl ? `<p><strong>Screenshot:</strong> <a href="${payment.screenshotUrl}" target="_blank">View Uploaded Image</a></p>` : ""}
  `;

  const textContent = `Verify Payment for Booking #${payment.bookingId}: ₹${payment.amount} via ${payment.paymentMethod}. UTR: ${payment.utrNumber || payment.transactionId}`;

  return sendAdminNotificationEmail({ subject, title, detailsHtml, textContent });
}

/**
 * 16. Send Administrator Notification Email
 */
async function sendAdminNotificationEmail({ subject, title, detailsHtml, textContent }) {
  const to = ADMIN_NOTIFICATION_EMAIL;
  if (!to) return null;

  const emailSubject = `[RR ADMIN ALERT] ${subject}`;
  const preheader = subject;

  const bodyContent = `
    <h2 style="color: #991B1B;">Admin Notification</h2>
    <p style="font-size: 16px; font-weight: 600; color: #0B1F33;">${title}</p>
    <div class="info-box">
      ${detailsHtml}
    </div>
    <div style="text-align: center;">
      <a href="${ADMIN_URL}/dashboard" class="cta-btn">Open Admin Portal</a>
    </div>
  `;

  const text = `
[ADMIN NOTIFICATION] ${subject}
===============================
${title}

${textContent}

Log in to Admin Dashboard: ${ADMIN_URL}/dashboard
  `.trim();

  const html = wrapHtmlEmail({ title: emailSubject, preheader, bodyContent });
  return sendMail({ to, subject: emailSubject, text, html });
}

module.exports = {
  verifyEmailConfig,
  sendMail,
  sendOtpEmail,
  sendWelcomeEmail,
  sendBookingConfirmationEmail,
  sendBookingCancellationEmail,
  sendBookingNotConfirmedEmail,
  sendBookingPendingEmail,
  sendBookingRequestEmail,
  sendPaymentSuccessEmail,
  sendPaymentRefundEmail,
  sendPaymentSubmissionEmail,
  sendPaymentApprovalEmail,
  sendPaymentRejectionEmail,
  sendCheckInReminderEmail,
  sendCheckOutReminderEmail,
  sendAdminPaymentVerificationAlert,
  sendEnquiryAcknowledgementEmail,
  sendAdminNotificationEmail
};
