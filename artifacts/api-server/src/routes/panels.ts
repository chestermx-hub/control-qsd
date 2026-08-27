import { Router } from "express";
import { db, panelsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request, Response } from "express";

const router = Router();

const LABEL_PATTERN = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,31}$/u;

function spreadsheetLabel(index: number): string {
  let value = Math.max(0, index);
  let label = "";
  do {
    label = String.fromCharCode(65 + (value % 26)) + label;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);
  return label;
}

function generatedLabels(count: number, start: string, ascending: boolean, row: boolean): string[] {
  const normalizedStart = (start || (row ? "A" : "1")).trim();
  const numeric = /^\d+$/.test(normalizedStart);
  const letter = /^[A-Za-z]+$/.test(normalizedStart);
  const startNumber = numeric ? Number(normalizedStart) : 0;
  const startLetter = letter
    ? normalizedStart.toUpperCase().split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1
    : 0;
  return Array.from({ length: count }, (_, index) => {
    const offset = ascending ? index : count - 1 - index;
    if (numeric) return String(startNumber + offset);
    if (letter) {
      if (row && normalizedStart.length === 1) return spreadsheetLabel(startLetter + offset);
      return spreadsheetLabel(startLetter + offset);
    }
    return index === 0 ? normalizedStart : `${normalizedStart}${offset + 1}`;
  });
}

function legacyColumnStart(value: string | number | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : 1;
}

function legacyRowStart(value: string | number | undefined): number {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  const normalized = String(value ?? "A").trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) return 0;
  return normalized.split("").reduce((total, char) => total * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function validLabels(labels: unknown, count: number): labels is string[] {
  return Array.isArray(labels) &&
    labels.length === count &&
    labels.every((label) => typeof label === "string" && LABEL_PATTERN.test(label.trim())) &&
    new Set(labels.map((label) => label.trim().toLocaleLowerCase())).size === count;
}

function validDiagramTint(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value));
}

function isAdministrator(req: Request) {
  const userId = (req.session as unknown as Record<string, unknown>).userId as number | undefined;
  return userId
    ? db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).then(([user]) => user?.role === "admin" || user?.role === "superadmin")
    : Promise.resolve(false);
}

