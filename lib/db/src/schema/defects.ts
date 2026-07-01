import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const defectsTable = pgTable("defects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDefectSchema = createInsertSchema(defectsTable).omit({ id: true, createdAt: true });
export const updateDefectSchema = insertDefectSchema.partial();
export type InsertDefect = z.infer<typeof insertDefectSchema>;
export type Defect = typeof defectsTable.$inferSelect;
