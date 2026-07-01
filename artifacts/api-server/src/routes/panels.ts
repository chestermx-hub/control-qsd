import { Router } from "express";
import { db, panelsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof panelsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    diagram_url: row.diagramUrl,
    columns: row.columns,
    rows: row.rows,
    zone_id: row.zoneId,
    created_at: row.createdAt,
  };
}

router.get("/panels", async (_req: Request, res: Response) => {
  const rows = await db.select().from(panelsTable).orderBy(panelsTable.name);
  res.json(rows.map(toJson));
});

router.post("/panels", async (req: Request, res: Response) => {
  const { name, description, diagram_url, columns, rows, zone_id } = req.body as {
    name: string; description?: string; diagram_url?: string; columns: number; rows: number; zone_id?: number;
  };
  const [row] = await db.insert(panelsTable).values({ name, description, diagramUrl: diagram_url, columns, rows, zoneId: zone_id }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const [row] = await db.select().from(panelsTable).where(eq(panelsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const { name, description, diagram_url, columns, rows, zone_id } = req.body as {
    name?: string; description?: string; diagram_url?: string; columns?: number; rows?: number; zone_id?: number;
  };
  const updates: Partial<typeof panelsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (diagram_url !== undefined) updates.diagramUrl = diagram_url;
  if (columns !== undefined) updates.columns = columns;
  if (rows !== undefined) updates.rows = rows;
  if (zone_id !== undefined) updates.zoneId = zone_id;
  const [row] = await db.update(panelsTable).set(updates).where(eq(panelsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  await db.delete(panelsTable).where(eq(panelsTable.id, id));
  res.status(204).send();
});

export default router;
