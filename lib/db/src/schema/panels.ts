import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPanelSchema = createInsertSchema(panelsTable).omit({ id: true, createdAt: true });
export const updatePanelSchema = insertPanelSchema.partial();
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof panelsTable.$inferSelect;
