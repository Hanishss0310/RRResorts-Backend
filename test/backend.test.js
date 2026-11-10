/**
 * RR Resorts and Villas - Comprehensive Automated Backend Test Suite
 * Tests Auth, OTP, Properties, Availability, Pricing, Bookings, Collision Prevention,
 * Payments, Refunds, Enquiries, Coupons, Newsletter, and Dashboard Analytics.
 */

const assert = require("assert");

const BASE_URL = "http://localhost:5002/api";

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  };

  const response = await fetch(url, {
    ...options,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const status = response.status;
  let data = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status, ok: response.ok, data };
}

async function runTests() {
  console.log("======================================================");
  console.log("🧪 STARTING COMPREHENSIVE BACKEND TEST SUITE");
  console.log("======================================================\n");

  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err.message}\n`);
      failed++;
    }
  }

  const testEmail = `test_guest_${Date.now()}@example.com`;
  let userToken = "";
  let adminToken = "";
  let testBookingId = "";
  let testBookingRef = "";

  // 1. System Health
  await test("GET /api/health returns healthy status & connected database", async () => {
    const res = await request("/health");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.status, "healthy");
    assert.strictEqual(res.data.database, "connected");
  });

  // 2. Auth: Register
  await test("POST /api/auth/register creates user and issues JWT", async () => {
    const res = await request("/auth/register", {
      method: "POST",
      body: {
        name: "Test Traveler",
        email: testEmail,
        password: "securePassword123!",
        phone: "+91 98765 00000"
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token, "Token should be present");
    userToken = res.data.token;
  });

  // 3. Auth: Login
  await test("POST /api/auth/login authenticates with valid credentials", async () => {
    const res = await request("/auth/login", {
      method: "POST",
      body: {
        email: testEmail,
        password: "securePassword123!"
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token);
  });

  // 4. Auth: Admin Login
  await test("POST /api/auth/admin-login authenticates receptionist directly", async () => {
    const res = await request("/auth/admin-login", {
      method: "POST",
      body: {
        identifier: "reception@rrcoorgholidays.com",
        password: "Admin@123",
        role: "receptionist"
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(res.data.token);
    adminToken = res.data.token;
  });

  // 5. Auth: Owner 1 and Owner 2 Dedicated Login
  await test("POST /api/auth/admin-login authenticates Owner 1 (rrresortsandvillas@gmail.com)", async () => {
    const res = await request("/auth/admin-login", {
      method: "POST",
      body: {
        identifier: "rrresortsandvillas@gmail.com",
        password: "RajathRakesh@2026",
        role: "owner"
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role.toUpperCase(), "OWNER");
    assert(res.data.token, "Owner token should be issued");
  });

  await test("POST /api/auth/admin-login authenticates Owner 2 (hanishgowda7795@gmail.com)", async () => {
    const res = await request("/auth/admin-login", {
      method: "POST",
      body: {
        identifier: "hanishgowda7795@gmail.com",
        password: "HanishSS@2026",
        role: "owner"
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.user.role.toUpperCase(), "OWNER");
    assert(res.data.token, "Owner token should be issued");
  });

  await test("POST /api/auth/admin-login blocks normal users with 403 Forbidden", async () => {
    const res = await request("/auth/admin-login", {
      method: "POST",
      body: {
        identifier: testEmail,
        password: "securePassword123!",
        role: "user"
      }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  await test("POST /api/auth/google is completely disabled and returns 403 Forbidden", async () => {
    const res = await request("/auth/google", {
      method: "POST",
      body: { idToken: "dummy" }
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.data.success, false);
  });

  // 6. OTP Delivery & Rate Limiting
  await test("POST /api/auth/send-otp dispatches OTP and enforces cooldown", async () => {
    const otpEmail = `otp_check_${Date.now()}@example.com`;
    const res1 = await request("/auth/send-otp", {
      method: "POST",
      body: { email: otpEmail, purpose: "email_verification" }
    });
    assert.strictEqual(res1.status, 200);
    assert.strictEqual(res1.data.success, true);

    // Immediate second call should be rate-limited by 60s cooldown
    const res2 = await request("/auth/send-otp", {
      method: "POST",
      body: { email: otpEmail, purpose: "email_verification" }
    });
    assert.strictEqual(res2.status, 429);
    assert.strictEqual(res2.data.code, "RATE_LIMITED");
  });

  // 7. OTP Verification Attempt Limits & Invalidation
  await test("POST /api/auth/verify-otp rejects invalid code and tracks attempts", async () => {
    const res = await request("/auth/verify-otp", {
      method: "POST",
      body: { email: "nonexistent@example.com", otp: "000000", purpose: "general" }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  // 8. Properties: Public Listing
  await test("GET /api/properties returns published properties with slug", async () => {
    const res = await request("/properties");
    assert.strictEqual(res.status, 200);
    assert(res.data.data.length >= 3, "Expected at least 3 properties");
    const first = res.data.data[0];
    assert(first.slug, "Property should have slug");
    assert(first.name, "Property should have name");
  });

  // 9. Properties: Fetch by Slug
  await test("GET /api/properties/:slug returns specific property by URL slug", async () => {
    const res = await request("/properties/evolve-back-luxury-plantation-resort");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.slug, "evolve-back-luxury-plantation-resort");
  });

  // 10. Pricing Engine: Server-side authoritativeness
  await test("POST /api/bookings/calculate-price calculates room, meal, tax & coupon", async () => {
    const res = await request("/bookings/calculate-price", {
      method: "POST",
      body: {
        propertyId: "PROP-01",
        checkIn: "2026-11-10",
        checkOut: "2026-11-12",
        roomsCount: 1,
        adults: 2,
        couponCode: "WELCOME10"
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.data.nights, 2);
    assert(res.data.data.pricing.totalPayable > 0);
    assert(res.data.data.pricing.discountAmount > 0, "WELCOME10 discount should apply");
  });

  // 11. Availability Checker
  await test("GET /api/bookings/check-availability reports accurate room capacity", async () => {
    const res = await request(
      "/bookings/check-availability?propertyId=PROP-01&checkIn=2026-11-10&checkOut=2026-11-12&roomsCount=1"
    );
    assert.strictEqual(res.status, 200);
    assert.strictEqual(typeof res.data.available, "boolean");
    assert(res.data.availableRooms >= 0);
  });

  // 12. Booking Creation with Collision Prevention
  await test("POST /api/bookings creates booking with reference and calculates authoritative amount", async () => {
    const testFutureYear = 2027 + Math.floor(Math.random() * 5);
    const testCheckIn = `${testFutureYear}-05-10`;
    const testCheckOut = `${testFutureYear}-05-12`;

    const res = await request("/bookings", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        propertyId: "PROP-01",
        checkIn: testCheckIn,
        checkOut: testCheckOut,
        roomsCount: 1,
        guest: {
          name: "Test Traveler",
          email: testEmail,
          phone: "+91 98765 00000"
        },
        paymentMethod: "UPI",
        paymentStatus: "Pending"
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
    assert(res.data.bookingRef.startsWith("RR-BK-"));
    testBookingId = res.data.bookingId;
    testBookingRef = res.data.bookingRef;
  });

  // 13. Customer Data Isolation: User can access own booking
  await test("GET /api/bookings/my returns user's active bookings", async () => {
    const res = await request("/bookings/my", {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.data.all.length >= 1);
  });

  // 14. Customer Data Isolation: Unauthorized access blocked
  await test("GET /api/bookings/:id blocks unauthorized customer viewing other bookings", async () => {
    const otherEmail = `stranger_${Date.now()}@example.com`;
    const regRes = await request("/auth/register", {
      method: "POST",
      body: {
        name: "Stranger",
        email: otherEmail,
        password: "strangerPassword123!"
      }
    });
    const strangerToken = regRes.data.token;

    const res = await request(`/bookings/${testBookingId}`, {
      headers: { Authorization: `Bearer ${strangerToken}` }
    });
    assert.strictEqual(res.status, 403, "Stranger should be forbidden from accessing another customer's booking");
  });

  // 15. Razorpay Order Creation
  await test("POST /api/payments/create-order generates gateway order", async () => {
    const res = await request("/payments/create-order", {
      method: "POST",
      body: {
        bookingId: testBookingId,
        amount: 5000,
        currency: "INR"
      }
    });
    assert.strictEqual(res.status, 200);
    assert(res.data.data.orderId, "Order ID should be created");
  });

  // 16. Razorpay Payment Verification
  await test("POST /api/payments/verify rejects fraudulent/invalid signature", async () => {
    const res = await request("/payments/verify", {
      method: "POST",
      body: {
        razorpayOrderId: "order_fake123",
        razorpayPaymentId: "pay_fake123",
        razorpaySignature: "invalid_tampered_signature",
        bookingId: testBookingId,
        amount: 5000
      }
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.data.success, false);
  });

  // 17. Sandbox Verified Payment Verification
  await test("POST /api/payments/verify records verified transaction in sandbox test mode", async () => {
    const res = await request("/payments/verify", {
      method: "POST",
      body: {
        razorpayOrderId: `order_${Date.now()}`,
        razorpayPaymentId: `pay_sbx_${Date.now()}`,
        razorpaySignature: "sandbox_verified_signature",
        bookingId: testBookingId,
        amount: 5000
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
  });

  // 18. Contact Form & Enquiry
  await test("POST /api/enquiries (and /api/contact) saves guest enquiry and queues acknowledgment email", async () => {
    const res = await request("/enquiries", {
      method: "POST",
      body: {
        name: "Ananya Sharma",
        email: "ananya.sharma@example.com",
        phone: "+91 94480 99999",
        topic: "Group booking",
        message: "We would like to book 4 luxury pool villas for a family anniversary."
      }
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.data.success, true);
  });

  // 19. Newsletter Subscription & Deduplication
  await test("POST /api/newsletter/subscribe validates and subscribes email with welcome offer", async () => {
    const newsEmail = `newsletter_${Date.now()}@example.com`;
    const res1 = await request("/newsletter/subscribe", {
      method: "POST",
      body: { email: newsEmail }
    });
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.data.success, true);

    const res2 = await request("/newsletter/subscribe", {
      method: "POST",
      body: { email: newsEmail }
    });
    assert.strictEqual(res2.status, 200);
    assert(res2.data.message.includes("already a member"));
  });

  // 20. Coupon Validation
  await test("POST /api/coupons/validate verifies coupon code and discounts correctly", async () => {
    const res = await request("/coupons/validate", {
      method: "POST",
      body: {
        code: "WELCOME10",
        bookingAmount: 10000,
        propertyId: "PROP-01"
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert.strictEqual(res.data.data.discountAmount, 1000);
    assert.strictEqual(res.data.data.finalAmount, 9000);
  });

  // 21. Real Dashboard Analytics (Zero Hardcoded Fakes)
  await test("GET /api/dashboard/stats returns real database aggregations", async () => {
    const res = await request("/dashboard/stats");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const stats = res.data.data.operationalStats;
    assert(typeof stats.totalBookings === "number");
    assert(typeof stats.totalRevenue === "number");
    assert(typeof stats.occupancyRate === "number");
    assert(Array.isArray(res.data.data.monthlyRevenue));
    assert(Array.isArray(res.data.data.occupancyByProperty));
  });

  // 22. UPI Config endpoint
  await test("GET /api/payments/upi-config returns valid merchant UPI configuration", async () => {
    const res = await request("/payments/upi-config");
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    assert(typeof res.data.data.upiId === "string");
    assert.strictEqual(res.data.data.cashSurchargeBase, 150);
    assert.strictEqual(res.data.data.cashSurchargePercent, 0.02);
  });

  // 23. Cash Surcharge Rule Validation (Formula: 150 + (Room Base Price * 2%))
  await test("POST /api/bookings/calculate-price applies strict cash surcharge > 150", async () => {
    const res = await request("/bookings/calculate-price", {
      method: "POST",
      body: {
        propertyId: "PROP-01",
        checkIn: "2026-11-20",
        checkOut: "2026-11-22",
        roomsCount: 1,
        isCashPayment: true
      }
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.data.success, true);
    const pricing = res.data.data.pricing;
    assert.strictEqual(pricing.isCashPayment, true);
    assert(pricing.cashSurcharge > 150);
    assert.strictEqual(pricing.totalPayable, pricing.onlineTotal + pricing.cashSurcharge);
  });

  // 24. Payment Verification Submission & Duplicate UTR rejection
  await test("POST /api/payments/submit-verification saves proof and rejects duplicates", async () => {
    // 1. Create a cash booking first
    const bookRes = await request("/bookings", {
      method: "POST",
      body: {
        propertyId: "PROP-01",
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        roomsCount: 1,
        paymentMethod: "CASH",
        guest: {
          name: "Surcharge Tester",
          email: "surcharge_test@example.com",
          phone: "+91 99999 88888"
        }
      }
    });
    assert.strictEqual(bookRes.status, 201);
    const bookingId = bookRes.data.bookingId;

    const testUtr = `UTR${Date.now().toString().slice(-8)}`;

    // 2. Submit payment proof
    const subRes = await request("/payments/submit-verification", {
      method: "POST",
      body: {
        bookingId,
        paymentMethod: "ONLINE_UPI",
        utrNumber: testUtr,
        payerUpiId: "guest@okaxis",
        screenshotUrl: "http://localhost:5002/uploads/test_screenshot.jpg"
      }
    });
    assert.strictEqual(subRes.status, 200);
    assert.strictEqual(subRes.data.success, true);
    assert.strictEqual(subRes.data.data.paymentStatus, "PENDING_VERIFICATION");

    // 3. Try submitting identical UTR for a different booking
    const bookRes2 = await request("/bookings", {
      method: "POST",
      body: {
        propertyId: "PROP-02",
        checkIn: "2026-12-10",
        checkOut: "2026-12-12",
        roomsCount: 1,
        paymentMethod: "ONLINE_UPI",
        guest: {
          name: "Fraud Attempt",
          email: "fraud@example.com",
          phone: "+91 99999 77777"
        }
      }
    });
    const bookingId2 = bookRes2.data.bookingId;

    const dupRes = await request("/payments/submit-verification", {
      method: "POST",
      body: {
        bookingId: bookingId2,
        paymentMethod: "ONLINE_UPI",
        utrNumber: testUtr
      }
    });
    assert.strictEqual(dupRes.status, 409); // Rejected duplicate UTR
  });

  // 25. Admin Payment Verification & Approval
  await test("POST /api/payments/:id/verify-admin approves payment and confirms booking", async () => {
    // Locate the payment just submitted
    const listRes = await request("/payments/pending-verifications");
    assert.strictEqual(listRes.status, 200);
    assert(listRes.data.data.length > 0);

    const pendingItem = listRes.data.data[0];
    const verifyRes = await request(`/payments/${pendingItem.paymentId}/verify-admin`, {
      method: "POST",
      body: {
        verificationNotes: "Verified via HDFC Merchant Netbanking",
        verifiedBy: "Senior Auditor"
      }
    });
    assert.strictEqual(verifyRes.status, 200);
    assert.strictEqual(verifyRes.data.success, true);
    assert.strictEqual(verifyRes.data.data.paymentStatus, "PAID");
    assert.strictEqual(verifyRes.data.data.verificationStatus, "VERIFIED");
  });

  // 26. Admin Booking Status Management: Mark Confirmed & Not Confirmed
  await test("PUT /api/bookings/:id/status updates status to 'Not Confirmed' and records audit", async () => {
    // Create fresh test booking
    const bkRes = await request("/bookings", {
      method: "POST",
      body: {
        propertyId: "azure-haven-resort",
        checkIn: "2026-12-25",
        checkOut: "2026-12-28",
        adults: 2,
        roomsCount: 1,
        guest: {
          name: "Test Traveler",
          email: "test.traveler@example.com",
          phone: "+91 99999 88888"
        }
      }
    });
    assert.strictEqual(bkRes.status, 201);
    const testBkId = bkRes.data.bookingId;

    // Update to Not Confirmed
    const updateRes = await request(`/bookings/${testBkId}/status`, {
      method: "PUT",
      body: {
        bookingStatus: "Not Confirmed",
        cancellationReason: "Maintenance inspection required"
      }
    });
    assert.strictEqual(updateRes.status, 200);
    assert.strictEqual(updateRes.data.success, true);
    assert.strictEqual(updateRes.data.data.bookingStatus, "Not Confirmed");
    assert.strictEqual(updateRes.data.emailDispatched, true);

    // Duplicate submission should NOT re-dispatch email
    const dupUpdateRes = await request(`/bookings/${testBkId}/status`, {
      method: "PUT",
      body: {
        bookingStatus: "Not Confirmed"
      }
    });
    assert.strictEqual(dupUpdateRes.status, 200);
    assert.strictEqual(dupUpdateRes.data.emailDispatched, false);
  });

  // 27. Admin Booking Payment Verification via /api/bookings/:id/verify-payment
  await test("POST /api/bookings/:id/verify-payment verifies payment and confirms booking", async () => {
    const verifyFutureYear = 2027 + Math.floor(Math.random() * 5);
    const bkRes = await request("/bookings", {
      method: "POST",
      body: {
        propertyId: "azure-haven-resort",
        checkIn: `${verifyFutureYear}-08-15`,
        checkOut: `${verifyFutureYear}-08-17`,
        adults: 2,
        roomsCount: 1,
        paymentMethod: "ONLINE_UPI",
        transactionId: "TXN_AUDIT_" + Date.now(),
        guest: {
          name: "Verified Guest",
          email: "verified.guest@example.com",
          phone: "+91 91111 22222"
        }
      }
    });
    assert.strictEqual(bkRes.status, 201);
    const testBkId = bkRes.data.bookingId;

    const vRes = await request(`/bookings/${testBkId}/verify-payment`, {
      method: "POST",
      body: {
        verificationNotes: "Approved against bank statement",
        verifiedBy: "Head of Accounts"
      }
    });
    assert.strictEqual(vRes.status, 200);
    assert.strictEqual(vRes.data.success, true);
    assert.strictEqual(vRes.data.booking.paymentStatus, "PAID");
    assert.strictEqual(vRes.data.booking.bookingStatus, "Confirmed");
    assert.strictEqual(vRes.data.payment.verificationStatus, "VERIFIED");
  });

  console.log("\n======================================================");
  console.log(`📊 TEST SUITE SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("======================================================\n");

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

// Check if server is already running on port 5002
async function startTestSuite() {
  try {
    const res = await fetch("http://localhost:5002/api/health");
    if (res.ok) {
      await runTests();
      return;
    }
  } catch {}

  // If not running, start Index.js
  require("../Index");
  setTimeout(async () => {
    await runTests();
  }, 1500);
}

startTestSuite();
