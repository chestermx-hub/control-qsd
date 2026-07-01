import { Router } from "express";
import { db, sidesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof sidesTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    created_at: row.createdAt,
  };
}

router.get("/sides", async (_req: Request, res: Response) => {
  const rows = await db.select().from(sidesTable).orderBy(sidesTable.name);
  res.json(rows.map(toJson));
});

router.post("/sides", async (req: Request, res: Response) => {
  const { name, description } = req.body as { name: string; description?: string };
  const [row] = await db.insert(sidesTable).values({ name, description }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/sides/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(sidesTable).where(eq(sidesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/sides/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, description } = req.body as { name?: string; description?: string };
  const updates: Partial<typeof sidesTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  const [row] = await db.update(sidesTable).set(updates).where(eq(sidesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/sides/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(sidesTable).where(eq(sidesTable.id, id));
  res.status(204).send();
});

export default router;