function toJson(row: typeof panelsTable.$inferSelect) {
  const columnLabels = validLabels(row.columnLabels, row.columns)
    ? row.columnLabels
    : generatedLabels(row.columns, String(row.columnStart), row.columnsAsc, false);
  const rowLabels = validLabels(row.rowLabels, row.rows)
    ? row.rowLabels
    : generatedLabels(row.rows, row.rowStart ? spreadsheetLabel(row.rowStart) : "A", row.rowsAsc, true);
  return {
    id: row.id,
    name: row.name,
    is_active: row.isActive,
    description: row.description,
    diagram_url: row.diagramUrl,
    columns: row.columns,
    rows: row.rows,
    column_start: row.columnStart,
    row_start: row.rowStart,
    column_labels: columnLabels,
    row_labels: rowLabels,
    columns_asc: row.columnsAsc,
    rows_asc: row.rowsAsc,
    cell_width: row.cellWidth,
    cell_height: row.cellHeight,
    diagram_scale_x: row.diagramScaleX,
    diagram_scale_y: row.diagramScaleY,
    diagram_offset_x: row.diagramOffsetX,
    diagram_offset_y: row.diagramOffsetY,
    diagram_opacity: row.diagramOpacity,
    diagram_tint: row.diagramTint,
    grid_offset_x: row.gridOffsetX,
    grid_offset_y: row.gridOffsetY,
    column_widths: row.columnWidths ?? [],
    row_heights: row.rowHeights ?? [],
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
    name, is_active, description, diagram_url, columns, rows,
    column_start, row_start, columns_asc, rows_asc,
    cell_width, cell_height,
    diagram_scale_x, diagram_scale_y, diagram_offset_x, diagram_offset_y, diagram_opacity, diagram_tint,
    grid_offset_x, grid_offset_y,
    column_widths, row_heights,
    column_labels, row_labels,
    zone_id, side_id, visual_zone_id, alphanumeric_ids,
  } = req.body as {
    name: string; is_active?: boolean; description?: string; diagram_url: string;
    columns: number; rows: number;
    column_start?: string | number; row_start?: string | number;
    columns_asc?: boolean; rows_asc?: boolean;
    cell_width?: number; cell_height?: number;
     diagram_scale_x?: number; diagram_scale_y?: number; diagram_offset_x?: number; diagram_offset_y?: number; diagram_opacity?: number; diagram_tint?: string | null;
    grid_offset_x?: number; grid_offset_y?: number;
    column_widths?: number[]; row_heights?: number[];
    column_labels?: string[]; row_labels?: string[];
    zone_id?: number; side_id?: number; visual_zone_id?: number; alphanumeric_ids?: number[];
  };
  if (column_labels !== undefined || row_labels !== undefined) {
    if (!validLabels(column_labels, columns) || !validLabels(row_labels, rows)) {
      res.status(400).json({ error: "Las etiquetas deben ser valores alfanuméricos válidos y coincidir con el tamaño de la cuadrícula" });
      return;
    }
  }
  if (!validDiagramTint(diagram_tint ?? null)) {
    res.status(400).json({ error: "El tinte debe ser un color hexadecimal válido" });
    return;
  }
  const [row] = await db.insert(panelsTable).values({
    name, isActive: is_active ?? true, description, diagramUrl: diagram_url, columns, rows,
    columnStart: legacyColumnStart(column_start),
    rowStart: legacyRowStart(row_start),
    columnLabels: validLabels(column_labels, columns) ? column_labels : generatedLabels(columns, String(column_start ?? 1), columns_asc ?? true, false),
    rowLabels: validLabels(row_labels, rows) ? row_labels : generatedLabels(rows, String(row_start ?? "A"), rows_asc ?? true, true),
    columnsAsc: columns_asc ?? true,
    rowsAsc: rows_asc ?? true,
    cellWidth: cell_width ?? 48,
    cellHeight: cell_height ?? 32,
    diagramScaleX: diagram_scale_x ?? 1.0,
    diagramScaleY: diagram_scale_y ?? 1.0,
    diagramOffsetX: diagram_offset_x ?? 0.0,
    diagramOffsetY: diagram_offset_y ?? 0.0,
    diagramOpacity: diagram_opacity ?? 0.5,
    diagramTint: diagram_tint ?? null,
    gridOffsetX: grid_offset_x ?? 0,
    gridOffsetY: grid_offset_y ?? 0,
    columnWidths: column_widths ?? [],
    rowHeights: row_heights ?? [],
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
    name, is_active, description, diagram_url, columns, rows,
    column_start, row_start, columns_asc, rows_asc,
    cell_width, cell_height,
    diagram_scale_x, diagram_scale_y, diagram_offset_x, diagram_offset_y, diagram_opacity, diagram_tint,
    grid_offset_x, grid_offset_y,
    column_widths, row_heights,
    column_labels, row_labels,
    zone_id, side_id, visual_zone_id, alphanumeric_ids,
  } = req.body as {
    name?: string; is_active?: boolean; description?: string; diagram_url?: string;
    columns?: number; rows?: number;
    column_start?: string | number; row_start?: string | number;
    columns_asc?: boolean; rows_asc?: boolean;
    cell_width?: number; cell_height?: number;
    diagram_scale_x?: number; diagram_scale_y?: number; diagram_offset_x?: number; diagram_offset_y?: number; diagram_opacity?: number; diagram_tint?: string | null;
    grid_offset_x?: number; grid_offset_y?: number;
    column_widths?: number[]; row_heights?: number[];
    column_labels?: string[]; row_labels?: string[];
    zone_id?: number; side_id?: number; visual_zone_id?: number; alphanumeric_ids?: number[];
  };
  const [currentPanel] = await db.select().from(panelsTable).where(eq(panelsTable.id, id));
  if (!currentPanel) { res.status(404).json({ error: "Not found" }); return; }

  const nextColumns = columns ?? currentPanel.columns;
  const nextRows = rows ?? currentPanel.rows;
  const columnConfigurationChanged =
    columns !== undefined || column_start !== undefined || columns_asc !== undefined;
  const rowConfigurationChanged =
    rows !== undefined || row_start !== undefined || rows_asc !== undefined;

  if (column_labels !== undefined || row_labels !== undefined) {
    if (!(await isAdministrator(req))) { res.status(403).json({ error: "Sólo un administrador puede editar etiquetas de cuadrícula" }); return; }
    if (
      (column_labels !== undefined && !validLabels(column_labels, nextColumns)) ||
      (row_labels !== undefined && !validLabels(row_labels, nextRows))
    ) {
      res.status(400).json({ error: "Las etiquetas deben ser valores alfanuméricos válidos" }); return;
    }
  }
  if (diagram_tint !== undefined && !validDiagramTint(diagram_tint)) {
    res.status(400).json({ error: "El tinte debe ser un color hexadecimal válido" });
    return;
  }
  const updates: Partial<typeof panelsTable.$inferInsert> = {};
  if (name !== undefined) updates.name = name;
  if (is_active !== undefined) updates.isActive = is_active;
  if (description !== undefined) updates.description = description;
  if (diagram_url !== undefined) updates.diagramUrl = diagram_url;
  if (columns !== undefined) updates.columns = columns;
  if (rows !== undefined) updates.rows = rows;
  if (column_start !== undefined) updates.columnStart = legacyColumnStart(column_start);
  if (row_start !== undefined) updates.rowStart = legacyRowStart(row_start);
  if (columns_asc !== undefined) updates.columnsAsc = columns_asc;
  if (rows_asc !== undefined) updates.rowsAsc = rows_asc;
  if (cell_width !== undefined) updates.cellWidth = cell_width;
  if (cell_height !== undefined) updates.cellHeight = cell_height;
  if (diagram_scale_x !== undefined) updates.diagramScaleX = diagram_scale_x;
  if (diagram_scale_y !== undefined) updates.diagramScaleY = diagram_scale_y;
  if (diagram_offset_x !== undefined) updates.diagramOffsetX = diagram_offset_x;
  if (diagram_offset_y !== undefined) updates.diagramOffsetY = diagram_offset_y;
  if (diagram_opacity !== undefined) updates.diagramOpacity = diagram_opacity;
  if (diagram_tint !== undefined) updates.diagramTint = diagram_tint;
  if (grid_offset_x !== undefined) updates.gridOffsetX = grid_offset_x;
  if (grid_offset_y !== undefined) updates.gridOffsetY = grid_offset_y;
  if (column_widths !== undefined) updates.columnWidths = column_widths;
  if (row_heights !== undefined) updates.rowHeights = row_heights;
  if (column_labels !== undefined) updates.columnLabels = column_labels;
  else if (columnConfigurationChanged) {
    updates.columnLabels = generatedLabels(
      nextColumns,
      String(column_start ?? currentPanel.columnStart),
      columns_asc ?? currentPanel.columnsAsc,
      false,
    );
  }
  if (row_labels !== undefined) updates.rowLabels = row_labels;
  else if (rowConfigurationChanged) {
    updates.rowLabels = generatedLabels(
      nextRows,
      row_start !== undefined ? String(row_start) : spreadsheetLabel(currentPanel.rowStart),
      rows_asc ?? currentPanel.rowsAsc,
      true,
    );
  }
  if (zone_id !== undefined) updates.zoneId = zone_id;
  if (side_id !== undefined) updates.sideId = side_id;
  if (visual_zone_id !== undefined) updates.visualZoneId = visual_zone_id;
  if (alphanumeric_ids !== undefined) updates.alphanumericIds = alphanumeric_ids;
  const [row] = await db.update(panelsTable).set(updates).where(eq(panelsTable.id, id)).returning();
  res.json(toJson(row));
});

router.delete("/panels/:id", async (req: Request, res: Response) => {
  const id = parseInt(req.params["id"] as string);
  await db.delete(panelsTable).where(eq(panelsTable.id, id));
  res.status(204).send();
});

export default router;
