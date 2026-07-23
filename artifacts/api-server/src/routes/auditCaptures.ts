import { Router } from "express";
import { db, auditCapturesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

function toJson(row: typeof auditCapturesTable.$inferSelect) {
  return {
    id: row.id,
    unit_number: row.unitNumber,
    week_number: row.weekNumber,
    date: row.date,
    skill_number: row.skillNumber,
    zone_id: row.zoneId,
    panel_id: row.panelId,
    side_id: row.sideId,
    visual_zone_id: row.visualZoneId,
    alphanumeric_id: row.alphanumericId,
    grid_col: row.gridCol,
    grid_row: row.gridRow,
    defect_id: row.defectId,
    defect_other: row.defectOther,
    quantity: row.quantity,
    created_at: row.createdAt,
  };
}

function getWeekNumber(dateStr: string): number {
  const date = new Date(dateStr + "T12:00:00Z");
  const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const diff = date.getTime() - startOfYear.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((diff / oneWeek) + startOfYear.getUTCDay() / 7);
}

router.get("/audit-captures/daily-counter", async (req: Request, res: Response) => {
  const dateStr = req.query.date as string;
  if (!dateStr) {
    res.status(400).json({ error: "date query param required" });
    return;
  }
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(auditCapturesTable)
    .where(eq(auditCapturesTable.date, dateStr));
  const count = result[0]?.count ?? 0;
  res.json({
    date: dateStr,
    next_unit_number: count + 1,
    week_number: getWeekNumber(dateStr),
  });
});

router.get("/audit-captures", async (req: Request, res: Response) => {
  const { date, panel_id } = req.query as { date?: string; panel_id?: string };
  let query = db.select().from(auditCapturesTable).$dynamic();
  const conditions = [];
  if (date) conditions.push(eq(auditCapturesTable.date, date));
  if (panel_id) conditions.push(eq(auditCapturesTable.panelId, parseInt(panel_id)));
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  const rows = await query.orderBy(auditCapturesTable.createdAt);
  res.json(rows.map(toJson));
});

router.post("/audit-captures", async (req: Request, res: Response) => {
  const {
    unit_number, week_number, date, skill_number,
    zone_id, panel_id, side_id, visual_zone_id, alphanumeric_id,
    grid_col, grid_row, defect_id, defect_other, quantity,
  } = req.body as {
    unit_number: number; week_number: number; date: string; skill_number?: string;
    zone_id?: number; panel_id?: number; side_id?: number; visual_zone_id?: number; alphanumeric_id?: number;
    grid_col: number; grid_row: string; defect_id?: number; defect_other?: string; quantity: number;
  };
  const [row] = await db.insert(auditCapturesTable).values({
    unitNumber: unit_number,
    weekNumber: week_number,
    date,
    skillNumber: skill_number,
    zoneId: zone_id,
    panelId: panel_id,
    sideId: side_id,
    visualZoneId: visual_zone_id,
    alphanumericId: alphanumeric_id,
    gridCol: grid_col,
    gridRow: grid_row,
    defectId: defect_id,
    defectOther: defect_other,
    quantity,
  }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/audit-captures/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(auditCapturesTable).where(eq(auditCapturesTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/audit-captures/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const {
    skill_number, zone_id, panel_id, side_id, visual_zone_id, alphanumeric_id,
    grid_col, grid_row, defect_id, defect_other, quantity,
  } = req.body as {
    skill_number?: string; zone_id?: number; panel_id?: number; side_id?: number; visual_zone_id?: number; alphanumeric_id?: number;
    grid_col?: number; grid_row?: string; defect_id?: number; defect_other?: string; quantity?: number;
  };
  const updates: Partial<typeof auditCapturesTable.$inferInsert> = {};
  if (skill_number !== undefined) updates.skillNumber = skill_number;
  if (zone_id !== undefined) updates.zoneId = zone_id;
  if (panel_id !== undefined) updates.panelId = panel_id;
  if (side_id !== undefined) updates.sideId = side_id;
  if (visual_zone_id !== undefined) updates.visualZoneId = visual_zone_id;
  if (alphanumeric_id !== undefined) updates.alphanumericId = alphanumeric_id;
  if (grid_col !== undefined) updates.gridCol = grid_col;
  if (grid_row !== undefined) updates.gridRow = grid_row;
  if (defect_id !== undefined) updates.defectId = defect_id;
  if (defect_other !== undefined) updates.defectOther = defect_other;
  if (quantity !== undefined) updates.quantity = quantity;
  const [row] = await db.update(auditCapturesTable).set(updates).where(eq(auditCapturesTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/audit-captures/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(auditCapturesTable).where(eq(auditCapturesTable.id, id));
  res.status(204).send();
});

export default router;
