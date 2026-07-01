import { Router } from "express";
import { db, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof profilesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    permissions: row.permissions as string[],
    created_at: row.createdAt,
  };
}

router.get("/profiles", async (_req: Request, res: Response) => {
  const rows = await db.select().from(profilesTable).orderBy(profilesTable.name);
  res.json(rows.map(toJson));
});

router.post("/profiles", async (req: Request, res: Response) => {
  const { name, description, permissions } = req.body as { name: string; description?: string; permissions: string[] };
  const [row] = await db.insert(profilesTable).values({ name, description, permissions: permissions ?? [] }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/profiles/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(profilesTable).where(eq(profilesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/profiles/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, description, permissions } = req.body as { name?: string; description?: string; permissions?: string[] };
  const updates: Partial<typeof profilesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (permissions !== undefined) updates.permissions = permissions;
  const [row] = await db.update(profilesTable).set(updates).where(eq(profilesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/profiles/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(profilesTable).where(eq(profilesTable.id, id));
  res.status(204).send();
});

export default router;
