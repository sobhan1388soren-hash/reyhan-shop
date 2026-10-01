// Phase 20 — one-time ADMIN bootstrap for the sandbox environment.
//
// Idempotent: upserts exactly one ADMIN account by phone. The phone is
// deliberately a TEST number that will never route to a real Iranian mobile
// (the local prefix 0000 is not a valid Iranian mobile range), so no real
// person can receive its OTP. The account is created phoneVerified=true so
// the admin console is usable in the sandbox without SMS delivery; in
// production an admin must complete the normal OTP verification.
//
// Usage:  node scripts/bootstrap-admin.mjs
//         (requires DATABASE_URL in .env; never auto-runs)

import "dotenv/config";

const ADMIN_PHONE = process.env.ADMIN_BOOTSTRAP_PHONE ?? "989000000000";
const ADMIN_FIRST_NAME = process.env.ADMIN_BOOTSTRAP_NAME ?? "مدیر ریحان";

async function createPrisma() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (check .env)");
  const { PrismaClient } = await import("@prisma/client");
  try {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter });
  } catch {
    return new PrismaClient();
  }
}

async function main() {
  const prisma = await createPrisma();

  const existing = await prisma.user.findUnique({
    where: { phone: ADMIN_PHONE },
    select: { id: true, role: true, status: true },
  });

  if (existing) {
    const updated = await prisma.user.update({
      where: { id: existing.id },
      data: { role: "ADMIN", status: "ACTIVE", phoneVerified: true, firstName: ADMIN_FIRST_NAME },
      select: { id: true, phone: true, role: true, status: true, phoneVerified: true },
    });
    console.log("[bootstrap:admin] Existing account promoted:");
    console.log(JSON.stringify(updated, null, 2));
  } else {
    const created = await prisma.user.create({
      data: {
        phone: ADMIN_PHONE,
        role: "ADMIN",
        status: "ACTIVE",
        phoneVerified: true,
        firstName: ADMIN_FIRST_NAME,
      },
      select: { id: true, phone: true, role: true, status: true, phoneVerified: true },
    });
    console.log("[bootstrap:admin] ADMIN account created:");
    console.log(JSON.stringify(created, null, 2));
  }

  const adminCount = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  console.log(`[bootstrap:admin] Active ADMIN accounts in DB: ${adminCount}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[bootstrap:admin] Failed:", err);
  process.exit(1);
});
