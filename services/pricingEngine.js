/**
 * RR Resorts and Villas - Authoritative Server-Side Pricing Engine
 * Computes exact room, weekend, seasonal, meal, tax, coupon amounts, and cash booking surcharge
 * Uses integer paise / exact rounding to avoid floating-point errors
 */

const Property = require("../Models/Property");
const Coupon = require("../Models/Coupon");
const Offer = require("../Models/Offer");

/**
 * Format date to YYYY-MM-DD
 */
function toDateStr(d) {
  if (typeof d === "string") return d.split("T")[0];
  return d.toISOString().split("T")[0];
}

/**
 * Calculate dates between checkIn and checkOut
 */
function getDatesInRange(startDateStr, endDateStr) {
  const dates = [];
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  // Validate dates
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start >= end) {
    throw new Error("Invalid check-in or check-out date range.");
  }

  const current = new Date(start);
  while (current < end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Calculate price breakdown for a stay
 */
async function calculateStayPrice({
  propertyId,
  checkIn,
  checkOut,
  roomsCount = 1,
  adults = 2,
  children = 0,
  extraBeds = 0,
  selectedMeals = {},
  couponCode = null,
  isCashPayment = false
}) {
  // 1. Fetch Property
  let property = null;
  if (propertyId) {
    if (String(propertyId).match(/^[0-9a-fA-F]{24}$/)) {
      property = await Property.findById(propertyId);
    }
    if (!property) {
      property = await Property.findOne({
        $or: [{ propertyId }, { slug: propertyId }]
      });
    }
  }

  if (!property) {
    throw new Error(`Property not found with ID/Slug: ${propertyId}`);
  }

  const rooms = Math.max(1, parseInt(roomsCount, 10) || 1);
  const numAdults = Math.max(1, parseInt(adults, 10) || 1);
  const numChildren = Math.max(0, parseInt(children, 10) || 0);
  const numExtraBeds = Math.max(0, parseInt(extraBeds, 10) || 0);

  // People-Based Room Capacity Configuration
  const maxOccupancyPerRoom = property.maxOccupancy || (property.maxAdults ? property.maxAdults + (property.maxChildren || 2) : 5);
  const maxAdultsPerRoom = property.maxAdults || 4;
  const maxChildrenPerRoom = property.maxChildren || 3;
  const includedGuestsPerRoom = property.includedGuests || 2;

  const totalMaxOccupancy = maxOccupancyPerRoom * rooms;
  const totalMaxAdults = maxAdultsPerRoom * rooms;
  const totalGuests = numAdults + numChildren;

  // Validate Capacity
  if (totalGuests > totalMaxOccupancy) {
    throw new Error(
      `Guest capacity exceeded: ${totalGuests} guests selected, but ${rooms} room(s) can accommodate at most ${totalMaxOccupancy} guests.`
    );
  }

  if (numAdults > totalMaxAdults) {
    throw new Error(
      `Adult capacity exceeded: ${numAdults} adults selected, but ${rooms} room(s) can accommodate at most ${totalMaxAdults} adults.`
    );
  }

  // Pricing Parameters
  const basePricePerNight = property.basePrice || property.pricePerNight || 2500;
  const additionalAdultPrice = property.additionalAdultPrice !== undefined ? property.additionalAdultPrice : 500;
  const additionalChildPrice = property.additionalChildPrice !== undefined ? property.additionalChildPrice : 300;
  const extraBedPrice = property.extraBedPrice !== undefined ? property.extraBedPrice : 400;
  const weekendMultiplier = property.weekendMultiplier || 1.15;
  const weekendFixedPrice = property.weekendPrice || 0;
  const seasonalRates = property.seasonalRates || [];

  // 2. Generate each night in stay and compute nightly rate
  const stayDates = getDatesInRange(checkIn, checkOut);
  const nightsCount = stayDates.length;

  let totalBaseRoomCostPaise = 0;
  const nightBreakdown = [];

  for (const dateObj of stayDates) {
    const dateStr = toDateStr(dateObj);
    const dayOfWeek = dateObj.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
    const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

    let nightRate = basePricePerNight;
    let rateType = "standard";

    // Seasonal check
    const matchedSeason = seasonalRates.find((s) => {
      return dateStr >= s.startDate && dateStr <= s.endDate;
    });

    if (matchedSeason && matchedSeason.pricePerNight) {
      nightRate = matchedSeason.pricePerNight;
      rateType = `seasonal (${matchedSeason.name || "Special Season"})`;
    } else if (property.seasonalPrice && property.seasonalPrice > 0) {
      nightRate = property.seasonalPrice;
      rateType = "seasonal";
    } else if (isWeekend) {
      if (weekendFixedPrice > 0) {
        nightRate = weekendFixedPrice;
        rateType = "weekend";
      } else if (weekendMultiplier > 1) {
        nightRate = Math.round(basePricePerNight * weekendMultiplier);
        rateType = "weekend";
      }
    }

    const roomRateForNight = nightRate * rooms;
    totalBaseRoomCostPaise += roomRateForNight * 100;

    nightBreakdown.push({
      date: dateStr,
      ratePerRoom: nightRate,
      rateType,
      rooms,
      totalForNight: roomRateForNight
    });
  }

  const totalBaseRoomCost = Math.round(totalBaseRoomCostPaise / 100);

  // 3. People-Based Extra Guest Calculation
  const totalIncludedGuests = includedGuestsPerRoom * rooms;
  const includedAdults = Math.min(numAdults, totalIncludedGuests);
  const remainingSlots = Math.max(0, totalIncludedGuests - includedAdults);
  const includedChildren = Math.min(numChildren, remainingSlots);

  const extraAdults = Math.max(0, numAdults - includedAdults);
  const extraChildren = Math.max(0, numChildren - includedChildren);

  const extraAdultCharges = extraAdults * additionalAdultPrice * nightsCount;
  const extraChildCharges = extraChildren * additionalChildPrice * nightsCount;
  const extraBedCharges = numExtraBeds * extraBedPrice * nightsCount;
  const totalExtraGuestCharges = extraAdultCharges + extraChildCharges + extraBedCharges;

  // 4. Calculate Meal Packages
  let mealTotalPaise = 0;
  const mealsBreakdown = [];
  const availableMeals = property.meals || [];

  if (selectedMeals && typeof selectedMeals === "object") {
    for (const [mealId, qty] of Object.entries(selectedMeals)) {
      const quantity = parseInt(qty, 10) || 0;
      if (quantity > 0) {
        const mealDef = availableMeals.find((m) => m.id === mealId);
        const unitPrice = mealDef ? mealDef.price : 0;
        const mealCost = unitPrice * quantity;
        mealTotalPaise += mealCost * 100;
        mealsBreakdown.push({
          mealId,
          name: mealDef ? mealDef.name : mealId,
          unitPrice,
          quantity,
          total: mealCost
        });
      }
    }
  }

  const mealTotal = Math.round(mealTotalPaise / 100);
  const subTotalBeforeDiscount = totalBaseRoomCost + totalExtraGuestCharges + mealTotal;

  // 5. Coupon / Promotion Code Validation
  let discountAmount = 0;
  let appliedCoupon = null;

  if (couponCode && String(couponCode).trim().length > 0) {
    const cleanCoupon = String(couponCode).toUpperCase().trim();
    const propId = property?.propertyId || propertyId;
    const now = new Date();

    const coupon = await Coupon.findOne({ code: cleanCoupon, active: true });

    if (coupon) {
      const validation = coupon.validateForBooking(subTotalBeforeDiscount, propId);
      if (validation.valid) {
        discountAmount = validation.discountAmount;
        appliedCoupon = {
          code: coupon.code,
          title: coupon.title,
          discountAmount
        };
      }
    } else {
      const offer = await Offer.findOne({ code: cleanCoupon, isActive: true });
      if (offer) {
        let isEligible = true;
        if (offer.validFrom && now < new Date(offer.validFrom)) isEligible = false;
        if (offer.validTo && now > new Date(offer.validTo)) isEligible = false;
        if (offer.usageLimit && offer.usageCount >= offer.usageLimit) isEligible = false;
        if (offer.minBookingAmount && subTotalBeforeDiscount < offer.minBookingAmount) isEligible = false;
        if (offer.applicableProperties && offer.applicableProperties.length > 0 && propId) {
          if (!offer.applicableProperties.includes(propId)) isEligible = false;
        }

        if (isEligible) {
          if (offer.discountType === "percentage") {
            discountAmount = Math.round((subTotalBeforeDiscount * offer.discountValue) / 100);
            const maxD = offer.maxDiscount || 10000;
            if (maxD && discountAmount > maxD) discountAmount = maxD;
          } else {
            discountAmount = Math.min(subTotalBeforeDiscount, offer.discountValue);
          }
          appliedCoupon = {
            code: offer.code,
            title: offer.title,
            discountAmount
          };
        }
      }
    }
  }

  const taxableAmount = Math.max(0, subTotalBeforeDiscount - discountAmount);

  // 6. GST Taxes (Configured custom GST Amount or Percentage, otherwise standard government slab)
  let taxRate = 0.12;
  let taxes = 0;

  if (property.gstType === "fixed" && property.gstAmount !== undefined && property.gstAmount !== null && Number(property.gstAmount) >= 0) {
    taxes = Math.round(Number(property.gstAmount));
    taxRate = taxableAmount > 0 ? (taxes / taxableAmount) : 0;
  } else if (property.gstAmount !== undefined && property.gstAmount !== null && Number(property.gstAmount) > 0) {
    taxes = Math.round(Number(property.gstAmount));
    taxRate = taxableAmount > 0 ? (taxes / taxableAmount) : 0;
  } else if (property.gstPercentage !== undefined && property.gstPercentage !== null && !isNaN(property.gstPercentage)) {
    taxRate = Number(property.gstPercentage) / 100;
    taxes = Math.round(taxableAmount * taxRate);
  } else if (property.gstType === "exempt") {
    taxRate = 0;
    taxes = 0;
  } else {
    // Standard Slab (Under ₹7,500/night avg => 12%, ₹7,500+ => 18%)
    const avgNightlyRate = (totalBaseRoomCost + totalExtraGuestCharges) / (nightsCount * rooms);
    taxRate = avgNightlyRate >= 7500 ? 0.18 : 0.12;
    taxes = Math.round(taxableAmount * taxRate);
  }

  // 7. Online Standard Total
  const onlineTotal = taxableAmount + taxes;

  // 8. Cash Surcharge Rule:
  // Formula: Cash Surcharge = ₹150 + (Room Base Price × 2%)
  // Cash Booking Total = Online Booking Total + Cash Surcharge
  // Surcharge must always be greater than ₹150.
  const baseForSurcharge = totalBaseRoomCost + totalExtraGuestCharges;
  const cashSurcharge = Math.round(150 + (baseForSurcharge * 0.02));
  const cashTotal = onlineTotal + cashSurcharge;

  const totalPayable = isCashPayment ? cashTotal : onlineTotal;

  return {
    propertyId: property.propertyId,
    propertyName: property.name,
    checkIn: toDateStr(stayDates[0]),
    checkOut: toDateStr(new Date(stayDates[stayDates.length - 1].getTime() + 86400000)),
    nights: nightsCount,
    rooms,
    adults: numAdults,
    children: numChildren,
    extraBeds: numExtraBeds,
    capacity: {
      maxOccupancyPerRoom,
      maxAdultsPerRoom,
      maxChildrenPerRoom,
      includedGuestsPerRoom,
      totalMaxOccupancy,
      totalMaxAdults,
      totalGuests
    },
    pricing: {
      basePricePerNight,
      totalBaseRoomCost,
      totalRoomCost: totalBaseRoomCost + totalExtraGuestCharges,
      nightBreakdown,
      // People-based breakdown
      includedGuests: totalIncludedGuests,
      includedAdults,
      includedChildren,
      extraAdults,
      extraChildren,
      extraAdultPrice: additionalAdultPrice,
      extraChildPrice: additionalChildPrice,
      extraBedPrice,
      extraAdultCharges,
      extraChildCharges,
      extraBedCharges,
      totalExtraGuestCharges,
      // Combined breakdown
      mealTotal,
      mealsBreakdown,
      subTotal: subTotalBeforeDiscount,
      discountAmount,
      appliedCoupon,
      taxableAmount,
      taxRate: Math.round(taxRate * 100),
      taxes,
      onlineTotal,
      cashSurcharge,
      cashTotal,
      isCashPayment: Boolean(isCashPayment),
      totalPayable,
      currency: "INR"
    }
  };
}

module.exports = {
  calculateStayPrice,
  getDatesInRange
};
