import { Router } from "express";
import { db, defectsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof defectsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    created_at: row.createdAt,
  };
}

router.get("/defects", async (_req: Request, res: Response) => {
  const rows = await db.select().from(defectsTable).orderBy(defectsTable.name);
  res.json(rows.map(toJson));
});

router.post("/defects", async (req: Request, res: Response) => {
  const { name, code, description } = req.body as { name: string; code: string; description?: string };
  try {
    const [row] = await db.insert(defectsTable).values({ name, code, description }).returning();
    res.status(201).json(toJson(row!));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "El código ya está en uso por otro defecto." });
      return;
    }
    throw err;
  }
});

router.get("/defects/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(defectsTable).where(eq(defectsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/defects/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, code, description } = req.body as { name?: string; code?: string; description?: string };
  const updates: Partial<typeof defectsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (description !== undefined) updates.description = description;
  try {
    const [row] = await db.update(defectsTable).set(updates).where(eq(defectsTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json(toJson(row));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "El código ya está en uso por otro defecto." });
      return;
    }
    throw err;
  }
});

router.delete("/defects/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(defectsTable).where(eq(defectsTable.id, id));
  res.status(204).send();
});

export default router;
