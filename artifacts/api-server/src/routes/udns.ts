import { Router } from "express";
import { db, udnsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof udnsTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    created_at: row.createdAt,
  };
}

router.get("/udns", async (_req: Request, res: Response) => {
  const rows = await db.select().from(udnsTable).orderBy(udnsTable.name);
  res.json(rows.map(toJson));
});

router.post("/udns", async (req: Request, res: Response) => {
  const { name, code, description } = req.body as { name: string; code: string; description?: string };
  const [row] = await db.insert(udnsTable).values({ name, code, description }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/udns/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(udnsTable).where(eq(udnsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/udns/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const { name, code, description } = req.body as { name?: string; code?: string; description?: string };
  const updates: Partial<typeof udnsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (description !== undefined) updates.description = description;
  const [row] = await db.update(udnsTable).set(updates).where(eq(udnsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/udns/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(udnsTable).where(eq(udnsTable.id, id));
  res.status(204).send();
});

export default router;
