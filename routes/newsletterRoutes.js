const express = require("express");
const router = express.Router();
const NewsletterSubscriber = require("../Models/NewsletterSubscriber");
const { sendMail } = require("../services/emailService");

// POST /api/newsletter/subscribe - Subscribe to newsletter
router.post("/subscribe", async (req, res) => {
  try {
    const { email, source } = req.body;

    if (!email || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "Valid email address is required." });
    }

    const cleanEmail = email.toLowerCase().trim();

    let subscriber = await NewsletterSubscriber.findOne({ email: cleanEmail });

    if (subscriber) {
      if (subscriber.active) {
        return res.status(200).json({
          success: true,
          message: "You are already a member of our Sanctuary Privilege Club."
        });
      } else {
        subscriber.active = true;
        subscriber.subscribedAt = new Date();
        subscriber.unsubscribedAt = null;
        await subscriber.save();
      }
    } else {
      subscriber = new NewsletterSubscriber({
        email: cleanEmail,
        source: source || "footer_signup"
      });
      await subscriber.save();
    }

    // Dispatch welcome email
    try {
      const appBase = (process.env.APP_BASE_URL || "https://rrresortsandvillas.in").replace(/\/api\/?$/, "");
      const subject = "Welcome to the RR Resorts Sanctuary Privilege Club";
      const text = `
Dear Guest,

Welcome to the RR Resorts & Villas Sanctuary Privilege Club!
You are now eligible to receive our seasonal travel bulletins, private villa invitations, and secret weekend rate offers.

Your Secret Welcome Privilege Code: RRWELCOME10 (Save 10% on your next stay)

To unsubscribe at any time, click here: ${appBase}/api/newsletter/unsubscribe?token=${subscriber.unsubscribeToken}

— RR Resorts and Villas Concierge
      `.trim();

      await sendMail({
        to: cleanEmail,
        subject,
        text
      });
    } catch (mailErr) {
      console.warn("Newsletter welcome email notice:", mailErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "Thank you for joining our Privilege Club! Check your inbox for your welcome privilege code."
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to process newsletter subscription" });
  }
});

// GET /api/newsletter/unsubscribe - Unsubscribe via link
router.get("/unsubscribe", async (req, res) => {
  try {
    const { token, email } = req.query;

    const query = {};
    if (token) query.unsubscribeToken = token;
    else if (email) query.email = email.toLowerCase().trim();
    else {
      return res.status(400).send("<h3>Invalid unsubscribe request. Missing token or email.</h3>");
    }

    const subscriber = await NewsletterSubscriber.findOne(query);
    if (!subscriber) {
      return res.status(404).send("<h3>Subscriber not found or already unsubscribed.</h3>");
    }

    subscriber.active = false;
    subscriber.unsubscribedAt = new Date();
    await subscriber.save();

    const frontendUrl = process.env.FRONTEND_URL || "https://rrresortsandvillas.in";
    return res.send(`
      <div style="font-family: sans-serif; text-align: center; padding: 50px;">
        <h2>Unsubscribed Successfully</h2>
        <p>You have been removed from the RR Resorts & Villas mailing list.</p>
        <p><a href="${frontendUrl}">Return to RR Resorts Website</a></p>
      </div>
    `);
  } catch (err) {
    return res.status(500).send(`<h3>Error processing request: ${err.message}</h3>`);
  }
});

// GET /api/newsletter/subscribers - Admin list of subscribers
router.get("/subscribers", async (req, res) => {
  try {
    const { active, search } = req.query;
    const filter = {};

    if (active !== undefined && active !== "all") {
      filter.active = active === "true";
    }

    if (search) {
      filter.email = new RegExp(search, "i");
    }

    const subscribers = await NewsletterSubscriber.find(filter).sort({ subscribedAt: -1 });

    return res.status(200).json({
      success: true,
      count: subscribers.length,
      data: subscribers
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to fetch subscribers" });
  }
});

// GET /api/newsletter/export - CSV export for admin
router.get("/export", async (req, res) => {
  try {
    const subscribers = await NewsletterSubscriber.find().sort({ subscribedAt: -1 });

    let csv = "Email,Status,SubscribedAt,Source\n";
    subscribers.forEach((s) => {
      csv += `"${s.email}","${s.active ? "Active" : "Unsubscribed"}","${s.subscribedAt ? s.subscribedAt.toISOString() : ""}","${s.source}"\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="rr_resorts_subscribers.csv"');
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || "Failed to export subscribers" });
  }
});

module.exports = router;
