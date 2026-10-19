/**
 * Gives an existing account staff (admin) access: `pnpm admin:grant someone@example.com`.
 * Add `--super` for a super admin (can also give and remove staff access).
 * Uses DATABASE_URL from .env. After the first admin, staff can manage roles in Admin → Users.
 */
import { config } from "dotenv";

config({ quiet: true });

async function main() {
  const email = process.argv.slice(2).find((a) => !a.startsWith("--"))?.trim().toLowerCase();
  const role = process.argv.includes("--super") ? "SUPER_ADMIN" : "ADMIN";
  if (!email || !email.includes("@")) {
    console.error("usage: pnpm admin:grant <email>");
    process.exit(1);
  }
  const { db } = await import("../src/lib/db");
  try {
    const user = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (!user) {
      console.error(`No account with the email ${email}. Sign up first, then run this again.`);
      process.exitCode = 1;
      return;
    }
    if (user.role === role) {
      console.log(`${email} already has that access.`);
      return;
    }
    await db.$transaction([
      db.user.update({ where: { id: user.id }, data: { role } }),
      db.auditLog.create({ data: { actorId: null, action: "user.role", entityType: "user", entityId: user.id, data: { from: user.role, to: role, via: "script" } } }),
    ]);
    console.log(`${email} is now staff. They can open Admin from their profile.`);
  } finally {
    await db.$disconnect();
  }
}

void main();
