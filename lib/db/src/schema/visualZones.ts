import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const visualZonesTable = pgTable("visual_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertVisualZoneSchema = createInsertSchema(visualZonesTable).omit({ id: true, createdAt: true });
export const updateVisualZoneSchema = insertVisualZoneSchema.partial();
export type InsertVisualZone = z.infer<typeof insertVisualZoneSchema>;
export type VisualZone = typeof visualZonesTable.$inferSelect;
