import { Router } from "express";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function userToJson(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    puesto: user.puesto,
    area: user.area,
    profile_id: user.profileId,
    udn_id: user.udnId,
    role: user.role,
    created_at: user.createdAt,
  };
}

router.get("/users", async (_req: Request, res: Response) => {
  const users = await db.select().from(usersTable).orderBy(usersTable.createdAt);
  res.json(users.map(userToJson));
});

router.post("/users", async (req: Request, res: Response) => {
  const { name, email, password, puesto, area, profile_id, udn_id, role } = req.body as {
    name: string; email: string; password: string; puesto: string; area: string;
    profile_id?: number | null; udn_id?: number | null; role?: string;
  };

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(usersTable).values({
    name,
    email: email.toLowerCase(),
    passwordHash,
    puesto: puesto ?? "",
    area: area ?? "",
    profileId: profile_id ?? null,
    udnId: udn_id ?? null,
    role: (role as "superadmin" | "admin" | "user") ?? "user",
  }).returning();
  res.status(201).json(userToJson(user!));
});

router.get("/users/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(userToJson(user));
});

router.patch("/users/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const { name, email, password, puesto, area, profile_id, udn_id, role } = req.body as {
    name?: string; email?: string; password?: string; puesto?: string; area?: string;
    profile_id?: number | null; udn_id?: number | null; role?: string;
  };

  const updates: Partial<typeof usersTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email.toLowerCase();
  if (puesto !== undefined) updates.puesto = puesto;
  if (area !== undefined) updates.area = area;
  if (profile_id !== undefined) updates.profileId = profile_id;
  if (udn_id !== undefined) updates.udnId = udn_id;
  if (role !== undefined) updates.role = role as "superadmin" | "admin" | "user";
  if (password) updates.passwordHash = await bcrypt.hash(password, 10);

  const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "Not found" }); return; }
  res.json(userToJson(user));
});

router.delete("/users/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.status(204).send();
});

export default router;
