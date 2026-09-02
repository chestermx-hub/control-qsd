import { Router } from "express";
import { db, zonesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof zonesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    udn_id: row.udnId,
    sort_order: row.sortOrder,
    created_at: row.createdAt,
  };
}

router.get("/zones", async (_req: Request, res: Response) => {
  const rows = await db.select().from(zonesTable).orderBy(zonesTable.sortOrder, zonesTable.name);
  res.json(rows.map(toJson));
});

router.post("/zones", async (req: Request, res: Response) => {
  const { name, description, udn_id, sort_order } = req.body as { name: string; description?: string; udn_id?: number; sort_order?: number };
  const [row] = await db.insert(zonesTable).values({ name, description, udnId: udn_id, sortOrder: sort_order }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/zones/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(zonesTable).where(eq(zonesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/zones/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, description, udn_id, sort_order } = req.body as { name?: string; description?: string; udn_id?: number; sort_order?: number };
  const updates: Partial<typeof zonesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (udn_id !== undefined) updates.udnId = udn_id;
  if (sort_order !== undefined) updates.sortOrder = sort_order;
  const [row] = await db.update(zonesTable).set(updates).where(eq(zonesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/zones/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(zonesTable).where(eq(zonesTable.id, id));
  res.status(204).send();
});

export default router;
