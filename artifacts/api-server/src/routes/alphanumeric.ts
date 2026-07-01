import { Router } from "express";
import { db, alphanumericTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof alphanumericTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    created_at: row.createdAt,
  };
}

router.get("/alphanumeric", async (_req: Request, res: Response) => {
  const rows = await db.select().from(alphanumericTable).orderBy(alphanumericTable.name);
  res.json(rows.map(toJson));
});

router.post("/alphanumeric", async (req: Request, res: Response) => {
  const { name, code, description } = req.body as { name: string; code: string; description?: string };
  const [row] = await db.insert(alphanumericTable).values({ name, code, description }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/alphanumeric/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const [row] = await db.select().from(alphanumericTable).where(eq(alphanumericTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/alphanumeric/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  const { name, code, description } = req.body as { name?: string; code?: string; description?: string };
  const updates: Partial<typeof alphanumericTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (code !== undefined) updates.code = code;
  if (description !== undefined) updates.description = description;
  const [row] = await db.update(alphanumericTable).set(updates).where(eq(alphanumericTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/alphanumeric/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params.id!);
  await db.delete(alphanumericTable).where(eq(alphanumericTable.id, id));
  res.status(204).send();
});

export default router;
