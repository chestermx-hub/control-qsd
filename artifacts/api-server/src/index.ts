import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq, count } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function seedSuperadminIfEmpty() {
  try {
    const result = await db.select({ count: count() }).from(usersTable);
    const userCount = result[0]?.count ?? 0;
    if (userCount === 0) {
      const passwordHash = await bcrypt.hash("QIS2025!", 10);
      await db.insert(usersTable).values({
        name: "Jos\u00e9 Alberto Osornio Morales",
        email: "sistemas@qis-servicio.com",
        passwordHash,
        puesto: "Superadministrador",
        area: "Sistemas",
        role: "superadmin",
      });
      logger.info("Seeded superadmin: sistemas@qis-servicio.com");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed superadmin");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

seedSuperadminIfEmpty().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
