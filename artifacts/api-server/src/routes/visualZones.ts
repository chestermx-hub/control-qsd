import { Router } from "express";
import { db, visualZonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof visualZonesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.createdAt,
  };
}

router.get("/visual-zones", async (_req: Request, res: Response) => {
  const rows = await db.select().from(visualZonesTable).orderBy(visualZonesTable.name);
  res.json(rows.map(toJson));
});

router.post("/visual-zones", async (req: Request, res: Response) => {
  const { name, description } = req.body as { name: string; description?: string };
  const [row] = await db.insert(visualZonesTable).values({ name, description }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/visual-zones/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(visualZonesTable).where(eq(visualZonesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/visual-zones/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, description } = req.body as { name?: string; description?: string };
  const updates: Partial<typeof visualZonesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  const [row] = await db.update(visualZonesTable).set(updates).where(eq(visualZonesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/visual-zones/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(visualZonesTable).where(eq(visualZonesTable.id, id));
  res.status(204).send();
});

export default router;
