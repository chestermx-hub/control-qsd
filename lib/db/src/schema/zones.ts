import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { udnsTable } from "./udns";

export const zonesTable = pgTable("zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  udnId: integer("udn_id").references(() => udnsTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertZoneSchema = createInsertSchema(zonesTable).omit({ id: true, createdAt: true });
export const updateZoneSchema = insertZoneSchema.partial();
export type InsertZone = z.infer<typeof insertZoneSchema>;
export type Zone = typeof zonesTable.$inferSelect;
