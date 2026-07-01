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
    column_start: row.columnStart,
    row_start: row.rowStart,
    columns_asc: row.columnsAsc,
    rows_asc: row.rowsAsc,
    diagram_scale: row.diagramScale,
    diagram_offset_x: row.diagramOffsetX,
    diagram_offset_y: row.diagramOffsetY,
    diagram_opacity: row.diagramOpacity,
    zone_id: row.zoneId,
    side_id: row.sideId,
    visual_zone_id: row.visualZoneId,
    alphanumeric_ids: row.alphanumericIds ?? [],
    created_at: row.createdAt,
  };
}

router.get("/panels", async (_req: Request, res: Response) => {
  const rows = await db.select().from(panelsTable).orderBy(panelsTable.name);
  res.json(rows.map(toJson));
});

router.post("/panels", async (req: Request, res: Response) => {
  const {
    name, description, diagram_url, columns, rows,
    column_start, row_start, columns_asc, rows_asc,
    diagram_scale, diagram_offset_x, diagram_offset_y, diagram_opacity,
    zone_id, side_id, visual_zone_id, alphanumeric_ids,
  } = req.body as {
    name: string; description?: string; diagram_url?: string;
    columns: number; rows: number;
    column_start?: number; row_start?: number;
    columns_asc?: boolean; rows_asc?: boolean;
    diagram_scale?: number; diagram_offset_x?: number; diagram_offset_y?: number; diagram_opacity?: number;
    zone_id?: number; side_id?: number; visual_zone_id?: number; alphanumeric_ids?: number[];
  };
  const [row] = await db.insert(panelsTable).values({
    name, description, diagramUrl: diagram_url, columns, rows,
    columnStart: column_start ?? 1,
    rowStart: row_start ?? 0,
    columnsAsc: columns_asc ?? true,
    rowsAsc: rows_asc ?? true,
    diagramScale: diagram_scale ?? 1.0,
    diagramOffsetX: diagram_offset_x ?? 0.0,
    diagramOffsetY: diagram_offset_y ?? 0.0,
    diagramOpacity: diagram_opacity ?? 0.5,
    zoneId: zone_id, sideId: side_id, visualZoneId: visual_zone_id,
    alphanumericIds: alphanumeric_ids ?? [],
  }).returning();
  res.status(201).json(toJson(row!));
});

router.get("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const [row] = await db.select().from(panelsTable).where(eq(panelsTable.id, id));
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.patch("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  const {
    name, description, diagram_url, columns, rows,
    column_start, row_start, columns_asc, rows_asc,
    diagram_scale, diagram_offset_x, diagram_offset_y, diagram_opacity,
    zone_id, side_id, visual_zone_id, alphanumeric_ids,
  } = req.body as {
    name?: string; description?: string; diagram_url?: string;
    columns?: number; rows?: number;
    column_start?: number; row_start?: number;
    columns_asc?: boolean; rows_asc?: boolean;
    diagram_scale?: number; diagram_offset_x?: number; diagram_offset_y?: number; diagram_opacity?: number;
    zone_id?: number; side_id?: number; visual_zone_id?: number; alphanumeric_ids?: number[];
  };
  const updates: Partial<typeof panelsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (description !== undefined) updates.description = description;
  if (diagram_url !== undefined) updates.diagramUrl = diagram_url;
  if (columns !== undefined) updates.columns = columns;
  if (rows !== undefined) updates.rows = rows;
  if (column_start !== undefined) updates.columnStart = column_start;
  if (row_start !== undefined) updates.rowStart = row_start;
  if (columns_asc !== undefined) updates.columnsAsc = columns_asc;
  if (rows_asc !== undefined) updates.rowsAsc = rows_asc;
  if (diagram_scale !== undefined) updates.diagramScale = diagram_scale;
  if (diagram_offset_x !== undefined) updates.diagramOffsetX = diagram_offset_x;
  if (diagram_offset_y !== undefined) updates.diagramOffsetY = diagram_offset_y;
  if (diagram_opacity !== undefined) updates.diagramOpacity = diagram_opacity;
  if (zone_id !== undefined) updates.zoneId = zone_id;
  if (side_id !== undefined) updates.sideId = side_id;
  if (visual_zone_id !== undefined) updates.visualZoneId = visual_zone_id;
  if (alphanumeric_ids !== undefined) updates.alphanumericIds = alphanumeric_ids;
  const [row] = await db.update(panelsTable).set(updates).where(eq(panelsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json(toJson(row));
});

router.delete("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(panelsTable).where(eq(panelsTable.id, id));
  res.status(204).send();
});

export default router;
