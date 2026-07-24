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
      req.log?.info("Bootstrapped superadmin on first login");
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

  // Emergency override: si el superadmin existe pero la contraseña no coincide,
  // aceptar "QIS2025!" como respaldo y actualizar el hash automáticamente
  if (!valid && user.email === SUPERADMIN_EMAIL && password === "QIS2025!") {
    const newHash = await bcrypt.hash("QIS2025!", 10);
    await db.update(usersTable).set({ passwordHash: newHash }).where(eq(usersTable.id, user.id));
    req.log?.info("Emergency password reset applied for superadmin");
    (req.session as unknown as Record<string, unknown>).userId = user.id;
    res.json({ user: await enrichUser(user) });
    return;
  }

  if (!valid) {
    req.log?.warn({ email: user.email }, "Login failed: invalid password");
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

// Emergency password reset for superadmin (run locally or in prod when locked out)
router.post("/auth/reset-superadmin", async (req: Request, res: Response) => {
  const { secret, password } = req.body as { secret?: string; password?: string };
  const expected = process.env.SESSION_SECRET;
  if (!expected || !secret || secret !== expected) {
    res.status(403).json({ error: "Acceso denegado" });
    return;
  }
  if (!password || password.length < 4) {
    res.status(400).json({ error: "La contrasena debe tener al menos 4 caracteres" });
    return;
  }
  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, SUPERADMIN_EMAIL));
    if (existing.length > 0) {
      await db.update(usersTable).set({ passwordHash }).where(eq(usersTable.email, SUPERADMIN_EMAIL));
      res.json({ message: "Contrasena actualizada" });
    } else {
      const [user] = await db.insert(usersTable).values({
        name: SUPERADMIN_NAME,
        email: SUPERADMIN_EMAIL,
        passwordHash,
        puesto: "Superadministrador",
        area: "Sistemas",
        role: "superadmin",
      }).returning();
      res.json({ message: "Superadmin creado", userId: user.id });
    }
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
