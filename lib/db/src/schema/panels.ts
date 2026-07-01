import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { zonesTable } from "./zones";

export const panelsTable = pgTable("panels", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  diagramUrl: text("diagram_url"),
  columns: integer("columns").notNull().default(5),
  rows: integer("rows").notNull().default(5),
  zoneId: integer("zone_id").references(() => zonesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPanelSchema = createInsertSchema(panelsTable).omit({ id: true, createdAt: true });
export const updatePanelSchema = insertPanelSchema.partial();
export type InsertPanel = z.infer<typeof insertPanelSchema>;
export type Panel = typeof panelsTable.$inferSelect;
