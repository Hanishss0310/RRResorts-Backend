const bcrypt = require("bcryptjs");
const User = require("../Models/User");

const OWNERS_CONFIG = [
  {
    email: "rrresortsandvillas@gmail.com",
    name: "Rajath & Rakesh (Owner)",
    password: process.env.OWNER_1_PASSWORD || "RajathRakesh@2026",
    role: "OWNER",
    phone: "+91 94480 12345",
    membership: "Property Co-Owner"
  },
  {
    email: "hanishgowda7795@gmail.com",
    name: "Hanish S.S (Owner)",
    password: process.env.OWNER_2_PASSWORD || "HanishSS@2026",
    role: "OWNER",
    phone: "+91 98765 43210",
    membership: "Property Co-Owner"
  }
];

/**
 * Ensures the two owner accounts exist in MongoDB with securely hashed passwords
 */
async function provisionOwnerAccounts() {
  try {
    for (const ownerData of OWNERS_CONFIG) {
      const normalizedEmail = ownerData.email.toLowerCase().trim();
      let user = await User.findOne({ email: normalizedEmail });

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(ownerData.password, salt);

      if (!user) {
        user = new User({
          name: ownerData.name,
          email: normalizedEmail,
          password: hashedPassword,
          role: "OWNER",
          phone: ownerData.phone,
          membership: ownerData.membership,
          authProvider: "local",
          isEmailVerified: true
        });
        await user.save();
        console.log(`👑 [Owner Provisioning] Created OWNER account: ${normalizedEmail}`);
      } else {
        // Ensure role is OWNER, password hash is current, and email is verified
        let needsSave = false;
        if (user.role !== "OWNER" && user.role !== "owner") {
          user.role = "OWNER";
          needsSave = true;
        }
        if (!user.isEmailVerified) {
          user.isEmailVerified = true;
          needsSave = true;
        }

        // Check if password needs update
        const passwordMatches = await bcrypt.compare(ownerData.password, user.password || "");
        if (!passwordMatches) {
          user.password = hashedPassword;
          needsSave = true;
          console.log(`🔑 [Owner Provisioning] Updated password hash for OWNER: ${normalizedEmail}`);
        }

        if (needsSave) {
          await user.save();
        }
        console.log(`👑 [Owner Provisioning] Verified OWNER account: ${normalizedEmail}`);
      }
    }
  } catch (err) {
    console.error("❌ [Owner Provisioning Error]:", err.message);
  }
}

module.exports = {
  provisionOwnerAccounts,
  OWNERS_CONFIG
};

