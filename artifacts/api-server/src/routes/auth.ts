import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

async function enrichUser(user: typeof usersTable.$inferSelect) {
  const permissions: string[] = [];
  if (user.profileId) {
    const [profile] = await db.select().from(profilesTable).where(eq(profilesTable.id, user.profileId));
    if (profile && Array.isArray(profile.permissions)) {
      permissions.push(...profile.permissions);
    }
  }
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    puesto: user.puesto,
    area: user.area,
    profile_id: user.profileId,
    udn_id: user.udnId,
    role: user.role,
    permissions,
    created_at: user.createdAt,
  };
}

const SUPERADMIN_EMAIL = "sistemas@qis-servicio.com";
const SUPERADMIN_NAME = "Jos\u00e9 Alberto Osornio Morales";

async function ensureSuperadmin(plainPassword: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.email, SUPERADMIN_EMAIL));
  if (existing.length > 0) return existing[0];
  const passwordHash = await bcrypt.hash(plainPassword, 10);
  const [user] = await db.insert(usersTable).values({
    name: SUPERADMIN_NAME,
    email: SUPERADMIN_EMAIL,
    passwordHash,
    puesto: "Superadministrador",
    area: "Sistemas",
    role: "superadmin",
  }).returning();
  return user;
}

router.post("/auth/login", async (req: Request, res: Response) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  let user = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).then(rows => rows[0]);

  // Bootstrap: si no hay usuarios en la DB y el email es el superadmin, crearlo con el password proporcionado
  if (!user && email.toLowerCase() === SUPERADMIN_EMAIL) {
    try {
      user = await ensureSuperadmin(password);
    } catch (seedErr) {
      req.log?.error({ seedErr }, "Failed to bootstrap superadmin");
      res.status(500).json({ error: "Failed to create initial user" });
      return;
    }
  }

  if (!user) {
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Credenciales incorrectas" });
    return;
  }

  (req.session as unknown as Record<string, unknown>).userId = user.id;
  res.json({ user: await enrichUser(user) });
});

router.get("/auth/debug/users", async (_req: Request, res: Response) => {
  try {
    const users = await db.select({ id: usersTable.id, email: usersTable.email, name: usersTable.name, role: usersTable.role }).from(usersTable);
    res.json({ count: users.length, users });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

router.post("/auth/logout", (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ success: true });
  });
});

router.get("/auth/me", async (req: Request, res: Response) => {
  const userId = (req.session as unknown as Record<string, unknown>).userId as number | undefined;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  res.json(await enrichUser(user));
});

export default router;
