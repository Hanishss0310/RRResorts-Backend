const express = require("express");
const router = express.Router();
const Booking = require("../Models/Booking");
const Room = require("../Models/Room");
const Property = require("../Models/Property");
const Enquiry = require("../Models/Enquiry");
const Payment = require("../Models/Payment");
const Notification = require("../Models/Notification");

// GET /api/dashboard/stats - Real-time database-backed dashboard analytics
router.get("/stats", async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split("T")[0];

    // Parallel aggregation for high performance
    const [
      allBookings,
      allRooms,
      allProperties,
      pendingEnquiriesCount,
      allPayments,
      unreadNotificationsCount
    ] = await Promise.all([
      Booking.find().sort({ createdAt: -1 }),
      Room.find(),
      Property.find(),
      Enquiry.countDocuments({ status: "Pending" }),
      Payment.find().sort({ date: -1 }),
      Notification.countDocuments({ read: false })
    ]);

    // Active & today metrics directly from records
    const activeBookings = allBookings.filter((b) => b.statusCategory === "active");
    const confirmedBookings = allBookings.filter((b) => b.bookingStatus === "Confirmed");
    const completedBookings = allBookings.filter((b) => b.bookingStatus === "Completed");
    const cancelledBookings = allBookings.filter((b) => b.bookingStatus === "Cancelled");
    const cashBookingsCount = allBookings.filter((b) => b.paymentStatus === "CASH_PENDING" || b.paymentMethod === "CASH").length;
    const pendingVerificationsCount = allPayments.filter((p) => p.paymentStatus === "PENDING_VERIFICATION" || p.status === "Pending").length;

    const todayArrivals = allBookings.filter(
      (b) => b.checkIn && b.checkIn.startsWith(todayStr) && b.bookingStatus !== "Cancelled"
    );
    const todayDepartures = allBookings.filter(
      (b) => b.checkOut && b.checkOut.startsWith(todayStr) && b.bookingStatus !== "Cancelled"
    );

    // Revenue calculations (Strictly from real database payments & bookings)
    // Collected revenue = all successful payment records
    const collectedPayments = allPayments.filter((p) => p.status === "Success" || p.status === "Successful");
    const totalCollectedRevenue = collectedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // Outstanding / pending balances from active bookings
    const pendingBalanceAmount = activeBookings.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);

    // Total refunded amounts
    const refundedPayments = allPayments.filter((p) => p.status === "Refunded");
    const totalRefundedAmount = refundedPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

    // In-house guests (Guests currently checked in or in active reservations)
    const inHouseBookings = allBookings.filter((b) => b.bookingStatus === "Checked In" || b.statusCategory === "active");
    const totalGuestsInHouse = inHouseBookings.reduce(
      (sum, b) => sum + (b.adults || 0) + (b.children || 0),
      0
    );

    // Room status counts directly from Room collection
    const totalRooms = allRooms.length;
    const availableRooms = allRooms.filter((r) => r.status === "Available").length;
    const occupiedRooms = allRooms.filter((r) => r.status === "Occupied").length;
    const cleaningRooms = allRooms.filter((r) => r.status === "Cleaning").length;
    const reservedRooms = allRooms.filter((r) => r.status === "Reserved").length;
    const maintenanceRooms = allRooms.filter((r) => r.status === "Maintenance").length;

    const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

    // Monthly revenue aggregation directly from payments / bookings
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const monthlyRevenue = [];

    for (let i = 5; i >= 0; i--) {
      const monthIdx = (currentMonth - i + 12) % 12;
      const targetYear = monthIdx > currentMonth ? currentYear - 1 : currentYear;
      const monthLabel = monthNames[monthIdx];

      const monthBookings = allBookings.filter((b) => {
        const d = new Date(b.createdAt);
        return d.getMonth() === monthIdx && d.getFullYear() === targetYear;
      });

      const monthRev = monthBookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);

      monthlyRevenue.push({
        month: monthLabel,
        revenue: monthRev,
        bookings: monthBookings.length
      });
    }

    // Property-wise occupancy based on actual rooms
    const occupancyByProperty = allProperties.map((prop) => {
      const propRooms = allRooms.filter(
        (r) => r.propertyId === prop.propertyId || r.propertyId === prop._id?.toString()
      );
      const occRooms = propRooms.filter((r) => r.status === "Occupied").length;
      const rate = propRooms.length > 0 ? Math.round((occRooms / propRooms.length) * 100) : 0;
      return {
        id: prop.propertyId,
        name: prop.name,
        totalRooms: propRooms.length,
        occupiedRooms: occRooms,
        occupancyRate: rate
      };
    });

    const operationalStats = {
      totalBookings: allBookings.length,
      activeReservations: activeBookings.length,
      confirmedBookings: confirmedBookings.length,
      completedBookings: completedBookings.length,
      cancelledBookings: cancelledBookings.length,
      cashBookings: cashBookingsCount,
      pendingPaymentVerifications: pendingVerificationsCount,
      todayArrivals: todayArrivals.length,
      todayDepartures: todayDepartures.length,
      totalGuestsInHouse,
      occupancyRate,
      totalRevenue: totalCollectedRevenue,
      pendingAmount: pendingBalanceAmount,
      totalRefunded: totalRefundedAmount,
      availableRooms,
      occupiedRooms,
      cleaningRooms,
      reservedRooms,
      maintenanceRooms,
      totalRooms,
      pendingEnquiries: pendingEnquiriesCount,
      unreadNotifications: unreadNotificationsCount
    };

    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      data: {
        operationalStats,
        monthlyRevenue,
        occupancyByProperty,
        recentBookings: allBookings.slice(0, 10),
        recentPayments: allPayments.slice(0, 5)
      }
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    return res.status(500).json({ success: false, message: err.message || "Failed to generate dashboard analytics" });
  }
});

module.exports = router;
