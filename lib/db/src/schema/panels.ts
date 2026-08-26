import { pgTable, serial, text, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";
import { sidesTable } from "./sides";
import { visualZonesTable } from "./visualZones";

export const panelsTable = pgTable("panels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  diagramUrl: text("diagram_url"),
  columns: integer("columns").notNull().default(5),
  rows: integer("rows").notNull().default(5),
  zoneId: integer("zone_id").references(() => zonesTable.id, { onDelete: "set null" }),
  sideId: integer("side_id").references(() => sidesTable.id, { onDelete: "set null" }),
  visualZoneId: integer("visual_zone_id").references(() => visualZonesTable.id, { onDelete: "set null" }),
  alphanumericIds: integer("alphanumeric_ids").array().default([]),
  columnStart: integer("column_start").notNull().default(1),
  rowStart: integer("row_start").notNull().default(0),
  columnLabels: text("column_labels").array().notNull().default([]),
  rowLabels: text("row_labels").array().notNull().default([]),
  columnsAsc: boolean("columns_asc").notNull().default(true),
  rowsAsc: boolean("rows_asc").notNull().default(true),
  cellWidth: integer("cell_width").notNull().default(48),
  cellHeight: integer("cell_height").notNull().default(32),
  diagramScaleX: real("diagram_scale_x").notNull().default(1.0),
  diagramScaleY: real("diagram_scale_y").notNull().default(1.0),
  diagramOffsetX: real("diagram_offset_x").notNull().default(0.0),
  diagramOffsetY: real("diagram_offset_y").notNull().default(0.0),
  diagramOpacity: real("diagram_opacity").notNull().default(0.5),
  gridOffsetX: integer("grid_offset_x").notNull().default(0),
  gridOffsetY: integer("grid_offset_y").notNull().default(0),
  columnWidths: integer("column_widths").array().notNull().default([]),
  rowHeights: integer("row_heights").array().notNull().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPanelSchema = createInsertSchema(panelsTable).omit({ id: true, createdAt: true });
export const updatePanelSchema = insertPanelSchema.partial();
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof panelsTable.$inferSelect;
